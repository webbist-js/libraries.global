import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { FeatureGatePanel } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { canStaffTool } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
import { privateMetadata } from "@/lib/seo/metadata"
import { staffLibraryHref } from "@/lib/staff/paths"
import { loadStaffPage } from "@/lib/staff/server"
import { getTrafficReport } from "@/lib/staff/traffic-report"
import {
  parseTrafficRange,
  type TrafficReport,
} from "@/lib/staff/traffic-source"

import { TrafficPreview } from "../_components/TrafficPreview"

export const metadata = privateMetadata("Traffic")

/** Decorative shapes for the access explanation, without fabricated metrics. */
function TrafficIllustration() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {["Page views", "Visitors"].map((label) => (
          <div
            key={label}
            className="rounded-[16px] border bg-(--t-bg-deep) p-4"
            style={{ borderColor: T.border.line }}
          >
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              {label}
            </p>
            <span
              className="mt-3 block h-5 w-16 rounded-full"
              style={{ background: T.bg.muted2 }}
            />
          </div>
        ))}
      </div>
      <div className="flex h-32 items-end gap-2">
        {[40, 55, 48, 70, 35, 60, 78, 52, 85, 65, 90, 72].map((height) => (
          <span
            key={height}
            className="flex-1 rounded-t"
            style={{ height: `${height}%`, background: T.accent.chip }}
          />
        ))}
      </div>
    </div>
  )
}

/** A covered library's message when there are no figures to show. */
function TrafficNotice({
  report,
}: {
  readonly report: Exclude<TrafficReport, { status: "ready" }>
}) {
  const copy = {
    unconfigured: {
      title: "Traffic reports aren’t connected yet",
      body: "Traffic reports are free for your library’s staff. Reporting is not connected yet, so there are no figures to show.",
    },
    "no-page": {
      title: "No public page to report on",
      body: "Your library’s public page isn’t published yet, so there are no visits to count.",
    },
    quota: {
      title: "Traffic figures are paused for now",
      body: "We’ve reached Google Analytics’ reporting limit for the moment. Try again in an hour.",
    },
    error: {
      title: "Traffic figures couldn’t be loaded",
      body: "Google Analytics didn’t answer just now. Try again shortly.",
    },
  }[report.status === "unavailable" ? report.reason : report.status]

  return (
    <div
      role={report.status === "unavailable" ? "alert" : undefined}
      className="mt-8 rounded-[20px] border p-5 sm:p-6"
      style={{ background: T.bg.surface, borderColor: T.border.line }}
    >
      <h3 className="type-card-title m-0">{copy.title}</h3>
      <p
        className="mt-2 mb-0 max-w-[65ch] text-base leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        {copy.body}
      </p>
    </div>
  )
}

export default async function TrafficPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale, slug } = await params
  const { user, documentId } = await loadStaffPage(slug, await staffPathname())
  const covered = canStaffTool(user, "traffic", documentId)
  const range = parseTrafficRange((await searchParams)?.range)
  // Access is checked above; uncovered libraries never reach Google.
  const report = covered ? await getTrafficReport(documentId, range) : null

  return (
    <div className="max-w-[1180px] space-y-4">
      {covered ? (
        <section
          className="rounded-[28px] border p-5 sm:p-10"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
          aria-labelledby="traffic-heading"
        >
          <h2 id="traffic-heading" className="type-h2 m-0">
            Page traffic
          </h2>
          <p className="mt-3 mb-0 text-base" style={{ color: T.ink.dim }}>
            Visits to your library’s page on Libraries Global.
          </p>
          {report?.status === "ready" ? (
            <>
              <div className="mt-8">
                <TrafficPreview
                  summary={report.summary}
                  rangeHref={(next) =>
                    `${staffLibraryHref(slug)}/traffic?range=${next}`
                  }
                  locale={locale}
                />
              </div>
              <p
                className="mt-6 mb-0 max-w-[75ch] text-sm leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                Counted by Google Analytics for visitors who accept analytics
                cookies, so refused consent and ad blockers make real visits
                higher than shown. Figures can take up to a day to appear.
              </p>
            </>
          ) : report ? (
            <TrafficNotice report={report} />
          ) : null}
        </section>
      ) : (
        <FeatureGatePanel
          badge="For verified staff"
          title={tUi("see_how_people_find_your_library")}
          lead="Traffic reports are free for verified staff of this library. If your access changed recently, reload the page."
          points={[
            "Page views and visitors",
            "Daily views for 7, 30 or 90 days",
            "Where visitors came from",
          ]}
          action={{ href: "/staff", label: "Check your staff access" }}
          preview={<TrafficIllustration />}
          previewCaption="Illustration of a traffic report"
        />
      )}
      <LearnMoreLink
        slug={KNOWLEDGE_SLUGS.staffArea}
        locale={locale as Locale}
      />
    </div>
  )
}

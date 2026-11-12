import { type Locale, useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { FeatureGatePanel } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { withMessages } from "@/i18n/scoped-messages"
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
  const tStatic = useTranslations("staticUi")

  const copy = {
    unconfigured: {
      title: tStatic("staffRoute.traffic_reports_aren_t_connected_yet"),
      body: "Traffic reports are free for your library’s staff. Reporting is not connected yet, so there are no figures to show.",
    },
    "no-page": {
      title: tStatic("staffRoute.no_public_page_to_report_on"),
      body: "Your library’s public page isn’t published yet, so there are no visits to count.",
    },
    quota: {
      title: tStatic("staffRoute.traffic_figures_are_paused_for_now"),
      body: "We’ve reached Google Analytics’ reporting limit for the moment. Try again in an hour.",
    },
    error: {
      title: tStatic("staffRoute.traffic_figures_couldn_t_be_loaded"),
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

async function TrafficPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const tStatic = await getTranslations("staticUi")

  const tUi = await getTranslations("ui")

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
            {tStatic("staffRoute.page_traffic")}
          </h2>
          <p className="mt-3 mb-0 text-base" style={{ color: T.ink.dim }}>
            {tStatic(
              "staffRoute.visits_to_your_library_s_page_on_libraries_global"
            )}
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
                {tStatic(
                  "staffRoute.counted_by_google_analytics_for_visitors_who_accept_analytics_cookies_so_refused_consent_and_ad_bloc"
                )}
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
          lead={tStatic(
            "staffRoute.traffic_reports_are_free_for_verified_staff_of_this_library_if_your_access_changed_recently_reload_t"
          )}
          points={[
            "Page views and visitors",
            "Daily views for 7, 30 or 90 days",
            "Where visitors came from",
          ]}
          action={{
            href: "/staff",
            label: tStatic("staffRoute.check_your_staff_access"),
          }}
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

export default withMessages(
  TrafficPage,
  "[locale]/(dashboard)/staff/[slug]/traffic/page"
)

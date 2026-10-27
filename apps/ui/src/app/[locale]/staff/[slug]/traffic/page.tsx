import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { PlanGatePanel } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
import { TEAM_CONTACT_HREF } from "@/lib/plans"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"

export const metadata = privateMetadata("Traffic")

/** Decorative shapes for the plan explanation, without fabricated metrics. */
function TrafficIllustration() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {["Page views", "Visitors"].map((label) => (
          <div
            key={label}
            className="rounded-[16px] border bg-white p-4"
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

export default async function TrafficPage({
  params,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale, slug } = await params
  const { user, documentId } = await loadStaffPage(slug, await staffPathname())
  const covered =
    requireEntitlementForLibrary(user, "library.traffic", documentId) === null

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
          <div
            className="mt-8 rounded-[20px] border p-5 sm:p-6"
            style={{ background: T.bg.surface, borderColor: T.border.line }}
          >
            <h3 className="type-card-title m-0">
              Traffic reports are coming soon
            </h3>
            <p
              className="mt-2 mb-0 max-w-[65ch] text-base leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              Your Team plan includes this feature. Traffic reporting is not
              connected yet, so there are no figures to show for your library.
            </p>
          </div>
        </section>
      ) : (
        <PlanGatePanel
          title={tUi("see_how_people_find_your_library")}
          lead="Understand visits to your library’s page with the Team plan. Traffic reports are coming soon."
          points={[
            "Page views and visitors",
            "Daily views for 7, 30 or 90 days",
            "Where visitors came from",
          ]}
          comingSoon
          compareHref="/plans"
          contactHref={TEAM_CONTACT_HREF}
          preview={<TrafficIllustration />}
        />
      )}
      <LearnMoreLink slug={KNOWLEDGE_SLUGS.plans} locale={locale as Locale} />
    </div>
  )
}

import type { Locale } from "next-intl"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { PlanGatePanel, Notice } from "@/components/ds"
import { KNOWLEDGE_SLUGS } from "@/components/staff/knowledge-links"
import { LearnMoreLink } from "@/components/staff/LearnMoreLink"
import { requireEntitlementForLibrary } from "@/lib/access-server"
import { TEAM_CONTACT_HREF } from "@/lib/plans"
import { privateMetadata } from "@/lib/seo/metadata"
import { staffLibraryHref } from "@/lib/staff/paths"
import { loadStaffPage } from "@/lib/staff/server"
import {
  SampleTrafficSource,
  parseTrafficRange,
  trafficSource,
  type TrafficSummary,
} from "@/lib/staff/traffic-source"

import { TrafficPreview } from "../_components/TrafficPreview"

export const metadata = privateMetadata("Traffic")

export default async function TrafficPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string; slug: string }>
  readonly searchParams: Promise<{ range?: string | string[] }>
}) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams])
  const { user, documentId } = await loadStaffPage(slug, await staffPathname())
  const range = parseTrafficRange(query.range)
  const covered =
    requireEntitlementForLibrary(user, "library.traffic", documentId) === null
  const base = staffLibraryHref(slug, "/traffic")
  const rangeHref = (r: number) => `${base}?range=${r}`
  // Uncovered libraries only ever see the sample; covered ones ask the
  // configured source and fall back to the sample until it exists.
  let summary: TrafficSummary
  let unavailable = false
  try {
    summary = await (
      covered ? trafficSource() : new SampleTrafficSource()
    ).getSummary(documentId, range)
  } catch {
    unavailable = true
    summary = await new SampleTrafficSource().getSummary(documentId, range)
  }

  return covered ? (
    <div className="flex flex-col gap-6">
      <Notice
        icon="mdi:information-outline"
        title={
          unavailable
            ? "Traffic reports are not connected yet"
            : "Traffic reports are coming soon"
        }
        tone="info"
      >
        <p className="m-0">
          This preview uses sample data. Your library’s traffic is not measured
          here yet.
        </p>
      </Notice>
      <TrafficPreview summary={summary} rangeHref={rangeHref} locale={locale} />
    </div>
  ) : (
    <div className="flex flex-col gap-4">
      <PlanGatePanel
        title="See how people find your library"
        lead="Understand visits to your library’s page with the Team plan."
        points={[
          "Page views and visitors",
          "Directions and catalogue clicks",
          "Referrers and searches",
          "Choose 7, 30 or 90 days",
        ]}
        comingSoon
        compareHref="/contribute/membership"
        contactHref={TEAM_CONTACT_HREF}
        preview={
          <TrafficPreview
            summary={summary}
            rangeHref={rangeHref}
            locale={locale}
            ghost
          />
        }
      />
      <LearnMoreLink slug={KNOWLEDGE_SLUGS.plans} locale={locale as Locale} />
    </div>
  )
}

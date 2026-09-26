import type { Data } from "@repo/strapi-types"

export type HomepageData =
  | Data.ContentType<"api::homepage.homepage">
  | null
  | undefined

export type HomepageContinentSummary = Pick<
  Data.ContentType<"api::continent.continent">,
  "code" | "documentId" | "id" | "name" | "slug"
> & {
  libraryCount: number
}

// ── Editable section copy (homepage.* components) ────────────────────────────

export type SectionIntro = {
  title?: string | null
  text?: string | null
}

export type CtaBand = SectionIntro & {
  primaryLabel?: string | null
  primaryHref?: string | null
  secondaryLabel?: string | null
  secondaryHref?: string | null
}

export type JourneyTone = "explore" | "contribute" | "steward"

export type Journey = {
  tone?: JourneyTone | null
  eyebrow?: string | null
  title?: string | null
  text?: string | null
  ctaLabel?: string | null
  ctaHref?: string | null
}

export type Citation = {
  lead?: string | null
  quote?: string | null
  attribution?: string | null
  sourceLabel?: string | null
  sourceUrl?: string | null
}

export type Step = { title?: string | null; text?: string | null }

export type LinkCard = {
  title?: string | null
  text?: string | null
  href?: string | null
}

export type { HomepageStats } from "@/lib/strapi-api/content/server"

/** A published record with gaps, surfaced as a small contribution task. */
export type ContributionTask = {
  documentId: string
  slug: string
  name: string
  place: string
  missingKey: string
}

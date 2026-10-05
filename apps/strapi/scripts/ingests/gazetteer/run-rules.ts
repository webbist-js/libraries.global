/**
 * Pure orchestration rules for the world place import (spec §6). No I/O and
 * no `StrapiClient` import: these are decisions `import.ts` makes once it
 * already has the data (an error, two timestamps, a profile) in hand, kept
 * here so they're unit-testable without a live Strapi.
 */
import type { ResolvedProfile } from "./country-profiles"
import type { SourcePlace } from "./types"

/** A ref as Strapi returns it on a populated relation. */
type Ref = { documentId: string } | null | undefined

/** The HTTP status `StrapiClient` throws in `Error("METHOD /path → NNN: …")`. */
export function statusOf(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err)
  const m = /→ (\d{3}):/.exec(msg)

  return m ? Number(m[1]) : null
}

/** A network error (no HTTP status to parse) or a 429/5xx response. */
export function isRetryable(err: unknown): boolean {
  const status = statusOf(err)
  if (status === null) return true

  return status === 429 || (status >= 500 && status < 600)
}

/** The longest a 429's own `Retry-After` wait is ever honoured for. */
export const MAX_RETRY_AFTER_MS = 60_000

/**
 * The wait a 429 asked for, in milliseconds, capped at `MAX_RETRY_AFTER_MS`
 * — read from `Retry-After: <seconds>` wherever `StrapiClient` put the
 * response body in its error message (it doesn't carry response headers
 * separately, so this is the only place the wait can be read from). Null
 * for anything that isn't a 429, or whose body has nothing parseable; a
 * caller falls back to its own fixed backoff in that case.
 */
export function retryAfterMs(err: unknown): number | null {
  if (statusOf(err) !== 429) return null
  const msg = err instanceof Error ? err.message : String(err)
  const m = /retry-after[:\s]+(\d+)/i.exec(msg)

  return m ? Math.min(Number(m[1]) * 1000, MAX_RETRY_AFTER_MS) : null
}

/**
 * True when `found` — a place reconciliation located by slug — is actually
 * the one a create was trying to make: its source attribution matches (so
 * it's this importer's work, not a hand-made place that merely shares a
 * slug), its id matches when the source has one, and its parent (the
 * Country for a Region, the Region for an Area) is the intended one.
 * Without this, a place that merely happens to share a slug — in a
 * different Country or Region entirely — could be wrongly adopted.
 */
export function isOurs(
  uid: "regions" | "areas",
  found: {
    sourceAttribution?: string | null
    geonamesId?: string | null
    gssCode?: string | null
    country?: Ref
    region?: Ref
  },
  check: {
    attribution: string
    geonamesId?: string
    gssCode?: string
    parentId: string
  }
): boolean {
  if (found.sourceAttribution !== check.attribution) return false
  if (check.geonamesId && found.geonamesId !== check.geonamesId) return false
  if (check.gssCode && found.gssCode !== check.gssCode) return false
  const parent = uid === "regions" ? found.country : found.region

  return parent?.documentId === check.parentId
}

/**
 * True when a parent (Country for Regions, Region for Areas) was entirely
 * created by an earlier, partial run of this same import: it has at least
 * one existing child, and every one of them carries this run's own source
 * attribution. A *fill* never writes `sourceAttribution` — only a *create*
 * does — so a hand-made place a fill has merely tagged with a `geonamesId`
 * never counts, and a fill-off parent (spec §6.3) stays fill-off. Resuming
 * such a parent doesn't need `fill` set in its profile.
 */
export function isResumable(
  existing: readonly { sourceAttribution?: string | null }[],
  attribution: string
): boolean {
  return (
    existing.length > 0 &&
    existing.every((e) => e.sourceAttribution === attribution)
  )
}

/** The Country fields `labelChanges` reads and writes. */
export interface LabelableCountry {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

const LABEL_FIELDS = [
  ["regionTypeLabel", "region"],
  ["regionsSectionLabel", "regions"],
  ["areaTypeLabel", "area"],
  ["areasSectionLabel", "areas"],
] as const satisfies readonly [keyof LabelableCountry, string][]

/** The label fields that differ from the profile's. */
export function labelChanges(
  country: LabelableCountry,
  profile: ResolvedProfile
): Record<string, { from: string | null; to: string }> {
  const out: Record<string, { from: string | null; to: string }> = {}
  for (const [field, key] of LABEL_FIELDS) {
    const to =
      profile.labels?.[key as keyof NonNullable<ResolvedProfile["labels"]>]
    const from = country[field] ?? null
    if (to !== undefined && from !== to) out[field] = { from, to }
  }

  return out
}

/** A Region's own Area label fields (`regionLabelChanges`). */
export interface LabelableRegion {
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

/** The Region's Area label fields that differ from the profile's `regionLabels` entry. */
export function regionLabelChanges(
  region: LabelableRegion,
  labels: { area: string; areas: string }
): Record<string, { from: string | null; to: string }> {
  const out: Record<string, { from: string | null; to: string }> = {}
  const want = { areaTypeLabel: labels.area, areasSectionLabel: labels.areas }
  for (const [field, to] of Object.entries(want) as [
    keyof LabelableRegion,
    string,
  ][]) {
    const from = region[field] ?? null
    if (from !== to) out[field] = { from, to }
  }

  return out
}

/** A draft newer than its published version by more than this has unpublished changes. */
export const UNPUBLISHED_THRESHOLD_MS = 1000

/**
 * A draft newer than its published version has changes an admin hasn't
 * published yet. Fails closed: a missing timestamp on either side means
 * "don't know", so it's treated as having unpublished changes.
 */
export function hasUnpublishedChanges(
  published: { updatedAt?: string | null } | null | undefined,
  draft: { updatedAt?: string | null } | null | undefined
): boolean {
  if (!draft?.updatedAt || !published?.updatedAt) return true

  return (
    new Date(draft.updatedAt).getTime() -
      new Date(published.updatedAt).getTime() >
    UNPUBLISHED_THRESHOLD_MS
  )
}

export type FillDecision =
  | { write: true }
  | { write: false; reason: "unpublished draft changes" | "draft only" }

/**
 * Whether a fill (spec §6.5: "a match fills an empty `geonamesId`") may
 * write. A fill is written with `?status=published` (Strapi 5's REST
 * default anyway), which publishes the place's whole draft — not just the
 * filled field. That's only harmless when the place already
 * has a published version identical to its draft: draft == published, so
 * publishing changes nothing else. A place with no published version at
 * all ("draft only"), or one whose draft has pending edits an admin hasn't
 * published yet ("unpublished draft changes", checked with
 * `hasUnpublishedChanges`, itself fail-closed on a missing timestamp), is
 * left for an admin to fill by hand instead.
 */
export function decideFill(
  draft: { updatedAt?: string | null },
  published: { updatedAt?: string | null } | null | undefined
): FillDecision {
  if (!published) return { write: false, reason: "draft only" }
  if (hasUnpublishedChanges(published, draft))
    return { write: false, reason: "unpublished draft changes" }

  return { write: true }
}

/** `sourceAttribution` on a whole-country Region (`wholeCountryRegion`). */
export const WHOLE_COUNTRY_REGION_ATTRIBUTION =
  "Libraries Global: whole-country region (GeoNames lists no subdivisions)"

/**
 * One whole-country Region to plan for a Country whose source lists no
 * subdivisions at all (15 GeoNames countries, e.g. Aruba, the Holy See) and
 * that has no *other* Region — without one, a library there can never be
 * published. Named after the Country itself, `key: "*"` (no Areas), no
 * `geonamesId`. Never planned when the source actually has Regions. Planned
 * — on every run, not just the first — as long as every one of the
 * Country's existing Regions already carries `WHOLE_COUNTRY_REGION_ATTRIBUTION`
 * (vacuously true when it has none yet): a re-run's existing Region is then
 * this same source by another name, so `planChildren` matches it by name
 * instead of creating a duplicate. A Country with any *other* Region —
 * one with a different attribution, hand-made or from a real source —
 * returns null and stays untouched.
 */
export function wholeCountryRegion(
  country: { name: string; iso2: string },
  sourceRegionCount: number,
  existingRegions: readonly { sourceAttribution?: string | null }[]
): SourcePlace | null {
  if (sourceRegionCount > 0) return null
  if (
    !existingRegions.every(
      (r) => r.sourceAttribution === WHOLE_COUNTRY_REGION_ATTRIBUTION
    )
  )
    return null

  return {
    sourceId: `country:${country.iso2}`,
    name: country.name,
    altNames: [],
    key: "*",
  }
}

/**
 * Whether the per-country GeoNames dump (multi-MB; it carries alternate
 * names, the only thing that lets an id-less, hand-filed place still match
 * by name) is needed before matching `places`' Regions/Areas. A GeoNames
 * source only ever carries a `geonamesId` — never a `gssCode` — so for a
 * `"geonames"` profile an existing place's `gssCode` is irrelevant: only
 * `geonamesId` can id-match it there, and its absence means the dump is
 * needed regardless. A `"curated"` source (gssCode-based, e.g. England)
 * counts a place as already id-matchable by either id. A whole-country
 * Region (`wholeCountryRegion`) is ignored entirely: it has no `geonamesId`
 * by design, permanently, and is matched by name against its own synthetic
 * source every run regardless — counting it here would force a needless
 * dump download for these countries on every run, forever.
 */
export function needsDumpForNameMatching(
  places: readonly {
    geonamesId?: string | null
    gssCode?: string | null
    sourceAttribution?: string | null
  }[],
  source: "geonames" | "curated"
): boolean {
  return places
    .filter((p) => p.sourceAttribution !== WHOLE_COUNTRY_REGION_ATTRIBUTION)
    .some((p) =>
      source === "geonames" ? !p.geonamesId : !p.geonamesId && !p.gssCode
    )
}

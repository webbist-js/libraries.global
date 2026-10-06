/**
 * Pure helpers shared by the drive task routes (`tasks` and `next`): the
 * Meilisearch attributes and sort a task search uses, the `near` param, the
 * shape of a search hit as a `DriveTask`, and the "exclude these ids"
 * filter clause both routes build the same way.
 */
import type { DriveTask } from "@/lib/drives/types"

export const PAGE_SIZE = 10
/** A drive opens with at most DRIVE_MAX_TASKS (2,000) tasks (ADR-0004). */
export const MAX_PAGE = 200

export const TASK_ATTRIBUTES = [
  "documentId",
  "slug",
  "name",
  "city",
  "district",
  "area_name",
  "region_name",
  "continent_slug",
  "country_slug",
  "region_slug",
  "website",
  "_geo",
  "needs",
  "completeness",
] as const

export interface DriveTaskHit {
  documentId: string
  slug: string
  name: string
  city?: string | null
  district?: string | null
  area_name?: string | null
  region_name?: string | null
  continent_slug?: string | null
  country_slug?: string | null
  region_slug?: string | null
  website?: string | null
  _geo?: { lat: number; lng: number } | null
  _geoDistance?: number
  needs?: string[] | null
  completeness?: number | null
}

/** `?near=lat,lng`, or null when missing or not two finite numbers. */
export function nearParam(
  raw: string | null
): { lat: number; lng: number } | null {
  if (!raw) return null
  const [latRaw, lngRaw] = raw.split(",")
  const lat = Number.parseFloat(latRaw ?? "")
  const lng = Number.parseFloat(lngRaw ?? "")

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** The sort a task search uses: nearest first when asked, else least done. */
export function taskSort(near: { lat: number; lng: number } | null): string[] {
  return near
    ? [`_geoPoint(${near.lat}, ${near.lng}):asc`]
    : ["completeness:desc", "name:asc"]
}

/** The library page's path, or null when a parent slug is missing. */
function hrefOf(hit: DriveTaskHit): string | null {
  const { continent_slug, country_slug, region_slug, slug } = hit

  return continent_slug && country_slug && region_slug && slug
    ? `/${continent_slug}/${country_slug}/${region_slug}/${slug}`
    : null
}

/**
 * A Meilisearch hit as a `DriveTask`, keeping `needs` and `completeness`
 * for a whole-record task's checklist. `near` isn't read here
 * (`_geoDistance` on the hit already reflects it when the search was
 * sorted by distance) — it's accepted so callers can pass the same value
 * they searched with.
 */
export function taskOf(
  hit: DriveTaskHit,
  near: { lat: number; lng: number } | null = null
): DriveTask {
  const {
    continent_slug: _continentSlug,
    country_slug: _countrySlug,
    region_slug: _regionSlug,
    needs,
    completeness,
    _geoDistance,
    ...rest
  } = hit

  return {
    ...rest,
    href: hrefOf(hit),
    inReview: false,
    needs: Array.isArray(needs)
      ? needs.filter((n): n is string => typeof n === "string")
      : null,
    completeness: typeof completeness === "number" ? completeness : null,
    ...(_geoDistance != null ? { distanceKm: _geoDistance / 1000 } : {}),
  }
}

const quotedIds = (ids: readonly string[]) =>
  `[${ids.map((id) => JSON.stringify(id)).join(", ")}]`

/**
 * `" AND documentId NOT IN [...]"`, or `""` for an empty list: the Meilisearch
 * filter clause that keeps already-excluded libraries (in review, held, or
 * skipped) out of a task search.
 */
export function exclusionClause(ids: readonly string[]): string {
  return ids.length > 0 ? ` AND documentId NOT IN ${quotedIds(ids)}` : ""
}

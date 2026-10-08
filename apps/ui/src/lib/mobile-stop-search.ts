import {
  addDays,
  localDateTime,
  todayKeys,
  type MobileVisit,
  type MobileTimetable,
} from "@repo/shared-data"

import type { Bounds } from "@/components/atlas/atlas.logic"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import type { PublicMobileTimetable } from "@/lib/mobile/types"

export interface MobileStopHit {
  id: string
  stop_id: string
  name: string
  where: string
  library_name: string
  library_slug: string
  library_path: string | null
  library_document_id: string
  area_slug: string | null
  region_slug: string | null
  country_slug: string | null
  _geo?: { lat: number; lng: number }
  _geoDistance?: number
  geo_cell?: string
  visit_keys: string[]
  cancelled_dates: string[]
  cycle: MobileTimetable["cycle"]
  visits: MobileVisit[]
  shares_live: boolean
  timezone: string
}
export type MobileVisitFilter = "any" | "today" | "week" | "live"
export type MobileViewport = {
  stops: MobileStopHit[]
  clusters: { lat: number; lng: number; count: number }[]
  total: number
  zoomIn: boolean
}
export function viewportFilter(bounds: Bounds): string {
  const { west, east, north, south } = bounds
  const valid =
    [west, east, north, south].every(Number.isFinite) &&
    south >= -90 &&
    north <= 90 &&
    south <= north
  if (!valid) throw new Error("Invalid viewport")
  // MapLibre can report wrapped longitudes beyond [-180,180].
  if (east - west >= 360)
    return `_geoBoundingBox([${north}, 180], [${south}, -180])`
  const wrap = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180
  const w = wrap(west),
    e = wrap(east)

  return w <= e
    ? `_geoBoundingBox([${north}, ${e}], [${south}, ${w}])`
    : `(_geoBoundingBox([${north}, 180], [${south}, ${w}]) OR _geoBoundingBox([${north}, ${e}], [${south}, -180]))`
}
export function visitDateFilter(date: string): string {
  return `(visit_keys IN [${todayKeys(date)
    .map((key) => JSON.stringify(key))
    .join(",")}] AND NOT cancelled_dates = ${JSON.stringify(date)})`
}
export async function searchMobileViewport(
  bounds: Bounds,
  zoom: number,
  mode: MobileVisitFilter,
  now = new Date()
): Promise<MobileViewport> {
  const index = meiliClient.index("mobile-stop"),
    base = viewportFilter(bounds)
  let filter = base
  if (mode === "today" || mode === "week") {
    const zones = await index.search("", {
      filter: base,
      limit: 0,
      facets: ["timezone"],
    })
    const zoneClauses = Object.keys(
      zones.facetDistribution?.timezone ?? {}
    ).map((tz) => {
      const date = localDateTime(now, tz).date,
        dates =
          mode === "today"
            ? [date]
            : Array.from({ length: 7 }, (_, i) => addDays(date, i))

      return `(timezone = ${JSON.stringify(tz)} AND (${dates.map(visitDateFilter).join(" OR ")}))`
    })
    if (!zoneClauses.length)
      return { stops: [], clusters: [], total: 0, zoomIn: false }
    filter += ` AND (${zoneClauses.join(" OR ")})`
  }
  if (mode === "live") filter += " AND shares_live = true"
  const response = await index.search<MobileStopHit>("", {
    filter,
    limit: zoom <= 8 ? 0 : 1000,
    facets: ["geo_cell", "kind"],
    sort: ["name:asc"],
  })
  const total = response.facetDistribution?.kind?.stop ?? 0
  const clusters = Object.entries(
    response.facetDistribution?.geo_cell ?? {}
  ).flatMap(([key, count]) => {
    const [lat, lng] = key.split(",").map(Number)

    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ lat: lat! + 0.5, lng: lng! + 0.5, count }]
      : []
  })

  return {
    stops: total > 1000 ? [] : response.hits,
    clusters,
    total,
    zoomIn: zoom <= 8 || total > 1000,
  }
}
export async function searchNearbyMobileStops({
  lat,
  lng,
  radius,
  limit = 100,
}: {
  lat: number
  lng: number
  radius: number
  limit?: number
}): Promise<MobileStopHit[]> {
  if (
    ![lat, lng, radius].every(Number.isFinite) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    radius < 0
  )
    return []

  return (
    await meiliClient.index("mobile-stop").search<MobileStopHit>("", {
      filter: `_geoRadius(${lat}, ${lng}, ${radius})`,
      sort: [`_geoPoint(${lat}, ${lng}):asc`],
      limit: Math.min(1000, Math.max(1, limit)),
    })
  ).hits
}
export const STOP_PAGE_SIZE = 50
export type MobileStopPage = {
  hits: MobileStopHit[]
  /** Stops in the whole place, from a facet; only the first page carries it. */
  total: number
  /** The cursor for the next page, or null on the last one. */
  next: string | null
}
/**
 * One page of a region's or area's stops. Meilisearch has no cursor API, so
 * paging is keyset: sorted by the document id, filtered to `id > after`,
 * with the total from the `kind` facet (never `totalHits`, capped at 1,000).
 */
export async function searchPlaceMobileStops(
  level: "area" | "region",
  slug: string,
  after: string | null = null
): Promise<MobileStopPage> {
  const scope = `${level === "area" ? "area_slug" : "region_slug"} = ${JSON.stringify(slug)}`
  const response = await meiliClient
    .index("mobile-stop")
    .search<MobileStopHit>("", {
      filter: after ? `${scope} AND id > ${JSON.stringify(after)}` : scope,
      limit: STOP_PAGE_SIZE,
      facets: ["kind"],
      sort: ["id:asc"],
    })
  const hits = response.hits

  return {
    hits,
    total: after ? 0 : (response.facetDistribution?.kind?.stop ?? 0),
    next: hits.length === STOP_PAGE_SIZE ? hits.at(-1)!.id : null,
  }
}
export const searchAreaMobileStops = (
  areaSlug: string,
  after: string | null = null
): Promise<MobileStopPage> => searchPlaceMobileStops("area", areaSlug, after)
export async function loadStopTimetable(
  hit: Pick<MobileStopHit, "library_document_id">,
  signal?: AbortSignal
): Promise<PublicMobileTimetable> {
  const response = await fetch(
    `/api/mobile/${encodeURIComponent(hit.library_document_id)}/timetable`,
    { signal }
  )
  if (!response.ok) throw new Error("The timetable could not be loaded.")

  return response.json()
}
export async function atlasMobileMultiSearch(query: string, locale?: string) {
  return meiliClient.multiSearch({
    queries: [
      {
        indexUid: "library",
        q: query,
        filter: searchLocaleFilter(locale),
        limit: 8,
        attributesToRetrieve: [
          "name",
          "documentId",
          "_geo",
          "slug",
          "continent_slug",
          "country_slug",
          "region_slug",
        ],
      },
      { indexUid: "mobile-stop", q: query, limit: 8 },
    ],
  })
}

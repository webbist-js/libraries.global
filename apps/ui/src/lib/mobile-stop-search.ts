import {
  addDays,
  localDateTime,
  todayKeys,
  toMinutes,
  visitRunsOn,
  weekdayOf,
  WEEKDAYS,
  type MobileFrequency,
  type PublicLiveState,
  type MobileVisit,
  type MobileTimetable,
} from "@repo/shared-data"

import type { AtlasFilters, Bounds } from "@/components/atlas/atlas.logic"
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
  frequencies?: MobileFrequency[]
}
export type MobileVisitFilter = "any" | "today" | "week" | "live"
export type MobileViewport = {
  stops: MobileStopHit[]
  clusters: { lat: number; lng: number; count: number }[]
  total: number
  zoomIn: boolean
  sharesLiveCount?: number
}

export type MobileStopFilters = Pick<
  AtlasFilters,
  | "networks"
  | "opening"
  | "atDay"
  | "atMinutes"
  | "mobileFrequency"
  | "mobileSharesLive"
>

/** Vehicle updates take precedence over the published visit times. */
export function stopMatchesOpening(
  stop: MobileStopHit,
  filters: MobileStopFilters,
  now: Date,
  live?: PublicLiveState
): boolean {
  if (filters.opening === "any") return true
  if (
    filters.opening === "now" &&
    live?.sharesLive &&
    ["here", "road", "late"].includes(live.kind)
  )
    return live.stopId === stop.stop_id && live.kind !== "road"
  const local = localDateTime(now, stop.timezone)
  const date =
    filters.opening === "at"
      ? addDays(
          local.date,
          (filters.atDay - WEEKDAYS.indexOf(weekdayOf(local.date)) + 7) % 7
        )
      : local.date
  if (stop.cancelled_dates.includes(date)) return false
  const minute = filters.opening === "at" ? filters.atMinutes : local.minute
  const tt: MobileTimetable = {
    version: 1,
    cycle: stop.cycle,
    stops: [],
    visits: stop.visits,
  }

  return stop.visits.some(
    (visit) =>
      visitRunsOn(tt, visit, date) &&
      toMinutes(visit.arrive) <= minute &&
      toMinutes(visit.depart) > minute
  )
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
  _zoom: number,
  mode: MobileVisitFilter,
  now = new Date(),
  filters?: MobileStopFilters
): Promise<MobileViewport> {
  const index = meiliClient.index("mobile-stop"),
    base = viewportFilter(bounds)
  let filter = base
  if (filters?.networks?.length)
    filter += ` AND network_ids IN ${JSON.stringify(filters.networks)}`
  if (filters?.mobileFrequency?.length)
    filter += ` AND frequencies IN [${filters.mobileFrequency.map((value) => JSON.stringify(value)).join(",")}]`
  if (filters?.mobileSharesLive) filter += " AND shares_live = true"
  if (mode === "today" || mode === "week" || filters?.opening === "now") {
    const zones = await index.search("", {
      filter,
      limit: 0,
      facets: ["timezone"],
    })
    const zoneClauses = Object.keys(
      zones.facetDistribution?.timezone ?? {}
    ).map((tz) => {
      const date = localDateTime(now, tz).date,
        dates =
          mode !== "week"
            ? [date]
            : Array.from({ length: 7 }, (_, i) => addDays(date, i))

      return `(timezone = ${JSON.stringify(tz)} AND (${dates.map(visitDateFilter).join(" OR ")}))`
    })
    if (!zoneClauses.length)
      return { stops: [], clusters: [], total: 0, zoomIn: false }
    const scheduled = `(${zoneClauses.join(" OR ")})`
    // A crew may be at a stop outside its published visit date.
    filter +=
      filters?.opening === "now" && (mode === "any" || mode === "live")
        ? ` AND (${scheduled} OR shares_live = true)`
        : ` AND ${scheduled}`
  }
  if (mode === "live") filter += " AND shares_live = true"
  const response = await index.search<MobileStopHit>("", {
    filter,
    // Keep actual coordinates at every zoom when the viewport fits the cap.
    // MapLibre clusters these points, so a small service never jumps to a grid centre.
    limit: 1000,
    facets: ["geo_cell", "kind", "shares_live"],
    sort: ["name:asc"],
  })
  const total = response.facetDistribution?.kind?.stop ?? 0
  const cells = Object.entries(
    response.facetDistribution?.geo_cell ?? {}
  ).slice(0, 100)
  // Above the cap, anchor each aggregate on an actual stop nearest its cell
  // centre. Counts remain facets; never download the worldwide stop list.
  const aggregates =
    total > 1000
      ? await meiliClient.multiSearch({
          queries: cells.map(([key]) => {
            const [lat, lng] = key.split(",").map(Number)

            return {
              indexUid: "mobile-stop",
              q: "",
              filter: `${filter} AND geo_cell = ${JSON.stringify(key)}`,
              sort: [`_geoPoint(${lat! + 0.5}, ${lng! + 0.5}):asc`],
              limit: 1,
              attributesToRetrieve: ["_geo"],
            }
          }),
        })
      : null
  const clusters =
    aggregates?.results.flatMap((result, i) => {
      const point = result.hits[0]?._geo

      return point ? [{ ...point, count: cells[i]![1] }] : []
    }) ?? []

  return {
    stops: total > 1000 ? [] : response.hits,
    clusters,
    total,
    zoomIn: total > 1000,
    sharesLiveCount: response.facetDistribution?.shares_live?.true ?? 0,
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
  services?: number | null
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
      facets: after ? ["kind"] : ["kind", "library_document_id"],
      sort: ["id:asc"],
    })
  const hits = response.hits

  return {
    hits,
    total: after ? 0 : (response.facetDistribution?.kind?.stop ?? 0),
    services:
      after ||
      !response.facetDistribution?.library_document_id ||
      Object.keys(response.facetDistribution.library_document_id).length >=
        10000
        ? null
        : Object.keys(response.facetDistribution.library_document_id).length,
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
          "libraryType",
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

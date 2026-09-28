import "server-only"

import {
  distanceKm,
  type LatLng,
  type OpeningTimesValue,
  opensOn,
} from "@/components/library/library-page.helpers"
import { buildLibraryPath } from "@/lib/library-helpers"
import { logNonBlockingError } from "@/lib/logging"
import { meiliClient } from "@/lib/meilisearch"

/** A neighbouring library, numbered on the hero map and in the list. */
export interface AreaNeighbour {
  id: string
  name: string
  href: string | null
  libraryType: string | null
  city: string | null
  lat: number | null
  lng: number | null
  /** Straight-line distance from this library, when both have coordinates. */
  km: number | null
}

/** "In the area" figures, all counted from the index. */
export interface LibraryAreaData {
  neighbours: AreaNeighbour[]
  /** Published libraries in the region, this one included. */
  regionTotal: number | null
  /** Other libraries within WITHIN_KM, when this one has coordinates. */
  withinRadius: number | null
  /** Region libraries open on Sundays, and whether this one is. */
  sundays: { open: number; total: number; includesThis: boolean } | null
}

export const WITHIN_KM = 5
const NEIGHBOUR_RADIUS_M = 50_000
// A region page shows at most this many libraries; enough for the tally.
const REGION_SCAN_LIMIT = 1000

type Hit = {
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
  city?: string | null
  continent_slug?: string | null
  country_slug?: string | null
  region_slug?: string | null
  openingTimes?: OpeningTimesValue | null
  _geo?: { lat: number | string; lng: number | string } | null
}

const NEIGHBOUR_FIELDS = [
  "documentId",
  "name",
  "slug",
  "libraryType",
  "city",
  "continent_slug",
  "country_slug",
  "region_slug",
  "_geo",
]

function toNeighbour(hit: Hit, from: LatLng | null): AreaNeighbour {
  const lat = hit._geo ? Number(hit._geo.lat) : null
  const lng = hit._geo ? Number(hit._geo.lng) : null
  const at =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null

  return {
    id: hit.documentId,
    name: hit.name,
    href: buildLibraryPath({
      slug: hit.slug,
      continent: { slug: hit.continent_slug },
      country: { slug: hit.country_slug },
      region: { slug: hit.region_slug },
    }),
    libraryType: hit.libraryType ?? null,
    city: hit.city ?? null,
    lat: at?.lat ?? null,
    lng: at?.lng ?? null,
    km: at && from ? distanceKm(from, at) : null,
  }
}

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e: unknown) {
    logNonBlockingError({
      message: "Error fetching library area figures",
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}

/**
 * The library page's "In the area" data: the three nearest libraries (by
 * straight line, or others in the region without coordinates), the region
 * total, how many are within WITHIN_KM and how many open on Sundays.
 */
export async function fetchLibraryArea({
  slug,
  regionSlug,
  location,
  openingTimes,
  neighbours = 3,
}: {
  slug: string
  regionSlug?: string | null
  location: LatLng | null
  openingTimes: OpeningTimesValue | null
  neighbours?: number
}): Promise<LibraryAreaData> {
  const index = meiliClient.index("library")
  // `slug` isn't filterable in the index, so this library is dropped from
  // the results here rather than in the query.
  const others = <H extends { slug: string }>(hits: H[] | undefined) =>
    (hits ?? []).filter((h) => h.slug !== slug)
  const inRegion = regionSlug
    ? `region_slug = ${JSON.stringify(regionSlug)}`
    : null

  const [near, within, region] = await Promise.all([
    settle(
      location
        ? index.search<Hit>("", {
            filter: `_geoRadius(${location.lat}, ${location.lng}, ${NEIGHBOUR_RADIUS_M})`,
            sort: [`_geoPoint(${location.lat}, ${location.lng}):asc`],
            limit: neighbours + 1,
            attributesToRetrieve: NEIGHBOUR_FIELDS,
          })
        : inRegion
          ? index.search<Hit>("", {
              filter: inRegion,
              sort: ["name:asc"],
              limit: neighbours + 1,
              attributesToRetrieve: NEIGHBOUR_FIELDS,
            })
          : Promise.resolve(null)
    ),
    settle(
      location
        ? index.search<{ slug: string }>("", {
            filter: `_geoRadius(${location.lat}, ${location.lng}, ${WITHIN_KM * 1000})`,
            limit: REGION_SCAN_LIMIT,
            attributesToRetrieve: ["slug"],
          })
        : Promise.resolve(null)
    ),
    settle(
      inRegion
        ? index.search<Hit>("", {
            filter: inRegion,
            limit: REGION_SCAN_LIMIT,
            attributesToRetrieve: ["slug", "openingTimes"],
          })
        : Promise.resolve(null)
    ),
  ])

  const regionHits = region?.hits ?? []
  const regionTotal = region
    ? (region.estimatedTotalHits ?? regionHits.length)
    : null
  // Count Sundays only when every region library was read.
  const sundays =
    region && regionHits.length === regionTotal
      ? {
          open: regionHits.filter((h) => opensOn(h.openingTimes, "sunday"))
            .length,
          total: regionHits.length,
          includesThis: opensOn(openingTimes, "sunday"),
        }
      : null

  return {
    neighbours: others(near?.hits)
      .slice(0, neighbours)
      .map((h) => toNeighbour(h, location)),
    regionTotal,
    withinRadius: within ? others(within.hits).length : null,
    sundays,
  }
}

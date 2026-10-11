import "server-only"

import {
  addDays,
  localDateTime,
  WEEKDAYS,
  ATLAS_OPEN_FRAMES_PER_DAY,
} from "@repo/shared-data"

import {
  distanceKm,
  type LatLng,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { buildLibraryPath } from "@/lib/library-helpers"
import { logNonBlockingError } from "@/lib/logging"
import { meiliClient, withSearchLocale } from "@/lib/meilisearch"

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
  neighboursUnavailable?: boolean
  sameRegion?: boolean
  /** Published libraries in the region, this one included. */
  regionTotal: number | null
  /** Other libraries within WITHIN_KM, when this one has coordinates. */
  withinRadius: number | null
  /** Region libraries open on Sundays, and whether this one is. */
  sundays: { open: number; total: number; includesThis: boolean } | null
}

export const WITHIN_KM = 5
const NEIGHBOUR_RADIUS_M = WITHIN_KM * 1000

type Hit = {
  closed_dates?: string[]
  open_tz?: string | null
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
  documentId,
  entityRef,
  regionSlug,
  location,
  openingTimes: _openingTimes,
  neighbours = 3,
  locale,
}: {
  slug: string
  documentId?: string
  entityRef?: string | null
  regionSlug?: string | null
  location: LatLng | null
  openingTimes: OpeningTimesValue | null
  neighbours?: number
  /** Route locale: every count and neighbour comes from one locale's documents. */
  locale?: string | null
}): Promise<LibraryAreaData> {
  const index = meiliClient.index("library")
  const scope = ['operationalStatus NOT IN ["permanently_closed","planned"]']
  const identity = [
    ...(documentId ? [`documentId != ${JSON.stringify(documentId)}`] : []),
    ...(entityRef ? [`entityRef != ${JSON.stringify(entityRef)}`] : []),
  ]
  const geographic = [...scope, 'libraryType NOT IN ["Digital","Mobile"]']
  const inRegion = regionSlug
    ? `region_slug = ${JSON.stringify(regionSlug)}`
    : null
  const radius = location
    ? `_geoRadius(${location.lat}, ${location.lng}, ${NEIGHBOUR_RADIUS_M})`
    : null
  const exact = (
    result:
      | {
          facetDistribution?: Record<string, Record<string, number>>
        }
      | null
      | undefined
  ) =>
    result?.facetDistribution?.locale
      ? Object.values(result.facetDistribution.locale).reduce(
          (sum, count) => sum + count,
          0
        )
      : null
  const [near, within, region] = await Promise.all([
    settle(
      radius || inRegion
        ? index.search<Hit>("", {
            filter: withSearchLocale(
              [...geographic, ...identity, radius ?? inRegion!],
              locale
            ),
            sort: location
              ? [`_geoPoint(${location.lat}, ${location.lng}):asc`]
              : ["name:asc"],
            limit: neighbours + (identity.length ? 0 : 1),
            attributesToRetrieve: NEIGHBOUR_FIELDS,
          })
        : Promise.resolve(null)
    ),
    settle(
      radius
        ? index.search("", {
            filter: withSearchLocale(
              [...geographic, ...identity, radius],
              locale
            ),
            limit: 0,
            facets: ["locale"],
          })
        : Promise.resolve(null)
    ),
    settle(
      inRegion
        ? index.search("", {
            filter: withSearchLocale([...scope, inRegion], locale),
            limit: 0,
            facets: ["locale", "open_tz"],
          })
        : Promise.resolve(null)
    ),
  ])
  const regionTotal = exact(region)
  const zones = Object.keys(region?.facetDistribution?.open_tz ?? {})
  let sundays: LibraryAreaData["sundays"] = null
  if (inRegion && zones.length && zones.length <= 32) {
    const current = new Date()
    const valid = `(clock_valid_until_ts IS NULL OR clock_valid_until_ts NOT EXISTS OR clock_valid_until_ts > ${Math.floor(current.getTime() / 1000)})`
    const availableSchedule = [
      ...geographic,
      inRegion,
      "has_effective_hours = true",
      'operationalStatus NOT IN ["temporarily_closed","appointment_only"]',
      valid,
    ]
    const sundayClauses = zones.flatMap((zone) => {
      try {
        const local = localDateTime(current, zone)
        const sunday = addDays(local.date, 6 - WEEKDAYS.indexOf(local.weekday))
        const intervals = Array.from(
          { length: ATLAS_OPEN_FRAMES_PER_DAY },
          (_, n) => `(open_sun_${n}_from EXISTS AND open_sun_${n}_to > 0)`
        ).join(" OR ")

        return [
          `(open_tz = ${JSON.stringify(zone)} AND (${intervals}) AND NOT closed_dates = ${JSON.stringify(sunday)})`,
        ]
      } catch {
        return []
      }
    })
    const sundayFilter = `(${sundayClauses.join(" OR ")})`
    if (sundayClauses.length) {
      const figures = await settle(
        meiliClient.multiSearch({
          queries: [
            {
              indexUid: "library",
              filter: withSearchLocale(availableSchedule, locale),
              limit: 0,
              facets: ["locale"],
            },
            {
              indexUid: "library",
              filter: withSearchLocale(
                [...availableSchedule, sundayFilter],
                locale
              ),
              limit: 0,
              facets: ["locale"],
            },
            ...(documentId
              ? [
                  {
                    indexUid: "library",
                    filter: withSearchLocale(
                      [
                        ...availableSchedule,
                        sundayFilter,
                        `documentId = ${JSON.stringify(documentId)}`,
                      ],
                      locale
                    ),
                    limit: 1,
                    attributesToRetrieve: ["documentId"],
                  },
                ]
              : []),
          ],
        })
      )
      if (figures?.results.length === (documentId ? 3 : 2)) {
        const total = exact(figures.results[0]),
          open = exact(figures.results[1])
        if (total !== null && open !== null && total > 0)
          sundays = {
            total,
            open,
            includesThis: Boolean(figures.results[2]?.hits.length),
          }
      }
    }
  }

  return {
    neighboursUnavailable: Boolean((radius || inRegion) && !near),
    sameRegion: !location,
    neighbours: (near?.hits ?? [])
      .filter((hit) => hit.slug !== slug)
      .slice(0, neighbours)
      .map((h) => toNeighbour(h, location)),
    regionTotal,
    withinRadius: exact(within),
    sundays,
  }
}

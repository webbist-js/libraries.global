/**
 * Find libraries search: one page of hits plus exact counts, all answered by
 * Meilisearch, so the page never loads the whole index. Totals come from the
 * `locale` facet because `totalHits` stops at the index's maxTotalHits.
 *
 * The filters read fields the library index derives for this page
 * (apps/strapi/src/utils/library-search-fields.ts): `has_hours`, `has_iiif`,
 * `needs`, `completeness`, `open_tz` and `open_<ddd>_<n>_from|to`. The
 * Location filter's place names come from `distinct` searches on the
 * `<level>_slug` fields, one library per place.
 */
import { isGapKey, type GapKey } from "@repo/shared-data"

import {
  type FindPlaceLevel,
  FIND_PLACE_LEVELS,
  nameFromSlug,
} from "@/lib/find-places"
import { localDayMinute } from "@/lib/local-time"
import {
  type LibrarySearchHit,
  meiliClient,
  searchLocale,
  searchLocaleFilter,
} from "@/lib/meilisearch"

export { localDayMinute } from "@/lib/local-time"

export interface LibrarySearchHitV2 extends LibrarySearchHit {
  openingTimes?: unknown
  timezone?: string | null
  iiifEndpoint?: string | null
  completeness?: number | null
}

export type FindSort = "complete" | "gaps" | "name" | "near"

export interface FindQuery {
  query?: string
  place?: { level: FindPlaceLevel; slug: string }
  libraryTypes?: string[]
  accessibilityNames?: string[]
  serviceNames?: string[]
  digital?: boolean
  openNow?: boolean
  needs?: string[]
  nearLat?: number
  nearLng?: number
  /** metres; omit for any distance */
  nearRadius?: number
  /** URL-only filter for drive links: a dataset's key. */
  source?: string
  sort?: FindSort
  /** 0-based */
  page?: number
  hitsPerPage?: number
  locale?: string
  now?: Date
}

export interface FindPlaceRef {
  slug: string
  name: string
  /** The country's Region labels (country level only). */
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  /** A Region's own Area labels, where it names its Areas (region level only). */
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

export interface FindPlaceOption extends FindPlaceRef {
  /** Libraries there that match every other filter. */
  count: number
}

/**
 * The Location filter: the chosen place and its parents, and the places
 * each level can switch to. A level lists the places under the chosen
 * parent that match the other filters, plus the chosen one.
 */
export interface FindLocation extends Partial<
  Record<FindPlaceLevel, FindPlaceRef>
> {
  continents: FindPlaceOption[]
  countries: FindPlaceOption[]
  regions: FindPlaceOption[]
  areas: FindPlaceOption[]
}

export interface FindResult {
  hits: LibrarySearchHitV2[]
  /** Exact number of matching records. */
  total: number
  /** Pages Meilisearch will serve: maxTotalHits caps deep paging. */
  pageCount: number
  facets: {
    libraryType: Record<string, number>
    accessibility: Record<string, number>
    services: Record<string, number>
    needs: Record<string, number>
    hoursKnown: number
    digital: number
    openNow: number
  }
  location: FindLocation
}

/** The library index's pagination.maxTotalHits. */
export const FIND_MAX_REACHABLE = 1000

/**
 * Most places a level lists. A country with more regions than the index
 * will return in one search lists the first FIND_MAX_REACHABLE.
 */
const PLACE_LIMIT: Record<FindPlaceLevel, number> = {
  continent: 20,
  country: 300,
  region: FIND_MAX_REACHABLE,
  area: FIND_MAX_REACHABLE,
}

/** The opening-times normaliser allows six timeframes a day. */
const FRAMES_PER_DAY = 6

const RETRIEVE = [
  "id",
  "documentId",
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "libraryType",
  "operationalStatus",
  "city",
  "featured",
  "continent_slug",
  "continent_name",
  "country_slug",
  "country_name",
  "region_slug",
  "region_name",
  "foundedYear",
  "operatorType",
  "heroImage",
  "openingTimes",
  "timezone",
  "iiifEndpoint",
  "completeness",
  "accessibility_names",
  "service_names",
  "_geo",
]

const FACETS = [
  "libraryType",
  "accessibility_names",
  "service_names",
  "needs",
  "has_hours",
  "has_iiif",
  "locale",
]

const quoted = (values: readonly string[]) =>
  `[${values.map((v) => JSON.stringify(v)).join(", ")}]`

/** A library must have every ticked option. */
const allOf = (field: string, values: readonly string[]) =>
  values.map((v) => `${field} = ${JSON.stringify(v)}`).join(" AND ")

/**
 * Library type and Needs match any ticked option, so ticking one adds
 * libraries: each counts its options in its own search, under every other
 * filter. Accessibility and services match every ticked option, so the main
 * search's counts already say what ticking one narrows to.
 */
const ANY_OF = [
  { key: "libraryTypes", facet: "libraryType" },
  { key: "needs", facet: "needs" },
] as const

/**
 * "Open now": each zone's libraries checked against that zone's own weekday
 * and minute. Zones sharing a local time share one clause.
 */
export function openNowFilter(zones: string[], now: Date): string {
  const groups = new Map<
    string,
    { day: string; minute: number; zones: string[] }
  >()
  for (const zone of zones) {
    const local = localDayMinute(zone, now)
    if (!local) continue
    const key = `${local.day}:${local.minute}`
    const group = groups.get(key) ?? { ...local, zones: [] }
    group.zones.push(zone)
    groups.set(key, group)
  }
  if (groups.size === 0) return 'open_tz = "__none__"'

  const clauses = [...groups.values()].map(({ day, minute, zones: z }) => {
    const frames = Array.from(
      { length: FRAMES_PER_DAY },
      (_, n) =>
        `(open_${day}_${n}_from <= ${minute} AND open_${day}_${n}_to > ${minute})`
    ).join(" OR ")

    return `(open_tz IN ${quoted(z)} AND (${frames}))`
  })

  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(" OR ")})`
}

const placeClause = (place: NonNullable<FindQuery["place"]>) =>
  `${place.level}_slug = ${JSON.stringify(place.slug)}`

export function findFilter(q: FindQuery, zones: string[]): string {
  const parts: string[] = []
  if (q.place) parts.push(placeClause(q.place))
  if (q.libraryTypes?.length)
    parts.push(`libraryType IN ${quoted(q.libraryTypes)}`)
  if (q.accessibilityNames?.length)
    parts.push(allOf("accessibility_names", q.accessibilityNames))
  if (q.serviceNames?.length) parts.push(allOf("service_names", q.serviceNames))
  if (q.digital) parts.push("has_iiif = true")
  if (q.needs?.length) parts.push(`needs IN ${quoted(q.needs)}`)
  if (q.nearLat != null && q.nearLng != null && q.nearRadius != null)
    parts.push(`_geoRadius(${q.nearLat}, ${q.nearLng}, ${q.nearRadius})`)
  if (q.openNow) parts.push(openNowFilter(zones, q.now ?? new Date()))
  if (q.source) parts.push(`source = ${JSON.stringify(q.source)}`)
  parts.push(searchLocaleFilter(q.locale))

  return parts.join(" AND ")
}

export function findSort(q: FindQuery): string[] {
  if (q.sort === "near" && q.nearLat != null && q.nearLng != null)
    return [`_geoPoint(${q.nearLat}, ${q.nearLng}):asc`]
  if (q.sort === "name") return ["name:asc"]
  if (q.sort === "gaps") return ["completeness:asc", "name:asc"]

  return ["completeness:desc", "name:asc"]
}

const CACHE_TTL_MS = 10 * 60 * 1000
const CACHE_MAX = 500
const cache = new Map<string, { at: number; value: Promise<unknown> }>()

/**
 * One shared answer per key for ten minutes, for lookups that don't depend
 * on the filters. A failed lookup is forgotten; the oldest key goes first.
 */
export function cached<V>(key: string, load: () => Promise<V>): Promise<V> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as Promise<V>
  const value = load()
  value.catch(() => cache.delete(key))
  cache.delete(key)
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(key, { at: Date.now(), value })

  return value
}

/** Every opening-hours zone in the index, from a facet. */
function openZones(locale?: string): Promise<string[]> {
  return cached(`zones:${searchLocale(locale)}`, () =>
    meiliClient
      .index("library")
      .search("", {
        filter: searchLocaleFilter(locale),
        limit: 0,
        facets: ["open_tz"],
      })
      .then((res) => Object.keys(res.facetDistribution?.open_tz ?? {}))
  )
}

function placeRef(
  hit: Record<string, unknown> | undefined,
  level: FindPlaceLevel
): FindPlaceRef | undefined {
  const slug = hit?.[`${level}_slug`]
  const name = hit?.[`${level}_name`]
  if (typeof slug !== "string" || slug === "") return undefined

  return {
    slug,
    name: typeof name === "string" && name ? name : nameFromSlug(slug),
  }
}

type PlaceChain = Partial<Record<FindPlaceLevel, FindPlaceRef>>

/** The chosen place and its parents, read off any one library there. */
function placeChain(
  place: FindQuery["place"],
  locale?: string
): Promise<PlaceChain> {
  if (!place) return Promise.resolve({})
  const levels = FIND_PLACE_LEVELS.slice(
    0,
    FIND_PLACE_LEVELS.indexOf(place.level) + 1
  )

  return cached(
    `chain:${searchLocale(locale)}:${place.level}:${place.slug}`,
    () =>
      meiliClient
        .index("library")
        .search("", {
          filter: `${placeClause(place)} AND ${searchLocaleFilter(locale)}`,
          limit: 1,
          attributesToRetrieve: levels.flatMap((l) =>
            l === "country"
              ? [
                  `${l}_slug`,
                  `${l}_name`,
                  "country_region_label",
                  "country_regions_label",
                ]
              : [`${l}_slug`, `${l}_name`]
          ),
        })
        .then((res) => {
          const chain: PlaceChain = {}
          for (const level of levels) {
            const ref = placeRef(res.hits?.[0], level)
            if (ref) chain[level] = ref
          }
          // A place with no libraries still names itself.
          chain[place.level] ??= {
            slug: place.slug,
            name: nameFromSlug(place.slug),
          }

          const hit = res.hits?.[0] as Record<string, unknown> | undefined
          if (chain.country && hit) {
            const label = hit.country_region_label
            const section = hit.country_regions_label
            chain.country = {
              ...chain.country,
              ...(typeof label === "string" ? { regionTypeLabel: label } : {}),
              ...(typeof section === "string"
                ? { regionsSectionLabel: section }
                : {}),
            }
          }

          return chain
        })
  )
}

const NO_PLACES = Promise.resolve(new Map<string, string>())

/** Every place at `level` under `parent`, slug → name. */
function placeNames(
  level: FindPlaceLevel,
  parent: FindQuery["place"],
  locale?: string
): Promise<Map<string, string>> {
  const scope = parent ? [placeClause(parent)] : []

  return cached(
    `names:${searchLocale(locale)}:${level}:${parent ? placeClause(parent) : ""}`,
    () =>
      meiliClient
        .index("library")
        .search("", {
          filter: [...scope, searchLocaleFilter(locale)].join(" AND "),
          distinct: `${level}_slug`,
          limit: PLACE_LIMIT[level],
          attributesToRetrieve: [`${level}_slug`, `${level}_name`],
        })
        .then(
          (res) =>
            new Map(
              (res.hits ?? []).flatMap((hit) => {
                const ref = placeRef(hit, level)

                return ref ? [[ref.slug, ref.name] as const] : []
              })
            )
        )
  )
}

/** The places that match the other filters, and the chosen one, by name. */
function placeOptions(
  names: Map<string, string>,
  counts: Record<string, number> | undefined,
  chosen: FindPlaceRef | undefined
): FindPlaceOption[] {
  const options = [...names].flatMap(([slug, name]) => {
    const count = counts?.[slug] ?? 0

    return count > 0 || slug === chosen?.slug ? [{ slug, name, count }] : []
  })
  if (chosen && !names.has(chosen.slug)) {
    options.push({ ...chosen, count: counts?.[chosen.slug] ?? 0 })
  }

  return options.sort((a, b) => a.name.localeCompare(b.name))
}

type Distribution = Record<string, Record<string, number>> | undefined

const countOf = (dist: Distribution, facet: string) =>
  Object.values(dist?.[facet] ?? {}).reduce((sum, n) => sum + n, 0)

export async function searchFind(q: FindQuery): Promise<FindResult> {
  const hitsPerPage = q.hitsPerPage ?? 24
  const [zones, chain] = await Promise.all([
    openZones(q.locale),
    placeChain(q.place, q.locale),
  ])
  const base = { indexUid: "library", q: q.query ?? "" }
  // The Location filter counts each place under every other filter.
  const anywhere = findFilter({ ...q, place: undefined }, zones)
  const continent = chain.continent && {
    level: "continent" as const,
    slug: chain.continent.slug,
  }
  const country = chain.country && {
    level: "country" as const,
    slug: chain.country.slug,
  }
  const region = chain.region && {
    level: "region" as const,
    slug: chain.region.slug,
  }
  const anyOf = ANY_OF.filter(({ key }) => q[key]?.length)
  const [{ results }, names] = await Promise.all([
    meiliClient.multiSearch({
      queries: [
        {
          ...base,
          filter: findFilter(q, zones),
          sort: findSort(q),
          page: (q.page ?? 0) + 1,
          hitsPerPage,
          facets: FACETS,
          attributesToRetrieve: RETRIEVE,
        },
        {
          ...base,
          filter: findFilter({ ...q, openNow: true }, zones),
          limit: 0,
          facets: ["locale"],
        },
        {
          ...base,
          filter: anywhere,
          limit: 0,
          facets: ["continent_slug", "country_slug"],
        },
        ...(country
          ? [
              {
                ...base,
                filter: `${placeClause(country)} AND ${anywhere}`,
                limit: 0,
                facets: ["region_slug"],
              },
            ]
          : []),
        ...(region
          ? [
              {
                ...base,
                filter: `${placeClause(region)} AND ${anywhere}`,
                limit: 0,
                facets: ["area_slug"],
              },
            ]
          : []),
        ...anyOf.map(({ key, facet }) => ({
          ...base,
          filter: findFilter({ ...q, [key]: undefined }, zones),
          limit: 0,
          facets: [facet],
        })),
      ],
    }),
    Promise.all([
      placeNames("continent", undefined, q.locale),
      continent ? placeNames("country", continent, q.locale) : NO_PLACES,
      country ? placeNames("region", country, q.locale) : NO_PLACES,
      region ? placeNames("area", region, q.locale) : NO_PLACES,
    ]),
  ])
  const [main, open, places, ...more] = results as unknown as {
    hits?: LibrarySearchHitV2[]
    facetDistribution?: Distribution
  }[]
  const regions = country ? more[0] : undefined
  const areaIdx = country ? 1 : 0
  const areas = region ? more[areaIdx] : undefined
  const own = more.slice(areaIdx + (region ? 1 : 0))
  const dist = main?.facetDistribution
  const total = countOf(dist, "locale")
  const countsOf = (facet: string) => {
    const i = anyOf.findIndex((g) => g.facet === facet)

    return (i === -1 ? dist : own[i]?.facetDistribution)?.[facet] ?? {}
  }
  /** A ticked option stays listed, at 0 when nothing has it, to untick. */
  const withTicked = (facet: string, ticked: string[] = []) => ({
    ...Object.fromEntries(ticked.map((name) => [name, 0])),
    ...countsOf(facet),
  })

  return {
    hits: main?.hits ?? [],
    total,
    pageCount: Math.max(
      1,
      Math.ceil(Math.min(total, FIND_MAX_REACHABLE) / hitsPerPage)
    ),
    facets: {
      libraryType: countsOf("libraryType"),
      accessibility: withTicked("accessibility_names", q.accessibilityNames),
      services: withTicked("service_names", q.serviceNames),
      needs: countsOf("needs"),
      hoursKnown: dist?.has_hours?.true ?? 0,
      digital: dist?.has_iiif?.true ?? 0,
      openNow: countOf(open?.facetDistribution, "locale"),
    },
    location: {
      ...chain,
      continents: placeOptions(
        names[0],
        places?.facetDistribution?.continent_slug,
        chain.continent
      ),
      countries: placeOptions(
        names[1],
        places?.facetDistribution?.country_slug,
        chain.country
      ),
      regions: placeOptions(
        names[2],
        regions?.facetDistribution?.region_slug,
        chain.region
      ),
      areas: placeOptions(
        names[3],
        areas?.facetDistribution?.area_slug,
        chain.area
      ),
    },
  }
}

/** Every published library in the route's search locale: an exact count. */
export async function libraryTotal(locale?: string): Promise<number> {
  const res = await meiliClient.index("library").search("", {
    filter: searchLocaleFilter(locale),
    limit: 0,
    facets: ["locale"],
  })

  return countOf(res.facetDistribution as Distribution, "locale")
}

/**
 * A place's exact record count and gap counts, from one `limit: 0` search
 * faceted on `needs` and `locale`. `total` is every library there (the
 * `locale` facet); `gaps` is the `needs` distribution narrowed to gap keys
 * (the facet also carries non-gap `needs` values). Null when the search
 * fails, so callers fall back to their own computation.
 */
export async function placeGapCounts(
  level: FindPlaceLevel,
  slug: string,
  locale?: string
): Promise<{ total: number; gaps: Partial<Record<GapKey, number>> } | null> {
  try {
    const res = await meiliClient.index("library").search("", {
      filter: `${placeClause({ level, slug })} AND ${searchLocaleFilter(locale)}`,
      limit: 0,
      facets: ["needs", "locale"],
    })
    const dist = res.facetDistribution as Distribution
    const gaps = Object.fromEntries(
      Object.entries(dist?.needs ?? {}).filter(([key]) => isGapKey(key))
    ) as Partial<Record<GapKey, number>>

    return { total: countOf(dist, "locale"), gaps }
  } catch {
    return null
  }
}

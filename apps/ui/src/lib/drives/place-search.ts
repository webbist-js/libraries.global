/**
 * The drive builder's place search (`GET /api/drives/places?q=`): places
 * at every level whose name matches what was typed, from the Meilisearch
 * `library` index, so only places with libraries come back. Countries,
 * regions and areas come from one `multiSearch` (each query restricted to
 * one name field, one hit per place with `distinct`); continents from a
 * facet search on `continent_slug`, whose names are their slugs as words.
 * Pure ranking below, so it's testable without Meilisearch.
 */
import type { DrivePlaceLevel } from "@repo/shared-data"

import { nameFromSlug } from "@/lib/find-places"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"

/** At most this many places come back. */
export const PLACE_SEARCH_LIMIT = 8

/** Longest query read; the rest is ignored. */
export const PLACE_QUERY_MAX = 80

export interface PlaceOption {
  level: DrivePlaceLevel
  slug: string
  name: string
  /** Where it is: "{Region}, {Country}" for an area, "{Country}" for a region, "{Continent}" for a country. */
  context: string
  /** What the country calls this level ("County", "State"), for regions. */
  kind?: string
}

const LEVEL_ORDER: Record<DrivePlaceLevel, number> = {
  continent: 0,
  country: 1,
  region: 2,
  area: 3,
}

/** Lower case without accents, for matching what was typed. */
const fold = (s: string) =>
  s.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase().trim()

/** 0 for an exact name, 1 when it starts with the query, 2 when a word does, else 3. */
function matchRank(name: string, query: string): number {
  const n = fold(name)
  const q = fold(query)
  if (!q) return 3
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.split(/[\s,-]+/).some((word) => word.startsWith(q))) return 2

  return 3
}

/**
 * The places to offer, best first: each place once (by level and slug),
 * exact names, then names that start with the query, then a word that
 * does, then the rest; broader levels first at the same rank, otherwise in
 * Meilisearch's order. At most `PLACE_SEARCH_LIMIT`.
 */
export function rankPlaces(
  query: string,
  candidates: readonly PlaceOption[]
): PlaceOption[] {
  const seen = new Set<string>()
  const unique = candidates.filter((p) => {
    const key = `${p.level}:${p.slug}`
    if (!p.slug || !p.name || seen.has(key)) return false
    seen.add(key)

    return true
  })

  return unique
    .map((place, index) => ({
      place,
      index,
      rank: matchRank(place.name, query),
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        LEVEL_ORDER[a.place.level] - LEVEL_ORDER[b.place.level] ||
        a.index - b.index
    )
    .slice(0, PLACE_SEARCH_LIMIT)
    .map(({ place }) => place)
}

type Hit = Record<string, unknown>

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")

const joinContext = (...parts: string[]) => parts.filter(Boolean).join(", ")

/** A search hit as the place it names at `level`, or null when it names none. */
export function placeFromHit(
  level: Exclude<DrivePlaceLevel, "continent">,
  hit: Hit
): PlaceOption | null {
  const slug = text(hit[`${level}_slug`])
  const name = text(hit[`${level}_name`])
  if (!slug || !name) return null

  switch (level) {
    case "area":
      return {
        level,
        slug,
        name,
        context: joinContext(text(hit.region_name), text(hit.country_name)),
      }
    case "region": {
      const kind = text(hit.country_region_label)

      return {
        level,
        slug,
        name,
        context: text(hit.country_name),
        ...(kind ? { kind } : {}),
      }
    }

    default:
      return { level, slug, name, context: text(hit.continent_name) }
  }
}

const SEARCH_LEVELS = ["country", "region", "area"] as const

/** What each level's query retrieves: its own slug and name, and its context. */
const RETRIEVE: Record<(typeof SEARCH_LEVELS)[number], string[]> = {
  country: ["country_slug", "country_name", "continent_name"],
  region: [
    "region_slug",
    "region_name",
    "country_name",
    "country_region_label",
  ],
  area: ["area_slug", "area_name", "region_name", "country_name"],
}

/**
 * Up to eight places matching `query` in the route locale's libraries.
 * Throws when Meilisearch can't be reached; a failed continent facet
 * search only leaves continents out.
 */
export async function searchPlaces(
  query: string,
  locale?: string
): Promise<PlaceOption[]> {
  const q = query.trim().slice(0, PLACE_QUERY_MAX)
  if (!q) return []
  const filter = searchLocaleFilter(locale)

  const [search, continents] = await Promise.all([
    meiliClient.multiSearch({
      queries: SEARCH_LEVELS.map((level) => ({
        indexUid: "library",
        q,
        filter,
        attributesToSearchOn: [`${level}_name`],
        attributesToRetrieve: RETRIEVE[level],
        distinct: `${level}_slug`,
        limit: PLACE_SEARCH_LIMIT,
      })),
    }),
    meiliClient
      .index("library")
      .searchForFacetValues({
        facetName: "continent_slug",
        facetQuery: q,
        filter,
      })
      .catch(() => null),
  ])

  const results = search.results as unknown as { hits?: Hit[] }[]
  const candidates: PlaceOption[] = [
    ...(continents?.facetHits ?? []).map((hit) => ({
      level: "continent" as const,
      slug: hit.value,
      name: nameFromSlug(hit.value),
      context: "",
    })),
    ...SEARCH_LEVELS.flatMap((level, i) =>
      (results[i]?.hits ?? []).flatMap((hit) => {
        const place = placeFromHit(level, hit)

        return place ? [place] : []
      })
    ),
  ]

  return rankPlaces(q, candidates)
}

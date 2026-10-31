import { Meilisearch, type SearchParams } from "meilisearch"

import {
  type LibraryIndexFilterState,
  DEFAULT_FILTERS,
} from "@/components/library-index/types"
import { LIVE_LOCALES } from "@/lib/live-locales"
import { routing } from "@/lib/routing"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// Browsers use the gated, search-only proxy. Credentials are server-only.
const host =
  typeof window === "undefined"
    ? (process.env.MEILISEARCH_HOST ?? "http://localhost:7700")
    : `${window.location.origin}/api/search`
const searchKey =
  typeof window === "undefined"
    ? (process.env.MEILISEARCH_SEARCH_API_KEY ?? "")
    : ""

export const meiliClient = new Meilisearch({ host, apiKey: searchKey })

// ── Locale ─────────────────────────────────────────────────────────────────────
// The library, Knowledge and Journal indexes hold every locale's version of a
// document, so every search on them names one locale.

/** The route locale when its content is live, else the default locale. */
export function searchLocale(routeLocale?: string | null): string {
  return routeLocale && LIVE_LOCALES.includes(routeLocale)
    ? routeLocale
    : routing.defaultLocale
}

/**
 * The `locale = "<x>"` clause every search of the library, Knowledge and
 * Journal indexes must carry, so a published translation never shows twice.
 * No route locale means the default locale.
 */
export function searchLocaleFilter(routeLocale?: string | null): string {
  return `locale = ${JSON.stringify(searchLocale(routeLocale))}`
}

/** A caller's own filter clauses joined with the locale clause. */
export function withSearchLocale(
  clauses: readonly (string | null | undefined | false)[],
  routeLocale?: string | null
): string {
  return [...clauses.filter(Boolean), searchLocaleFilter(routeLocale)].join(
    " AND "
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LibrarySearchHit {
  id: number
  documentId: string
  name: string
  slug: string
  entityRef?: string | null
  shortName?: string | null
  summary?: string | null
  libraryType?: string | null
  operationalStatus?: string | null
  city?: string | null
  featured?: boolean | null
  continent_slug?: string | null
  continent_name?: string | null
  country_slug?: string | null
  country_name?: string | null
  region_slug?: string | null
  region_name?: string | null
  foundedYear?: string | null
  operatorType?: string | null
  accessibility_names?: string[]
  service_names?: string[]
  heroImage?: {
    url?: string | null
    formats?: Record<string, { url?: string }>
  } | null
  _geo?: { lat: number; lng: number } | null
  _geoDistance?: number
}

export interface LibrarySearchParams {
  query?: string
  libraryTypes?: string[]
  operationalStatuses?: string[]
  continentSlugs?: string[]
  countrySlugs?: string[]
  regionSlugs?: string[]
  areaSlugs?: string[]
  featured?: boolean
  accessibilityNames?: string[]
  serviceNames?: string[]
  operatorTypes?: string[]
  sort?: "name:asc" | "name:desc" | "featured:desc,name:asc"
  page?: number
  hitsPerPage?: number
  withFacets?: boolean
  nearLat?: number
  nearLng?: number
  nearRadius?: number
  /** Route locale; see `searchLocale`. */
  locale?: string
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchLibraries(
  filters: LibraryIndexFilterState,
  options: { hitsPerPage?: number; withFacets?: boolean; locale?: string } = {}
) {
  const {
    query,
    libraryTypes,
    statuses: operationalStatuses,
    continentSlug,
    countrySlug,
    regionSlug,
    areaSlug,
    featured,
    accessibilityNames,
    serviceNames,
    operatorTypes,
    sort,
    page,
    nearLat,
    nearLng,
    nearRadius,
  } = filters

  const { hitsPerPage = 24, withFacets = false } = options

  const continentSlugs = continentSlug ? [continentSlug] : []
  const countrySlugs = countrySlug ? [countrySlug] : []
  const regionSlugs = regionSlug ? [regionSlug] : []
  const areaSlugs = areaSlug ? [areaSlug] : []

  const filterParts: string[] = []

  if (libraryTypes.length > 0) {
    filterParts.push(
      `libraryType IN [${libraryTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }
  if (operationalStatuses.length > 0) {
    filterParts.push(
      `operationalStatus IN [${operationalStatuses.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (continentSlugs.length > 0) {
    filterParts.push(
      `continent_slug IN [${continentSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (countrySlugs.length > 0) {
    filterParts.push(
      `country_slug IN [${countrySlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (regionSlugs.length > 0) {
    filterParts.push(
      `region_slug IN [${regionSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (areaSlugs.length > 0) {
    filterParts.push(
      `area_slug IN [${areaSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (featured === true) {
    filterParts.push(`featured = true`)
  }
  if (accessibilityNames.length > 0) {
    filterParts.push(
      `accessibility_names IN [${accessibilityNames.map((n) => JSON.stringify(n)).join(", ")}]`
    )
  }
  if (serviceNames.length > 0) {
    filterParts.push(
      `service_names IN [${serviceNames.map((n) => JSON.stringify(n)).join(", ")}]`
    )
  }
  if (operatorTypes.length > 0) {
    filterParts.push(
      `operatorType IN [${operatorTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }

  // Near-me: add geo radius filter and sort by distance
  if (nearLat != null && nearLng != null) {
    filterParts.push(`_geoRadius(${nearLat}, ${nearLng}, ${nearRadius})`)
  }
  filterParts.push(searchLocaleFilter(options.locale))

  const sortArr: string[] = []
  // Near-me overrides user sort — distance is always the primary sort
  if (nearLat != null && nearLng != null) {
    sortArr.push(`_geoPoint(${nearLat}, ${nearLng}):asc`)
  } else {
    switch (sort) {
      case "name:asc":
        sortArr.push("name:asc")
        break

      case "name:desc":
        sortArr.push("name:desc")
        break

      case "featured:desc,name:asc":
        sortArr.push("featured:desc", "name:asc")
        break

      // No default
    }
  }

  const index = meiliClient.index("library")

  return index.search<LibrarySearchHit>(query, {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: sortArr.length > 0 ? sortArr : undefined,
    page: page + 1,
    hitsPerPage,
    facets: withFacets
      ? [
          "continent_slug",
          "operationalStatus",
          "accessibility_names",
          "service_names",
          "operatorType",
        ]
      : undefined,
    attributesToRetrieve: [
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
    ],
  })
}

/** @deprecated Prefer searchLibraries with LibraryIndexFilterState. For map components only. */
export async function searchLibrariesByParams(params: LibrarySearchParams) {
  return searchLibraries(
    {
      ...DEFAULT_FILTERS,
      query: params.query ?? "",
      libraryTypes: params.libraryTypes ?? [],
      statuses: params.operationalStatuses ?? [],
      continentSlug: params.continentSlugs?.[0] ?? "",
      countrySlug: params.countrySlugs?.[0] ?? "",
      regionSlug: params.regionSlugs?.[0] ?? "",
      areaSlug: params.areaSlugs?.[0] ?? "",
      featured: params.featured ?? false,
      accessibilityNames: params.accessibilityNames ?? [],
      serviceNames: params.serviceNames ?? [],
      operatorTypes: params.operatorTypes ?? [],
      sort: params.sort ?? "featured:desc,name:asc",
      page: params.page ?? 0,
      nearLat: params.nearLat,
      nearLng: params.nearLng,
      nearRadius: params.nearRadius ?? DEFAULT_FILTERS.nearRadius,
    },
    {
      hitsPerPage: params.hitsPerPage,
      withFacets: params.withFacets,
      locale: params.locale,
    }
  )
}

/**
 * A small library lookup for pickers (find a library, tag an article, link
 * an event feed): one locale's documents, the caller's fields.
 */
export async function searchLibraryNames(
  query: string,
  opts: {
    hitsPerPage: number
    attributesToRetrieve: string[]
    filters?: string[]
    locale?: string | null
  }
) {
  return meiliClient.index("library").search<LibrarySearchHit>(query, {
    filter: withSearchLocale(opts.filters ?? [], opts.locale),
    hitsPerPage: opts.hitsPerPage,
    attributesToRetrieve: opts.attributesToRetrieve,
  })
}

// ── Homepage globe ───────────────────────────────────────────────────────────

/**
 * Hero-globe markers: one per 1° grid cell that has a library (a facet
 * count, so its size follows the map, not the index), plus every featured
 * library at its own position.
 */
export async function fetchGlobeMarkers(
  locale?: string,
  includeNames = false
): Promise<{ lat: number; lng: number; featured: boolean; name?: string }[]> {
  const index = meiliClient.index("library")
  const [cells, featured] = await Promise.all([
    index.search("", {
      filter: searchLocaleFilter(locale),
      limit: 0,
      facets: ["geo_cell"],
    }),
    index.search<LibrarySearchHit>("", {
      filter: withSearchLocale(["featured = true"], locale),
      limit: 200,
      attributesToRetrieve: includeNames ? ["_geo", "name"] : ["_geo"],
    }),
  ])
  const cellMarkers = Object.keys(
    cells.facetDistribution?.geo_cell ?? {}
  ).flatMap((cell) => {
    const [lat, lng] = cell.split(",").map(Number)

    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [{ lat: lat!, lng: lng!, featured: false }]
      : []
  })
  const featuredMarkers = featured.hits.flatMap((hit) =>
    hit._geo
      ? [
          {
            lat: hit._geo.lat,
            lng: hit._geo.lng,
            featured: true,
            ...(includeNames && hit.name ? { name: hit.name } : {}),
          },
        ]
      : []
  )

  return [...cellMarkers, ...featuredMarkers]
}

// ── Blog search ───────────────────────────────────────────────────────────────

export interface BlogArticleSearchHit {
  id: number
  documentId: string
  slug: string
  title?: string | null
  section_slug?: string | null
}

export async function searchBlogArticles(
  query: string,
  limit = 30,
  locale?: string
) {
  return meiliClient.index("blog-article").search<BlogArticleSearchHit>(query, {
    filter: searchLocaleFilter(locale),
    limit,
    attributesToRetrieve: ["id", "documentId", "slug", "title", "section_slug"],
  })
}

// ── Wiki search ────────────────────────────────────────────────────────────────

export interface WikiArticleSearchHit {
  id: number
  documentId: string
  slug: string
  title?: string | null
  summary?: string | null
  section_slug?: string | null
  section_name?: string | null
  category_slug?: string | null
}

export async function searchWikiArticles(
  query: string,
  sectionSlug?: string | null,
  limit = 30,
  locale?: string
) {
  return meiliClient.index("wiki-article").search<WikiArticleSearchHit>(query, {
    filter: [
      ...(sectionSlug ? [`section_slug = ${JSON.stringify(sectionSlug)}`] : []),
      searchLocaleFilter(locale),
    ].join(" AND "),
    limit,
    attributesToRetrieve: [
      "id",
      "documentId",
      "slug",
      "title",
      "summary",
      "section_slug",
      "section_name",
    ],
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildLibraryPath(
  hit: Pick<
    LibrarySearchHit,
    "continent_slug" | "country_slug" | "region_slug" | "slug"
  >
): string | null {
  const { continent_slug, country_slug, region_slug, slug } = hit
  if (continent_slug && country_slug && region_slug && slug) {
    return `/${continent_slug}/${country_slug}/${region_slug}/${slug}`
  }

  return null
}

export function libraryHeroUrl(hit: LibrarySearchHit): string | null {
  const raw =
    hit.heroImage?.formats?.small?.url ??
    hit.heroImage?.formats?.thumbnail?.url ??
    hit.heroImage?.url ??
    null

  return raw ? (formatStrapiMediaUrl(raw) ?? null) : null
}

// ── Events search ─────────────────────────────────────────────────────────────

export interface EventSearchHit {
  id: number
  documentId: string
  title: string
  summary?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  sourceProvider?: string | null
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  status: string
  /** Unix seconds — used for range filtering */
  startTimestamp?: number | null
  /** Denormalised from library relation */
  library_name?: string | null
  library_slug?: string | null
  library_city?: string | null
  library_country_code?: string | null
  library_country_slug?: string | null
  library_country_name?: string | null
  library_continent_slug?: string | null
  library_region_slug?: string | null
}

export interface EventSearchParams {
  timeSlots?: string[]
  facets?: string[]
  query?: string
  eventTypes?: string[]
  isFree?: boolean
  /** Unix seconds */
  fromTimestamp?: number
  /** Unix seconds */
  toTimestamp?: number
  /** ISO 3166-1 alpha-2 e.g. "GB" */
  countryCode?: string
  continentSlug?: string
  regionSlug?: string
  /** Only these statuses, e.g. upcoming and ongoing; every status when empty. */
  statuses?: string[]
  page?: number
  hitsPerPage?: number
}

export async function searchEvents(params: EventSearchParams = {}) {
  const {
    timeSlots = [],
    facets,
    query = "",
    eventTypes = [],
    isFree,
    fromTimestamp,
    toTimestamp,
    countryCode,
    continentSlug,
    regionSlug,
    statuses = [],
    page = 0,
    hitsPerPage = 20,
  } = params

  const filterParts: string[] = []

  if (eventTypes.length > 0) {
    filterParts.push(
      `eventType IN [${eventTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }
  if (timeSlots.length > 0)
    filterParts.push(
      `timeSlot IN [${timeSlots.map((slot) => JSON.stringify(slot)).join(", ")}]`
    )
  if (isFree === true) filterParts.push("isFree = true")
  if (isFree === false) filterParts.push("isFree = false")
  if (fromTimestamp != null)
    filterParts.push(`startTimestamp >= ${fromTimestamp}`)
  if (toTimestamp != null) filterParts.push(`startTimestamp <= ${toTimestamp}`)
  if (continentSlug)
    filterParts.push(
      `library_continent_slug = ${JSON.stringify(continentSlug)}`
    )
  if (countryCode)
    filterParts.push(
      `library_country_code = ${JSON.stringify(countryCode.toUpperCase())}`
    )
  if (regionSlug)
    filterParts.push(`library_region_slug = ${JSON.stringify(regionSlug)}`)
  if (statuses.length > 0) {
    filterParts.push(
      `status IN [${statuses.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }

  const index = meiliClient.index("event")

  return index.search<
    EventSearchHit,
    SearchParams & { page: number; hitsPerPage: number }
  >(query, {
    facets,
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: ["startTimestamp:asc"],
    page: page + 1,
    hitsPerPage,
    attributesToRetrieve: [
      "id",
      "documentId",
      "title",
      "summary",
      "url",
      "imageUrl",
      "startTime",
      "endTime",
      "allDay",
      "timezone",
      "eventType",
      "sourceProvider",
      "isFree",
      "priceMin",
      "priceMax",
      "status",
      "library_name",
      "library_slug",
      "library_city",
      "library_country_code",
      "library_country_slug",
      "library_country_name",
      "library_continent_slug",
      "library_region_slug",
    ],
  })
}

/**
 * The next public (upcoming or ongoing) events anywhere, soonest first,
 * starting within `days`. No index yet (nothing synced) or Meilisearch being
 * down reads as no events, so a page can simply leave its events out.
 */
export async function fetchUpcomingEvents({
  days,
  limit,
}: {
  days: number
  limit: number
}): Promise<EventSearchHit[]> {
  const now = Math.floor(Date.now() / 1000)
  try {
    const result = await searchEvents({
      fromTimestamp: now,
      toTimestamp: now + days * 24 * 60 * 60,
      statuses: ["upcoming", "ongoing"],
      hitsPerPage: limit,
    })

    return result.hits
  } catch {
    return []
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const OPERATIONAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "temporarily_closed", label: "Temporarily Closed" },
  { value: "permanently_closed", label: "Permanently Closed" },
  { value: "seasonal", label: "Seasonal" },
  { value: "appointment_only", label: "By Appointment" },
  { value: "planned", label: "Planned" },
  { value: "unknown", label: "Unknown" },
] as const

export { DEFAULT_LIBRARY_TYPES as LIBRARY_TYPES } from "@repo/shared-data"

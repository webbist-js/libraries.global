import { Meilisearch } from "meilisearch"

import {
  type LibraryIndexFilterState,
  DEFAULT_FILTERS,
} from "@/components/library-index/types"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

const host = process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? "http://localhost:7700"
const searchKey = process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY ?? ""

export const meiliClient = new Meilisearch({ host, apiKey: searchKey })

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
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchLibraries(
  filters: LibraryIndexFilterState,
  options: { hitsPerPage?: number; withFacets?: boolean } = {}
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
    { hitsPerPage: params.hitsPerPage, withFacets: params.withFacets }
  )
}

// ── Blog search ───────────────────────────────────────────────────────────────

export interface BlogArticleSearchHit {
  id: number
  documentId: string
  slug: string
  title?: string | null
  section_slug?: string | null
}

export async function searchBlogArticles(query: string, limit = 30) {
  return meiliClient.index("blog-article").search<BlogArticleSearchHit>(query, {
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
  limit = 30
) {
  return meiliClient.index("wiki-article").search<WikiArticleSearchHit>(query, {
    filter: sectionSlug ? `section_slug = "${sectionSlug}"` : undefined,
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

// ── Geo search ────────────────────────────────────────────────────────────────

export async function searchNearbyLibraries(
  lat: number,
  lng: number,
  excludeSlug: string,
  radiusMeters = 50_000,
  limit = 4
) {
  const index = meiliClient.index("library")

  return index.search<LibrarySearchHit>("", {
    filter: [
      `_geoRadius(${lat}, ${lng}, ${radiusMeters})`,
      `slug != "${excludeSlug}"`,
    ],
    limit,
    sort: [`_geoPoint(${lat}, ${lng}):asc`],
    attributesToRetrieve: [
      "id",
      "documentId",
      "name",
      "slug",
      "summary",
      "libraryType",
      "operationalStatus",
      "city",
      "continent_slug",
      "country_slug",
      "region_slug",
      "heroImage",
      "_geo",
    ],
  })
}

// ── Find-a-library v2 search ──────────────────────────────────────────────────
// Additive: richer hit shape (openingTimes/timezone/iiifEndpoint) for the
// client-side "open now" / completeness features on the Find-a-library page.

export interface LibrarySearchHitV2 extends LibrarySearchHit {
  openingTimes?: unknown
  timezone?: string | null
  iiifEndpoint?: string | null
}

const V2_RETRIEVE = [
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
  "accessibility_names",
  "service_names",
  "_geo",
]

const V2_FACETS = [
  "libraryType",
  "operationalStatus",
  "accessibility_names",
  "service_names",
  "continent_slug",
  "country_slug",
]

export interface SearchLibrariesV2Options {
  query?: string
  libraryTypes?: string[]
  accessibilityNames?: string[]
  serviceNames?: string[]
  nearLat?: number
  nearLng?: number
  /** metres; omit for no radius restriction (still sortable by distance) */
  nearRadius?: number
  sortByDistance?: boolean
  sort?: "name:asc" | "featured:desc,name:asc"
  page?: number
  hitsPerPage?: number
  /** fetch up to `limit` hits in one page for client-side filtering/sorting */
  bulkLimit?: number
  withFacets?: boolean
}

export async function searchLibrariesV2(opts: SearchLibrariesV2Options) {
  const filterParts: string[] = []
  if (opts.libraryTypes?.length) {
    filterParts.push(
      `libraryType IN [${opts.libraryTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }
  if (opts.accessibilityNames?.length) {
    filterParts.push(
      `accessibility_names IN [${opts.accessibilityNames.map((n) => JSON.stringify(n)).join(", ")}]`
    )
  }
  if (opts.serviceNames?.length) {
    filterParts.push(
      `service_names IN [${opts.serviceNames.map((n) => JSON.stringify(n)).join(", ")}]`
    )
  }
  if (opts.nearLat != null && opts.nearLng != null && opts.nearRadius != null) {
    filterParts.push(
      `_geoRadius(${opts.nearLat}, ${opts.nearLng}, ${opts.nearRadius})`
    )
  }

  const sortArr: string[] = []
  if (opts.sortByDistance && opts.nearLat != null && opts.nearLng != null) {
    sortArr.push(`_geoPoint(${opts.nearLat}, ${opts.nearLng}):asc`)
  } else if (opts.sort === "name:asc") {
    sortArr.push("name:asc")
  } else {
    sortArr.push("featured:desc", "name:asc")
  }

  const index = meiliClient.index("library")

  if (opts.bulkLimit) {
    return index.search<LibrarySearchHitV2>(opts.query ?? "", {
      filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
      sort: sortArr,
      limit: opts.bulkLimit,
      facets: opts.withFacets ? V2_FACETS : undefined,
      attributesToRetrieve: V2_RETRIEVE,
    })
  }

  return index.search<LibrarySearchHitV2>(opts.query ?? "", {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: sortArr,
    page: (opts.page ?? 0) + 1,
    hitsPerPage: opts.hitsPerPage ?? 24,
    facets: opts.withFacets ? V2_FACETS : undefined,
    attributesToRetrieve: V2_RETRIEVE,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildLibraryPath(hit: LibrarySearchHit): string | null {
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
  page?: number
  hitsPerPage?: number
}

export async function searchEvents(params: EventSearchParams = {}) {
  const {
    query = "",
    eventTypes = [],
    isFree,
    fromTimestamp,
    toTimestamp,
    countryCode,
    continentSlug,
    regionSlug,
    page = 0,
    hitsPerPage = 20,
  } = params

  const filterParts: string[] = []

  if (eventTypes.length > 0) {
    filterParts.push(
      `eventType IN [${eventTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }
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

  const index = meiliClient.index("event")

  return index.search<EventSearchHit>(query, {
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

// ── Constants ──────────────────────────────────────────────────────────────────

export const LIBRARY_TYPES = [
  "National",
  "Public",
  "Academic",
  "University",
  "Parliamentary",
  "State",
  "Municipal",
  "Special",
  "Monastic",
  "Archive",
  "Private",
  "Cultural",
  "Digital",
  "Mobile",
  "Other",
] as const

export const OPERATIONAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "temporarily_closed", label: "Temporarily Closed" },
  { value: "permanently_closed", label: "Permanently Closed" },
  { value: "seasonal", label: "Seasonal" },
  { value: "appointment_only", label: "By Appointment" },
  { value: "planned", label: "Planned" },
  { value: "unknown", label: "Unknown" },
] as const

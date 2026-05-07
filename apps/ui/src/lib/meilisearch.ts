import { Meilisearch } from "meilisearch"

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
  countrySlugs?: string[] // NEW
  regionSlugs?: string[] // NEW
  areaSlugs?: string[] // NEW
  featured?: boolean // NEW — filter featured = true
  sort?: "name:asc" | "name:desc" | "featured:desc,name:asc" // NEW
  page?: number
  hitsPerPage?: number
  withFacets?: boolean // NEW — request continent_slug facet distribution
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchLibraries(params: LibrarySearchParams = {}) {
  const {
    query = "",
    libraryTypes = [],
    operationalStatuses = [],
    continentSlugs = [],
    countrySlugs = [],
    regionSlugs = [],
    areaSlugs = [],
    featured,
    sort,
    page = 0,
    hitsPerPage = 24,
    withFacets = false,
  } = params

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

  const sortArr: string[] = []
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

  const index = meiliClient.index("library")

  return index.search<LibrarySearchHit>(query, {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: sortArr.length > 0 ? sortArr : undefined,
    page: page + 1,
    hitsPerPage,
    facets: withFacets ? ["continent_slug", "operationalStatus"] : undefined,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildLibraryPath(hit: LibrarySearchHit): string | null {
  const { continent_slug, country_slug, region_slug, slug } = hit
  if (continent_slug && country_slug && region_slug && slug) {
    return `/${continent_slug}/${country_slug}/${region_slug}/${slug}`
  }

  return null
}

export function libraryHeroUrl(hit: LibrarySearchHit): string | null {
  return (
    hit.heroImage?.formats?.small?.url ??
    hit.heroImage?.formats?.thumbnail?.url ??
    hit.heroImage?.url ??
    null
  )
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

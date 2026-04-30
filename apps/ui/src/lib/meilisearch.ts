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
  heroImage?: {
    url?: string | null
    formats?: Record<string, { url?: string }>
  } | null
}

export interface LibrarySearchParams {
  query?: string
  libraryTypes?: string[]
  operationalStatuses?: string[]
  continentSlugs?: string[]
  page?: number
  hitsPerPage?: number
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchLibraries(params: LibrarySearchParams = {}) {
  const {
    query = "",
    libraryTypes = [],
    operationalStatuses = [],
    continentSlugs = [],
    page = 0,
    hitsPerPage = 24,
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

  const index = meiliClient.index("library")

  return index.search<LibrarySearchHit>(query, {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    page: page + 1, // MeiliSearch pages are 1-indexed
    hitsPerPage,
    attributesToRetrieve: [
      "id",
      "documentId",
      "name",
      "slug",
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
      "heroImage",
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

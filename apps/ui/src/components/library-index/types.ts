// apps/ui/src/components/library-index/types.ts

export interface LibraryIndexStats {
  totalLibraries: number
  totalCountries: number
  totalRegions: number
  percentOpen: number
}

export interface LibraryIndexFilterState {
  query: string
  /** Raw Strapi libraryType enum values e.g. ["National", "Parliamentary"] */
  libraryTypes: string[]
  /** operationalStatus enum values e.g. ["open", "temporarily_closed"] */
  statuses: string[]
  continentSlug: string
  countrySlug: string
  regionSlug: string
  areaSlug: string
  featured: boolean
  /** Accessibility option names e.g. ["Wheelchair access", "Accessible toilets"] */
  accessibilityNames: string[]
  /** Service / facility names e.g. ["Café", "Study spaces"] */
  serviceNames: string[]
  /** operatorType enum values e.g. ["National Government", "University"] */
  operatorTypes: string[]
  sort: "featured:desc,name:asc" | "name:asc" | "name:desc"
  page: number
  /** Near-me geo search — lat/lng from browser geolocation */
  nearLat?: number
  nearLng?: number
  /** Radius in metres for near-me search, default 80 467 (50 miles) */
  nearRadius: number
}

export const DEFAULT_FILTERS: LibraryIndexFilterState = {
  query: "",
  libraryTypes: [],
  statuses: [],
  continentSlug: "",
  countrySlug: "",
  regionSlug: "",
  areaSlug: "",
  featured: false,
  accessibilityNames: [],
  serviceNames: [],
  operatorTypes: [],
  sort: "featured:desc,name:asc",
  page: 0,
  nearLat: undefined,
  nearLng: undefined,
  nearRadius: 80_467,
}

/** Parse URLSearchParams into LibraryIndexFilterState */
export function filtersFromParams(
  params: URLSearchParams
): LibraryIndexFilterState {
  const typeParam = params.get("type")
  const statusParam = params.get("status")
  const accessParam = params.get("access")
  const serviceParam = params.get("service")
  const operatorParam = params.get("operator")

  return {
    query: params.get("q") ?? "",
    libraryTypes: typeParam ? typeParam.split(",").filter(Boolean) : [],
    statuses: statusParam ? statusParam.split(",").filter(Boolean) : [],
    continentSlug: params.get("continent") ?? "",
    countrySlug: params.get("country") ?? "",
    regionSlug: params.get("region") ?? "",
    areaSlug: params.get("area") ?? "",
    featured: params.get("featured") === "1",
    accessibilityNames: accessParam
      ? accessParam.split(",").filter(Boolean)
      : [],
    serviceNames: serviceParam ? serviceParam.split(",").filter(Boolean) : [],
    operatorTypes: operatorParam
      ? operatorParam.split(",").filter(Boolean)
      : [],

    nearLat: params.get("nlat") ? Number(params.get("nlat")) : undefined,
    nearLng: params.get("nlng") ? Number(params.get("nlng")) : undefined,
    nearRadius: params.get("nr") ? Number(params.get("nr")) : 80_467,

    sort: (() => {
      const s = params.get("sort")
      const valid: LibraryIndexFilterState["sort"][] = [
        "featured:desc,name:asc",
        "name:asc",
        "name:desc",
      ]

      return valid.includes(s as LibraryIndexFilterState["sort"])
        ? (s as LibraryIndexFilterState["sort"])
        : "featured:desc,name:asc"
    })(),
    page: Number(params.get("page") ?? "0"),
  }
}

/** Serialise LibraryIndexFilterState to URLSearchParams */
export function filtersToParams(f: LibraryIndexFilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query) p.set("q", f.query)
  if (f.libraryTypes.length > 0) p.set("type", f.libraryTypes.join(","))
  if (f.statuses.length > 0) p.set("status", f.statuses.join(","))
  if (f.continentSlug) p.set("continent", f.continentSlug)
  if (f.countrySlug) p.set("country", f.countrySlug)
  if (f.regionSlug) p.set("region", f.regionSlug)
  if (f.areaSlug) p.set("area", f.areaSlug)
  if (f.featured) p.set("featured", "1")
  if (f.accessibilityNames.length > 0)
    p.set("access", f.accessibilityNames.join(","))
  if (f.serviceNames.length > 0) p.set("service", f.serviceNames.join(","))
  if (f.operatorTypes.length > 0) p.set("operator", f.operatorTypes.join(","))
  if (f.sort !== "featured:desc,name:asc") p.set("sort", f.sort)
  if (f.page > 0) p.set("page", String(f.page))
  if (f.nearLat != null) p.set("nlat", String(f.nearLat))
  if (f.nearLng != null) p.set("nlng", String(f.nearLng))
  if (f.nearRadius !== 80_467) p.set("nr", String(f.nearRadius))

  return p
}

/** Check whether any non-default filter is active */
export function hasActiveFilters(f: LibraryIndexFilterState): boolean {
  return (
    f.query !== "" ||
    f.libraryTypes.length > 0 ||
    f.statuses.length > 0 ||
    f.continentSlug !== "" ||
    f.countrySlug !== "" ||
    f.regionSlug !== "" ||
    f.areaSlug !== "" ||
    f.featured ||
    f.accessibilityNames.length > 0 ||
    f.serviceNames.length > 0 ||
    f.operatorTypes.length > 0 ||
    f.nearLat != null
  )
}

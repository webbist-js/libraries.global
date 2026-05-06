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
  sort: "featured:desc,name:asc" | "name:asc" | "name:desc"
  page: number
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
  sort: "featured:desc,name:asc",
  page: 0,
}

/** Parse URLSearchParams into LibraryIndexFilterState */
export function filtersFromParams(
  params: URLSearchParams
): LibraryIndexFilterState {
  const typeParam = params.get("type")
  const statusParam = params.get("status")

  return {
    query: params.get("q") ?? "",
    libraryTypes: typeParam ? typeParam.split(",").filter(Boolean) : [],
    statuses: statusParam ? statusParam.split(",").filter(Boolean) : [],
    continentSlug: params.get("continent") ?? "",
    countrySlug: params.get("country") ?? "",
    regionSlug: params.get("region") ?? "",
    areaSlug: params.get("area") ?? "",
    featured: params.get("featured") === "1",

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
  if (f.sort !== "featured:desc,name:asc") p.set("sort", f.sort)
  if (f.page > 0) p.set("page", String(f.page))

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
    f.featured
  )
}

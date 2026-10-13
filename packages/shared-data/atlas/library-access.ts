import type { AtlasBounds, AtlasQueryMetadata, AtlasScope } from "./contracts"
import type {
  AtlasPerCapitaCountry,
  AtlasPopulationBaseline,
} from "./per-capita"

import localGeography from "./data/local-geography.json"

export type AtlasAccessMetric = "per100k" | "peoplePerLibrary"
export type AtlasAccessLevel = "auto" | "countries" | "local"
export interface AtlasLocalGeography {
  version: string
  geometryUrl: string
  boundarySource: string
  boundaryUrl: string
  boundaryLicence: string
  boundaryYear: number
  countries: string[]
  areas: { code: string; name: string; country: string; bounds: AtlasBounds }[]
}
export const atlasLocalGeography: AtlasLocalGeography = localGeography
export interface AtlasLibraryAccessArea extends AtlasPerCapitaCountry {
  /** Stable reporting-unit identity; ISO3 for countries, source code for local areas. */
  id: string
  level: "countries" | "local"
  country: string
  populationYear: number
  populationSource: string
  populationSourceUrl: string
  populationLicence: string
  populationRetrievedAt: string
  peoplePerLibrary: number | null
}
export interface AtlasLibraryAccessResponse extends AtlasQueryMetadata {
  scope: AtlasScope
  level: "countries" | "local"
  areas: AtlasLibraryAccessArea[]
  baseline: Omit<AtlasPopulationBaseline, "countries">
  geometry: {
    type: "geojson" | "pmtiles"
    url: string
    property: "iso3" | "code"
  }
  exactTotal: number
  unmappedLibraries: number
  coverage: { countries: string[]; note: string }
  summary: {
    libraryCount: number
    population: number
    per100k: number | null
    countries: number
  }
}

/** No matching libraries has no finite reciprocal; never show it as zero people. */
export function atlasPeoplePerLibrary(
  libraries: number,
  population: number | null
): number | null {
  if (!Number.isSafeInteger(libraries) || libraries < 0)
    throw new RangeError("Invalid library numerator")
  if (population === null || population === 0 || libraries === 0) return null
  if (!Number.isSafeInteger(population) || population < 0)
    throw new RangeError("Invalid population denominator")

  return population / libraries
}

export const ATLAS_ACCESS_BINS = [
  { min: 0, label: "Under 2", inverse: "Over 50k", color: "#E9E7FB" },
  { min: 2, label: "2–<4", inverse: "25k–50k", color: "#BEB8EE" },
  { min: 4, label: "4–<7", inverse: "14.3k–25k", color: "#9187DE" },
  { min: 7, label: "7–<12", inverse: "8.3k–14.3k", color: "#5D4CC4" },
  { min: 12, label: "12+", inverse: "Up to 8.3k", color: "#30217F" },
] as const
export function atlasAccessColor(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate) || rate < 0) return "#D8D4CA"

  return [...ATLAS_ACCESS_BINS].reverse().find((bin) => rate >= bin.min)!.color
}

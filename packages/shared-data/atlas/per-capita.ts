import type { AtlasBounds, AtlasQueryMetadata, AtlasScope } from "./contracts"

import geography from "./data/geography.json"

export interface AtlasPopulationCountry {
  iso3: string
  iso2: string | null
  name: string
  population: number | null
  featureId: number | null
  bounds: AtlasBounds | null
}
export interface AtlasPopulationBaseline {
  version: string
  populationVersion?: string
  year: number
  retrievedAt: string
  populationSource: string
  populationUrl: string
  populationLicence: string
  boundarySource: string
  boundaryUrl: string
  boundaryLicence: string
  geometrySha256: string
  geometryUrl: string
  countries: AtlasPopulationCountry[]
}
export const atlasPopulationBaseline: AtlasPopulationBaseline = geography

export type AtlasPerCapitaStatus =
  | "available"
  | "missing_population"
  | "no_records"
export interface AtlasPerCapitaCountry extends AtlasPopulationCountry {
  libraryCount: number
  indexedCount: number
  per100k: number | null
  status: AtlasPerCapitaStatus
  smallPopulation: boolean
}
export interface AtlasCountryTiles {
  version: string
  url: string
  sourceLayer: "countries"
  maxZoom: number
  archiveBytes: number
  sha256: string
}
export interface AtlasPerCapitaResponse extends AtlasQueryMetadata {
  scope: AtlasScope
  baseline: Omit<AtlasPopulationBaseline, "countries">
  countries: AtlasPerCapitaCountry[]
  geometry: { type: "geojson" | "pmtiles"; url: string }
  exactTotal: number
  unmappedLibraries: number
  summary: {
    libraryCount: number
    population: number
    per100k: number | null
    countries: number
  }
}

/** No rounding before aggregation; missing/zero denominators never become zero rates. */
export function atlasPer100k(
  libraryCount: number,
  residents: number | null
): number | null {
  if (!Number.isSafeInteger(libraryCount) || libraryCount < 0)
    throw new RangeError("Invalid library numerator")
  if (residents === null || residents === 0) return null
  if (!Number.isSafeInteger(residents) || residents < 0)
    throw new RangeError("Invalid population denominator")

  return (libraryCount / residents) * 100000
}

export function atlasPerCapitaCountry(
  country: AtlasPopulationCountry,
  libraryCount: number,
  indexedCount: number
): AtlasPerCapitaCountry {
  if (!Number.isSafeInteger(indexedCount) || indexedCount < libraryCount)
    throw new RangeError("Invalid indexed baseline")
  const status =
    country.population === null || country.population <= 0
      ? "missing_population"
      : indexedCount === 0
        ? "no_records"
        : "available"

  return {
    ...country,
    libraryCount,
    indexedCount,
    status,
    per100k:
      status === "available"
        ? atlasPer100k(libraryCount, country.population)
        : null,
    smallPopulation: country.population !== null && country.population < 100000,
  }
}

// Fixed thresholds keep colours comparable after panning/filtering. Zero is distinct.
export const ATLAS_PER_CAPITA_BINS = [
  { min: 0, label: "0", color: "#F7FCF0" },
  { min: Number.MIN_VALUE, label: "<1", color: "#C6DBEF" },
  { min: 1, label: "1–<5", color: "#9ECAE1" },
  { min: 5, label: "5–<10", color: "#6BAED6" },
  { min: 10, label: "10–<25", color: "#3182BD" },
  { min: 25, label: "25+", color: "#08519C" },
] as const
export const ATLAS_PER_CAPITA_NO_DATA = "#C9C5BD"
export function atlasPerCapitaColor(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate) || rate < 0)
    return ATLAS_PER_CAPITA_NO_DATA

  return [...ATLAS_PER_CAPITA_BINS].reverse().find((bin) => rate >= bin.min)!
    .color
}

export function atlasPerCapitaSummary(countries: AtlasPerCapitaCountry[]) {
  let libraryCount = 0,
    residents = 0,
    count = 0
  for (const country of countries)
    if (country.status === "available") {
      libraryCount += country.libraryCount
      residents += country.population!
      count++
    }

  return {
    libraryCount,
    population: residents,
    per100k: atlasPer100k(libraryCount, residents),
    countries: count,
  }
}

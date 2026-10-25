import type { AtlasBounds } from "./contracts"

export type AtlasPopulationLevel = "countries" | "regions" | "local"
export interface AtlasPopulationDensityArea {
  id: string
  name: string
  population: number | null
  areaKm2: number | null
  peoplePerKm2: number | null
  year: number
  source: string
  sourceUrl: string
  licence: string
  bounds: AtlasBounds | null
}
export interface AtlasPopulationDensityResponse {
  schemaVersion: 1
  level: AtlasPopulationLevel
  populationVersion: string
  boundaryVersion: string
  geometry: {
    type: "geojson" | "pmtiles"
    url: string
    property: "iso3" | "code"
    sourceLayer?: string
  }
  areas: AtlasPopulationDensityArea[]
  areaMethod: string
  note: string
}

export const ATLAS_POPULATION_DENSITY_BINS = [
  { min: 0, label: "Under 50", color: "#F0F4E5" },
  { min: 50, label: "50–<200", color: "#D7E5B0" },
  { min: 200, label: "200–<1000", color: "#9DC776" },
  { min: 1000, label: "1000–<5000", color: "#57A266" },
  { min: 5000, label: "5000+", color: "#22634C" },
] as const

export function atlasPopulationDensity(
  population: number | null,
  areaKm2: number | null
): number | null {
  if (areaKm2 === null) return null
  if (!Number.isFinite(areaKm2) || areaKm2 <= 0)
    throw new RangeError("Invalid reporting area")
  if (population === null) return null
  if (!Number.isSafeInteger(population) || population < 0)
    throw new RangeError("Invalid resident count")

  return population / areaKm2
}

export function atlasPopulationDensityColor(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "#D8D4CA"

  return [...ATLAS_POPULATION_DENSITY_BINS]
    .reverse()
    .find((bin) => value >= bin.min)!.color
}

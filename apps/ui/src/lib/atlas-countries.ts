import { atlasPopulationBaseline, type GapKey } from "@repo/shared-data"

/** A country the Atlas can open and filter to (picker row). */
export type AtlasCountryOption = {
  documentId: string
  name: string
  slug: string
  iso2: string | null
  iso3: string | null
  /** The boundary it is drawn as (iso3 in the map's countries layer). */
  boundary: string | null
  continent: string | null
  /** Published libraries in the index. */
  libraries: number
}

/** A region or area option for the Atlas place filters. */
export type AtlasPlaceOption = {
  documentId: string
  name: string
  slug: string
  libraryCount: number
}

export type AtlasPlacesResponse = {
  regions: AtlasPlaceOption[]
  areas: AtlasPlaceOption[]
}

/** Where the country boundaries come from: the build's tiles or the GeoJSON. */
export type AtlasCountryGeometry =
  | { type: "pmtiles"; url: string; sourceLayer: string; property: "iso3" }
  | { type: "geojson"; url: string; property: "iso3" }

export type AtlasCountriesResponse = {
  geometry: AtlasCountryGeometry
  countries: AtlasCountryOption[]
}

export type AtlasCountrySource = {
  key: string
  name: string
  publisher: string | null
  licence: string | null
  licenceUrl: string | null
  sourceUrl: string | null
  count: number
}

/** Everything the Atlas country drawer shows. */
export type AtlasCountryDetail = {
  documentId: string
  name: string
  slug: string
  iso2: string | null
  iso3: string | null
  summary: string | null
  continent: { name: string; slug: string } | null
  population: {
    count: number
    year: number | null
    source: string | null
    sourceUrl: string | null
    licence: string | null
  } | null
  libraryCount: number | null
  libraryTypeCounts: { type: string; count: number }[] | null
  regionCount: number
  regions: { name: string; slug: string; libraryCount: number }[]
  /** Libraries by origin Dataset, largest first. */
  sources: AtlasCountrySource[]
  /** Libraries with no origin Dataset: added by contributors. */
  community: number
  gaps: Partial<Record<GapKey, number>>
}

type Bounds = { west: number; south: number; east: number; north: number }

const COUNTRIES = new Map(
  atlasPopulationBaseline.countries.map((country) => [country.iso3, country])
)
const BY_ISO2 = new Map(
  atlasPopulationBaseline.countries.map((country) => [country.iso2, country])
)
const BY_NAME = new Map(
  atlasPopulationBaseline.countries.map((country) => [
    country.name.toLowerCase(),
    country,
  ])
)
/** The UK's nations are separate records drawn inside one boundary. */
const UK_NATIONS = new Set(["england", "scotland", "wales", "northern-ireland"])

/**
 * Which boundary a country record is drawn as: its own iso3, else its iso2,
 * else its name; the UK's nations share the United Kingdom's.
 */
export function boundaryFor(country: {
  slug: string
  name: string
  iso2?: string | null
  iso3?: string | null
}): string | null {
  if (UK_NATIONS.has(country.slug)) return "GBR"
  if (country.iso3 && COUNTRIES.has(country.iso3)) return country.iso3
  if (country.iso2) {
    const found = BY_ISO2.get(country.iso2)
    if (found) return found.iso3
  }

  return BY_NAME.get(country.name.toLowerCase())?.iso3 ?? null
}

/** The boundary's own name, for a shape that maps to several records. */
export function boundaryName(iso3: string): string | null {
  return COUNTRIES.get(iso3)?.name ?? null
}

/** A country's bounding box from the boundary baseline, for fitting the map. */
export function countryBounds(iso3: string): Bounds | null {
  return (COUNTRIES.get(iso3)?.bounds as Bounds | undefined) ?? null
}

/** World Bank population from the baseline, when the record has none. */
export function baselinePopulation(iso3: string): number | null {
  return COUNTRIES.get(iso3)?.population ?? null
}

/** Libraries per 100,000 people, one decimal place. */
export function perHundredThousand(
  libraries: number | null,
  population: number | null
): number | null {
  if (!libraries || !population) return null

  return Math.round((libraries / population) * 1_000_000) / 10
}

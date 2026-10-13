import { createHash } from "node:crypto"

import {
  POPULATION_REFERENCE_YEAR,
  WORLD_BANK_COUNTRIES_URL,
  WORLD_BANK_POPULATION_URL,
} from "@repo/shared-data"

export const POPULATION_YEAR = POPULATION_REFERENCE_YEAR
export const POPULATION_URL = WORLD_BANK_POPULATION_URL
export const ECONOMIES_URL = WORLD_BANK_COUNTRIES_URL
export const BOUNDARIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson"

function page(input: any): any[] {
  if (
    !Array.isArray(input) ||
    input[0]?.pages !== 1 ||
    !Array.isArray(input[1]) ||
    input[0].total !== input[1].length
  )
    throw new Error("Incomplete World Bank response")

  return input[1]
}

/** Fixed-year observations only. Never substitute a different year or an aggregate. */
export function prepareAtlasPopulation(
  economies: unknown,
  observations: unknown,
  boundaries: any,
  retrievedAt: string
) {
  const countries = page(economies).filter((row) => row.region?.id !== "NA")
  const countryCodes = new Set(countries.map((row) => row.id))
  if (countries.length < 200 || countryCodes.size !== countries.length)
    throw new Error("Incomplete or duplicate World Bank economies")
  const values = new Map<string, number | null>()
  for (const row of page(observations)) {
    const code = row.countryiso3code
    if (!countryCodes.has(code)) continue
    if (
      values.has(code) ||
      row.date !== String(POPULATION_YEAR) ||
      row.indicator?.id !== "SP.POP.TOTL"
    )
      throw new Error("Duplicate or mismatched population observation")
    if (
      row.value !== null &&
      (!Number.isSafeInteger(row.value) || row.value <= 0)
    )
      throw new Error("Invalid population denominator")
    values.set(code, row.value)
  }
  if (values.size !== countryCodes.size)
    throw new Error("Incomplete country population observations")
  if (
    boundaries?.type !== "FeatureCollection" ||
    !Array.isArray(boundaries.features) ||
    boundaries.features.length < 200
  )
    throw new Error("Incomplete Natural Earth boundaries")
  const features: any[] = []
  const boundaryIso2 = new Map<string, string | null>()
  for (const feature of boundaries.features) {
    const p = feature.properties
    // EH fixes Natural Earth's -99 ISO placeholders (including France/Norway).
    const naturalCode = [p.ISO_A3_EH, p.ISO_A3, p.ADM0_A3].find((value) =>
      /^[A-Z]{3}$/.test(value ?? "")
    )
    // The World Bank uses XKX for Kosovo; Natural Earth uses KOS.
    const code = naturalCode === "KOS" ? "XKX" : naturalCode
    if (!code) throw new Error("Invalid boundary code")
    boundaryIso2.set(
      code,
      [p.ISO_A2_EH, p.ISO_A2].find((value) => /^[A-Z]{2}$/.test(value ?? "")) ??
        null
    )
    if (!["Polygon", "MultiPolygon"].includes(feature.geometry?.type))
      throw new Error("Invalid country geometry")
    const existing = features.find((f) => f.properties.iso3 === code)
    if (existing) {
      const polygons = (geometry: any) =>
        geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.coordinates
      existing.geometry = {
        type: "MultiPolygon",
        coordinates: [
          ...polygons(existing.geometry),
          ...polygons(feature.geometry),
        ],
      }
    } else
      features.push({
        type: "Feature",
        id: features.length + 1,
        properties: { iso3: code, name: p.ADMIN },
        geometry: feature.geometry,
      })
  }
  const records = new Map<string, any>()
  const boundsFor = (code: string) => {
    const feature = features.find((f) => f.properties.iso3 === code)
    if (!feature) return null
    const positions = feature.geometry.coordinates.flat(
      feature.geometry.type === "Polygon" ? 1 : 2
    ) as number[][]
    const bounds = { west: 180, south: 90, east: -180, north: -90 }
    for (const [lng, lat] of positions) {
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        Math.abs(lng!) > 180 ||
        Math.abs(lat!) > 90
      )
        throw new Error("Invalid boundary coordinate")
      bounds.west = Math.min(bounds.west, lng!)
      bounds.east = Math.max(bounds.east, lng!)
      bounds.south = Math.min(bounds.south, lat!)
      bounds.north = Math.max(bounds.north, lat!)
    }

    // Fit the shortest longitude arc, including countries crossing the dateline.
    // MapLibre accepts an east coordinate above 180 for an unwrapped viewport.
    const longitudes = [...new Set(positions.map(([lng]) => lng!))].sort(
      (a, b) => a - b
    )
    let largestGap = 0
    for (let i = 0; i < longitudes.length; i++) {
      const west = longitudes[(i + 1) % longitudes.length]!,
        east = longitudes[i]!,
        gap = (i === longitudes.length - 1 ? west + 360 : west) - east
      if (gap > largestGap) {
        largestGap = gap
        bounds.west = west
        bounds.east = east < west ? east + 360 : east
      }
    }

    return bounds
  }
  for (const country of countries) {
    if (
      !/^[A-Z]{3}$/.test(country.id) ||
      !/^[A-Z]{2}$/.test(country.iso2Code) ||
      records.has(country.id)
    )
      throw new Error("Invalid World Bank economy code")
    records.set(country.id, {
      iso3: country.id,
      iso2: country.iso2Code,
      name: country.name,
      // Runtime values live in Strapi. Geometry preparation validates the feed,
      // but never embeds population denominators in the deployed package.
      population: null,
      featureId:
        features.find((f) => f.properties.iso3 === country.id)?.id ?? null,
      bounds: boundsFor(country.id),
    })
  }
  // Retain territories without an observation as explicit no-data polygons.
  for (const f of features)
    if (!records.has(f.properties.iso3))
      records.set(f.properties.iso3, {
        iso3: f.properties.iso3,
        iso2: boundaryIso2.get(f.properties.iso3) ?? null,
        name: f.properties.name,
        population: null,
        featureId: f.id,
        bounds: boundsFor(f.properties.iso3),
      })
  const geojson = { type: "FeatureCollection", features }
  const geometryText = JSON.stringify(geojson)
  const geometryHash = createHash("sha256").update(geometryText).digest("hex")
  const rows = [...records.values()].sort((a, b) =>
    a.iso3.localeCompare(b.iso3)
  )
  const version = createHash("sha256")
    .update(JSON.stringify([POPULATION_YEAR, rows, geometryHash]))
    .digest("hex")
    .slice(0, 16)

  return {
    geojson,
    baseline: {
      version,
      year: POPULATION_YEAR,
      retrievedAt,
      populationSource:
        "World Bank · World Development Indicators (SP.POP.TOTL)",
      populationUrl: POPULATION_URL,
      populationLicence: "CC BY 4.0",
      boundarySource: "Natural Earth 5.1.2 · Admin 0 · 1:50m",
      boundaryUrl: BOUNDARIES_URL,
      boundaryLicence: "Public domain",
      geometrySha256: geometryHash,
      geometryUrl: `/atlas/countries-${geometryHash.slice(0, 16)}.geojson`,
      countries: rows,
    },
  }
}

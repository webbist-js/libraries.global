import { expect, it } from "vitest"

import { emptyAtlasFilters } from "../atlas/contracts"
import {
  atlasPopulationBaseline,
  atlasPer100k,
  atlasPerCapitaColor,
  atlasPerCapitaCountry,
  atlasPerCapitaSummary,
  ATLAS_PER_CAPITA_NO_DATA,
} from "../atlas/per-capita"
import { parseAtlasQueryRequest } from "../atlas/requests"

it("distinguishes a zero numerator from a missing/invalid denominator", () => {
  expect(atlasPer100k(12, 400000)).toBe(3)
  expect(atlasPer100k(0, 400000)).toBe(0)
  expect(atlasPer100k(12, null)).toBeNull()
  expect(atlasPer100k(12, 0)).toBeNull()
  expect(() => atlasPer100k(12, -1)).toThrow()
  expect(() => atlasPer100k(-1, 400000)).toThrow()
  expect(atlasPerCapitaColor(null)).toBe(ATLAS_PER_CAPITA_NO_DATA)
  expect(atlasPerCapitaColor(0)).not.toBe(ATLAS_PER_CAPITA_NO_DATA)
  expect(atlasPerCapitaColor(0.5)).not.toBe(atlasPerCapitaColor(5))
})

it("treats an unindexed country as a data gap and warns about small populations", () => {
  const country = {
    iso3: "TST",
    iso2: "TS",
    name: "Test",
    population: 1000,
    featureId: 1,
    bounds: null,
  }
  expect(atlasPerCapitaCountry(country, 0, 0)).toMatchObject({
    per100k: null,
    status: "no_records",
    smallPopulation: true,
  })
  expect(atlasPerCapitaCountry(country, 0, 12)).toMatchObject({
    per100k: 0,
    status: "available",
  })
  expect(() => atlasPerCapitaCountry(country, 13, 12)).toThrow()
})

it("computes a population-weighted comparison, excluding missing denominators", () => {
  const country = atlasPopulationBaseline.countries[0]!
  const rows = [
    atlasPerCapitaCountry({ ...country, population: 100000 }, 10, 10),
    atlasPerCapitaCountry({ ...country, population: 900000 }, 9, 9),
    atlasPerCapitaCountry({ ...country, population: null }, 900, 900),
  ]
  expect(atlasPerCapitaSummary(rows)).toMatchObject({
    libraryCount: 19,
    population: 1000000,
    countries: 2,
  })
  expect(atlasPerCapitaSummary(rows).per100k).toBeCloseTo(1.9)
})

it("keeps one population year, valid denominators and unique country identities", () => {
  const rows = atlasPopulationBaseline.countries
  expect(atlasPopulationBaseline.year).toBe(2024)
  expect(new Set(rows.map((c) => c.iso3)).size).toBe(rows.length)
  expect(rows.filter((c) => c.iso2 !== null).length).toBeGreaterThan(200)
  expect(rows.every((c) => c.population === null)).toBe(true)
  expect(
    rows.every(
      (c) =>
        c.population === null ||
        (Number.isSafeInteger(c.population) && c.population > 0)
    )
  ).toBe(true)
  expect(rows.some((c) => c.iso3 === "WLD")).toBe(false)
})

it("rejects partial-country requests and client-supplied population figures", () => {
  const request = {
    schemaVersion: 1,
    purpose: "perCapita",
    scope: {
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
  }
  expect(parseAtlasQueryRequest(request).purpose).toBe("perCapita")
  expect(() => parseAtlasQueryRequest({ ...request, population: 1 })).toThrow()
  expect(() =>
    parseAtlasQueryRequest({
      ...request,
      scope: {
        ...request.scope,
        bbox: { west: 0, east: 1, north: 1, south: 0 },
      },
    })
  ).toThrow("whole countries")
  expect(() =>
    parseAtlasQueryRequest({
      ...request,
      scope: { ...request.scope, place: { level: "region", id: "one" } },
    })
  ).toThrow("whole countries")
})

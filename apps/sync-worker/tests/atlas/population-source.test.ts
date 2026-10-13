import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { atlasPopulationBaseline } from "@repo/shared-data"
import { beforeAll, expect, it } from "vitest"

import { prepareAtlasPopulation } from "../../src/atlas/population-source"

let boundaries: any
const economies = atlasPopulationBaseline.countries
  .filter((country) => country.iso2 !== null)
  .map((country) => ({
    id: country.iso3,
    iso2Code: country.iso2,
    name: country.name,
    region: { id: "TEST" },
  }))
const observations = atlasPopulationBaseline.countries
  .filter((country) => country.iso2 !== null)
  .map((country) => ({
    countryiso3code: country.iso3,
    date: "2024",
    indicator: { id: "SP.POP.TOTL" },
    value: country.population,
  }))
const page = (rows: unknown[]) => [{ pages: 1, total: rows.length }, rows]
const retrieve = "2026-10-09T12:00:00Z"
const prepare = (rows = observations) =>
  prepareAtlasPopulation(page(economies), page(rows), boundaries, retrieve)

beforeAll(async () => {
  const file = path.resolve(
    "../ui/public",
    `.${atlasPopulationBaseline.geometryUrl}`
  )
  const bytes = await readFile(file)
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    atlasPopulationBaseline.geometrySha256
  )
  const source = JSON.parse(bytes.toString())
  boundaries = {
    ...source,
    features: source.features.map((feature: any) => ({
      ...feature,
      properties: {
        ADMIN: feature.properties.name,
        ISO_A2_EH: atlasPopulationBaseline.countries.find(
          (country) => country.iso3 === feature.properties.iso3
        )?.iso2,
        ISO_A3_EH:
          feature.properties.iso3 === "XKX" ? "KOS" : feature.properties.iso3,
      },
    })),
  }
})

it("reproduces the geography version without embedding population values", () => {
  const aggregate = {
    id: "WLD",
    iso2Code: "1W",
    name: "World",
    region: { id: "NA" },
  }
  const result = prepareAtlasPopulation(
    page([...economies, aggregate]),
    page([...observations, { ...observations[0]!, countryiso3code: "WLD" }]),
    boundaries,
    retrieve
  )
  expect(result.baseline.version).toBe(atlasPopulationBaseline.version)
  expect(
    result.baseline.countries.some((country) => country.iso3 === "WLD")
  ).toBe(false)
  expect(
    result.baseline.countries.find((country) => country.iso3 === "XKX")
      ?.population
  ).toBeNull()
  const fiji = result.baseline.countries.find(
    (country) => country.iso3 === "FJI"
  )!.bounds!
  expect(fiji.east - fiji.west).toBeLessThan(15)
  expect(fiji.east).toBeGreaterThan(180)
})

it("refuses partial pages and missing country observations", () => {
  expect(() =>
    prepareAtlasPopulation(
      [{ pages: 2, total: 500 }, economies],
      page(observations),
      boundaries,
      retrieve
    )
  ).toThrow("Incomplete World Bank")
  expect(() => prepare(observations.slice(1))).toThrow(
    "Incomplete country population"
  )
  expect(() =>
    prepareAtlasPopulation(
      page(economies.slice(0, 10)),
      page(observations),
      boundaries,
      retrieve
    )
  ).toThrow("Incomplete or duplicate")
})

it("refuses duplicate observations, mixed years and invalid denominators", () => {
  expect(() => prepare([...observations, observations[0]!])).toThrow(
    "Duplicate"
  )
  expect(() =>
    prepare([{ ...observations[0]!, date: "2023" }, ...observations.slice(1)])
  ).toThrow("mismatched")
  expect(() =>
    prepare([{ ...observations[0]!, value: 0 }, ...observations.slice(1)])
  ).toThrow("denominator")
  expect(() =>
    prepare([
      { ...observations[0]!, indicator: { id: "OTHER" } },
      ...observations.slice(1),
    ])
  ).toThrow("mismatched")
})

it("keeps explicit missing populations and no-data territories", () => {
  const result = prepare([
    { ...observations[0]!, value: null },
    ...observations.slice(1),
  ])
  expect(
    result.baseline.countries.find(
      (country) => country.iso3 === observations[0]!.countryiso3code
    )?.population
  ).toBeNull()
  expect(
    result.baseline.countries.find((country) => country.iso3 === "ATA")
      ?.population
  ).toBeNull()
})

import { expect, it } from "vitest"

import { atlasPopulationBaseline } from "../atlas/per-capita"
import {
  aggregatePopulation,
  populationCountryCode,
  worldBankPopulation,
  worldBankWorldPopulation,
  type PopulationObservation,
} from "../population"

const countries = atlasPopulationBaseline.countries
  .filter((row) => row.iso2 !== null)
  .map((row) => ({
    id: row.iso3,
    iso2Code: row.iso2,
    name: row.name,
    region: { id: "TEST" },
  }))
const values = countries.map((row) => ({
  countryiso3code: row.id,
  date: "2024",
  indicator: { id: "SP.POP.TOTL" },
  value: 100000,
}))
const page = (rows: unknown[]) => [{ pages: 1, total: rows.length }, rows]
const retrieved = "2026-10-09T12:00:00Z"
const prepare = (rows = values) =>
  worldBankPopulation(page(countries), page(rows), retrieved)

it("retains observation year and provenance, excluding geographic aggregate rows", () => {
  const observations = worldBankPopulation(
    page([...countries, { id: "WLD", region: { id: "NA" } }]),
    page([...values, { ...values[0], countryiso3code: "WLD" }]),
    retrieved
  )
  expect(observations).toHaveLength(countries.length)
  expect(observations[0]).toMatchObject({
    year: 2024,
    retrievedAt: retrieved,
    licence: "CC BY 4.0",
    method: "direct",
    population: 100000,
  })
  expect(observations.some((row) => row.reportingCode === "WLD")).toBe(false)
  expect(
    worldBankWorldPopulation(
      page([{ ...values[0], countryiso3code: "WLD" }]),
      retrieved
    )
  ).toMatchObject({ level: "world", reportingCode: "WLD" })
})

it("rejects partial, duplicate, wrong-year and invalid source observations before writing", () => {
  expect(() => prepare(values.slice(1))).toThrow("Incomplete")
  expect(() => prepare([...values, values[0]!])).toThrow("Duplicate")
  for (const patch of [
    { date: "2023" },
    { value: 0 },
    { value: -1 },
    { value: 1.5 },
  ]) {
    expect(() =>
      prepare([{ ...values[0]!, ...patch }, ...values.slice(1)])
    ).toThrow()
  }
  expect(() =>
    worldBankPopulation([{ pages: 2 }, countries], page(values), retrieved)
  ).toThrow("Incomplete")
  expect(() => worldBankWorldPopulation(page(values), retrieved)).toThrow(
    "world observation"
  )
})

it("joins UK nations as parent reporting units without assigning them national populations", () => {
  const observations = prepare()
  for (const iso2 of ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"])
    expect(populationCountryCode({ iso2 }, observations)).toEqual({
      code: "GBR",
      parent: true,
    })
  expect(() =>
    populationCountryCode({ iso2: "GB", iso3: "USA" }, observations)
  ).toThrow("Conflicting")
  expect(() =>
    populationCountryCode({ iso2: "GB-ENG", iso3: "USA" }, observations)
  ).toThrow("Conflicting")
  expect(populationCountryCode({ iso2: "ZZ" }, observations)).toBeNull()
})

it("refuses missing and mixed-year totals and counts repeated parent reporting units only once", () => {
  const observations = prepare()
  const uk = observations.find((row) => row.reportingCode === "GBR")!
  expect(aggregatePopulation(["GBR", "GBR"], observations)).toMatchObject({
    population: 100000,
    coverage: { expected: 1, complete: true },
  })
  expect(
    aggregatePopulation(["GBR", "ZZZ"], observations).population
  ).toBeNull()
  expect(aggregatePopulation([], observations).population).toBeNull()
  expect(
    aggregatePopulation(["GBR", "USA"], [
      uk,
      { ...uk, reportingCode: "USA", year: 2023 },
    ] as PopulationObservation[]).population
  ).toBeNull()
})

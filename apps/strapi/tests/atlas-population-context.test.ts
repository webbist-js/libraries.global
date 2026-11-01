import { beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  rows: [] as (typeof row & { iso2?: string })[],
}))
vi.mock("../src/utils/population-storage", () => ({
  readPopulationEstimates: async (
    _db: unknown,
    _tables: string[],
    predicate: (item: typeof row) => boolean
  ) => state.rows.filter(predicate),
}))
import { atlasPopulationContext } from "../src/utils/atlas-population-context"

const row = {
  key: "scb:SE:area:0114:2025",
  level: "area",
  reportingCode: "0114",
  year: 2025,
  boundaryVersion: "2025-01-01",
  population: 50000,
}
const db = vi.fn(() => {
  const chain = {
    where: () => chain,
    whereNotNull: () => chain,
    whereRaw: () => chain,
    select: () => chain,
    limit: async () => [
      { name: "Upplands Väsby", population_estimates: state.rows },
    ],
  }

  return chain
})
const strapi = { db: { connection: db } }
beforeEach(() => {
  state.rows = [{ ...row }]
  db.mockClear()
})
it("reads the latest geographic release and uses the published place name", async () => {
  state.rows.push({
    ...row,
    key: "scb:SE:area:0114:2024",
    year: 2024,
    population: 49000,
  })
  const result = await atlasPopulationContext(strapi, "SE")
  expect(result.observations).toEqual([
    expect.objectContaining({
      name: "Upplands Väsby",
      year: 2025,
      population: 50000,
    }),
  ])
})
it("rejects conflicting same-year observations and unsupported country input", async () => {
  state.rows.push({ ...row, population: 50001 })
  await expect(atlasPopulationContext(strapi, "SE")).rejects.toThrow(
    "Conflicting"
  )
  await expect(atlasPopulationContext(strapi, "SE' OR true")).rejects.toThrow(
    RangeError
  )
})
it("includes Italy's sourced census observations in local and country catalogues", async () => {
  state.rows = [
    {
      ...row,
      key: "istat:IT:2023:country:ITA",
      iso2: "IT",
      level: "country",
      reportingCode: "ITA",
      year: 2023,
      population: 58_971_230,
      boundaryVersion: "20240101",
    },
  ]
  expect((await atlasPopulationContext(strapi, "all")).observations).toEqual([
    expect.objectContaining({ reportingCode: "ITA", population: 58_971_230 }),
  ])
  expect((await atlasPopulationContext(strapi, "IT")).iso3).toBe("ITA")
})
it("keeps Finnish mainland and Åland separate when updating country totals", async () => {
  state.rows = [
    {
      ...row,
      key: "statfin:FI:2025:20260101",
      level: "country",
      iso2: "FI",
      reportingCode: "FIN-mainland",
      population: 5600000,
    },
    {
      ...row,
      key: "statfin:AX:2025:20260101",
      level: "country",
      iso2: "AX",
      reportingCode: "ALA",
      population: 30000,
    },
  ]
  const result = await atlasPopulationContext(strapi, "all")
  expect(result.observations).toEqual([
    expect.objectContaining({
      reportingCode: "FIN",
      name: "Finland (mainland)",
      population: 5600000,
    }),
    expect.objectContaining({ reportingCode: "ALA", population: 30000 }),
  ])
  expect(db).not.toHaveBeenCalled()
})

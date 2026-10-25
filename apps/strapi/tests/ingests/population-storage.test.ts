import path from "node:path"

import { expect, it, vi } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require(
  path.resolve(process.cwd(), "database/migrations/shared/population-storage")
)

const estimate = (reportingCode: string, year: number) => ({
  key: `test:${reportingCode}:${year}`,
  reportingCode,
  year,
  population: 100,
  level: "region",
  iso2: "FI",
  name: "Region",
  source: "Statistics Finland",
  sourceUrl: "https://stat.fi/",
  licence: "CC BY 4.0",
  retrievedAt: "2026-10-11T12:00:00Z",
  method: "direct",
})

it("retains older estimates and writes Finnish reporting codes without assigning a UK GSS code", async () => {
  const update = vi.fn()
  const query = { where: vi.fn().mockReturnThis(), update }
  const knex = vi.fn(() => query)
  await storage.storePopulationPlan(knex, [
    {
      observation: storage.normalizeObservation({
        ...estimate("MK19", 2025),
        coverage: { scope: "mainland_finland" },
      }),
      owner: {
        table: "regions",
        place: {
          document_id: "lapland",
          population_estimates: [estimate("MK19", 2024)],
        },
      },
    },
  ])
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      population_year: 2025,
      population_reporting_code: "MK19",
    })
  )
  const data = update.mock.calls[0][0]
  expect(JSON.parse(data.population_estimates)).toHaveLength(2)
  expect(JSON.parse(data.population_coverage)).toMatchObject({
    complete: true,
    scope: "mainland_finland",
  })
  for (const field of [
    "gss_code",
    "name",
    "summary",
    "updated_at",
    "published_at",
  ])
    expect(data).not.toHaveProperty(field)
})

it("continues to fill GSS codes for UK population imports", async () => {
  const update = vi.fn()
  const knex = vi.fn(() => ({ where: vi.fn().mockReturnThis(), update }))
  await storage.storePopulationPlan(knex, [
    {
      observation: storage.normalizeObservation(estimate("E09000001", 2024)),
      owner: {
        table: "areas",
        place: { document_id: "london", population_estimates: [] },
      },
    },
  ])
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ gss_code: "E09000001" })
  )
})

it("preserves current placement codes when a historical population uses older boundaries", async () => {
  const update = vi.fn()
  const knex = vi.fn(() => ({ where: vi.fn().mockReturnThis(), update }))
  await storage.storePopulationPlan(knex, [
    {
      observation: storage.normalizeObservation(estimate("E08000016", 2024)),
      owner: {
        table: "areas",
        place: {
          document_id: "barnsley",
          gss_code: "E08000038",
          population_estimates: [],
        },
      },
    },
  ])
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ population_reporting_code: "E08000016" })
  )
  expect(update.mock.calls[0]![0]).not.toHaveProperty("gss_code")
})

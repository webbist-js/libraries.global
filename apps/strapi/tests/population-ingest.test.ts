import { atlasPopulationBaseline } from "@repo/shared-data"
import { expect, it, vi } from "vitest"

const storage = vi.hoisted(() => ({
  populationPlan: vi.fn(async (_knex, rows) => rows),
  storePopulationPlan: vi.fn(),
  readPopulationEstimates: vi.fn(),
}))
vi.mock("../src/utils/population-storage", () => storage)

import { ingestPopulation } from "../src/utils/population-ingest"

const economies = atlasPopulationBaseline.countries
  .filter((row) => row.iso2 !== null)
  .map((row) => ({
    id: row.iso3,
    iso2Code: row.iso2,
    name: row.name,
    region: { id: "TEST" },
  }))
const values = [
  ...economies.map((row) => ({
    countryiso3code: row.id,
    date: "2024",
    indicator: { id: "SP.POP.TOTL" },
    value: 100000,
  })),
  {
    countryiso3code: "WLD",
    date: "2024",
    indicator: { id: "SP.POP.TOTL" },
    value: 8000000000,
  },
]
const page = (rows: unknown[]) => [{ pages: 1, total: rows.length }, rows]
function fixture() {
  const updates: { uid: string; where: any; data: any }[] = []
  const observations = {
    findOne: vi.fn(async () => null),
    create: vi.fn(async (data: any) => data),
    update: vi.fn(),
  }
  const countries = {
    findMany: vi.fn(async () => [
      {
        documentId: "fr",
        name: "France",
        iso2: "FR",
        iso3: "FRA",
        continent: { documentId: "eu" },
      },
      {
        documentId: "eng",
        name: "England",
        iso2: "GB-ENG",
        iso3: "ENG",
        continent: { documentId: "eu" },
      },
      {
        documentId: "missing",
        name: "Unknown",
        iso2: "ZZ",
        continent: { documentId: "eu" },
      },
    ]),
  }
  const index = vi.fn(async () => {})
  const strapi = {
    documents: (uid: string) =>
      uid === "api::country.country"
        ? countries
        : uid === "api::continent.continent"
          ? { findMany: async () => [{ documentId: "eu", slug: "europe" }] }
          : observations,
    db: {
      transaction: vi.fn(async (job: (args: any) => Promise<void>) =>
        job({ trx: "transaction" })
      ),
      query: (uid: string) => ({
        updateMany: vi.fn(async ({ where, data }: any) =>
          updates.push({ uid, where, data })
        ),
      }),
    },
    plugin: () => ({ service: () => ({ addContentTypeInMeiliSearch: index }) }),
  }
  const download = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("indicator") ? page(values) : page(economies),
  })) as unknown as typeof fetch

  return { strapi, updates, observations, countries, index, download }
}

it("dry-run validates and reports all joins without writing or indexing", async () => {
  const f = fixture()
  const result = await ingestPopulation(f.strapi, {
    dryRun: true,
    fetch: f.download,
  })
  expect(result).toMatchObject({
    matched: 1,
    parentReportingAreas: ["England"],
    worldPopulation: 8000000000,
  })
  expect(result.missing).toHaveLength(1)
  expect(f.strapi.db.transaction).not.toHaveBeenCalled()
  expect(f.index).not.toHaveBeenCalled()
})

it("atomically stores observations and derived fields without publishing pending content", async () => {
  const f = fixture()
  await ingestPopulation(f.strapi, { fetch: f.download })
  expect(storage.storePopulationPlan).toHaveBeenCalledWith(
    "transaction",
    expect.arrayContaining([
      expect.objectContaining({ reportingCode: "FRA" }),
      expect.objectContaining({ reportingCode: "WLD" }),
    ])
  )
  const france = f.updates.find((row) => row.where.documentId === "fr")!
  expect(france.data).toMatchObject({
    populationCount: "100000",
    populationYear: 2024,
    populationReportingCode: "FRA",
    populationMethod: "direct",
  })
  expect(france.data).not.toHaveProperty("population")
  expect(france.data).not.toHaveProperty("publishedAt")
  expect(france.where.$or).toEqual([
    { populationYear: { $null: true } },
    { populationYear: { $lte: 2024 } },
  ])
  const england = f.updates.find((row) => row.where.documentId === "eng")!
  expect(england.data).not.toHaveProperty("populationCount")
  expect(england.data.populationCoverage).toMatchObject({
    complete: false,
    reason: "parent_reporting_area",
  })
  expect(
    f.updates.find((row) => row.where.documentId === "eu")?.data
  ).toMatchObject({ population: null, populationCoverage: { complete: false } })
  expect(f.index).not.toHaveBeenCalled()
})

it("rejects an incomplete source before beginning the transaction", async () => {
  const f = fixture()
  const download = vi.fn(async () => ({
    ok: true,
    json: async () => [{ pages: 2 }, []],
  })) as unknown as typeof fetch
  await expect(ingestPopulation(f.strapi, { fetch: download })).rejects.toThrow(
    "Incomplete"
  )
  expect(f.strapi.db.transaction).not.toHaveBeenCalled()
  expect(f.index).not.toHaveBeenCalled()
})

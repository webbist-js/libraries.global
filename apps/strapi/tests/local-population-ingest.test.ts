import {
  atlasLocalGeography,
  POPULATION_REFERENCE_YEAR,
} from "@repo/shared-data"
import { expect, it, vi } from "vitest"

const storage = vi.hoisted(() => ({
  populationPlan: vi.fn(async (_knex, rows) =>
    rows.map((observation, i) => ({
      observation,
      owner: { table: i === 0 ? "areas" : "regions" },
    }))
  ),
  storePopulationPlan: vi.fn(),
  readPopulationEstimates: vi.fn(async () => []),
}))
vi.mock("../src/utils/population-storage", () => storage)

import {
  ingestLocalPopulation,
  readLocalPopulation,
} from "../src/utils/local-population-ingest"

function fixture() {
  const codes = atlasLocalGeography.areas.map((area) => area.code)
  const observations = {
    findOne: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
  }
  const updateMany = vi.fn(),
    index = vi.fn()
  const strapi = {
    documents: () => ({
      findMany: vi.fn(async () => [
        { documentId: "local-area", name: "Local area", gssCode: codes[0] },
      ]),
    }),
    db: {
      transaction: vi.fn(async (job: (args: any) => Promise<void>) =>
        job({ trx: "transaction" })
      ),
      query: (uid: string) => ({ updateMany }),
    },
    plugin: () => ({ service: () => ({ addContentTypeInMeiliSearch: index }) }),
  }
  const download = vi.fn(async (url: string) => ({
    ok: true,
    json: async () => ({
      header: { truncated: "false" },
      obs: new URL(url).searchParams
        .get("geography")!
        .split(",")
        .map((code) => ({
          dataset: { value: "NM_2002_1" },
          time: { value: POPULATION_REFERENCE_YEAR },
          geography: { geogcode: code, description: code },
          gender: { value: 0 },
          c_age: { value: 200 },
          measures: { value: 20100 },
          unit: { value: "PER" },
          obs_status: { value: "A" },
          obs_value: { value: 100000 },
        })),
    }),
  })) as unknown as typeof fetch

  return { codes, observations, updateMany, index, strapi, download }
}

it("validates every source batch before writing, and dry-run does not mutate CMS content", async () => {
  const f = fixture()
  expect(
    await ingestLocalPopulation(f.strapi, { dryRun: true, fetch: f.download })
  ).toMatchObject({ observations: 361, cmsAreasUpdated: 1, dryRun: true })
  expect(f.download).toHaveBeenCalledTimes(6)
  expect(f.strapi.db.transaction).not.toHaveBeenCalled()
  expect(f.index).not.toHaveBeenCalled()
})

it("stores complete observations atomically and updates only derived local fields", async () => {
  const f = fixture()
  await ingestLocalPopulation(f.strapi, { fetch: f.download })
  expect(f.strapi.db.transaction).toHaveBeenCalledTimes(1)
  expect(storage.storePopulationPlan).toHaveBeenCalledWith(
    "transaction",
    expect.arrayContaining([
      expect.objectContaining({
        observation: expect.objectContaining({
          population: 100000,
          parentReportingCode: "GBR",
          boundaryVersion: atlasLocalGeography.version,
          year: POPULATION_REFERENCE_YEAR,
        }),
      }),
    ])
  )
  expect(f.index).not.toHaveBeenCalled()
})

it("rejects a partial final batch before starting any transaction", async () => {
  const f = fixture(),
    complete = f.download
  let requests = 0
  const download = (async (...args: Parameters<typeof fetch>) => {
    requests++

    return requests === 6
      ? {
          ok: true,
          json: async () => ({ header: { truncated: "false" }, obs: [] }),
        }
      : complete(...args)
  }) as typeof fetch
  await expect(
    ingestLocalPopulation(f.strapi, { fetch: download })
  ).rejects.toThrow("Incomplete ONS")
  expect(f.strapi.db.transaction).not.toHaveBeenCalled()
  expect(f.observations.create).not.toHaveBeenCalled()
  expect(f.index).not.toHaveBeenCalled()
})

it("fails closed when stored local observations do not cover the boundary catalogue", async () => {
  const f = fixture()
  await expect(readLocalPopulation(f.strapi)).rejects.toThrow(
    "Local population import is not ready"
  )
})

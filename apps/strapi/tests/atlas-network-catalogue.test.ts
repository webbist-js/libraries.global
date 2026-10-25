import { atlasLocalGeography, emptyAtlasFilters } from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import { requestAtlasNetworkReach } from "../src/utils/atlas-network-analysis"
import {
  describeNetwork,
  parseNetworkQuery,
  atlasNetworkCatalogue,
} from "../src/utils/atlas-network-catalogue"

const network = {
  documentId: "one",
  name: "Wirral Library Service",
  kind: "library_service",
}
const rows = [
  {
    documentId: "a",
    location: { lat: 53.4, lng: -3.1 },
    operationalStatus: "open",
    libraryType: { name: "Public" },
  },
]
const projections = [
  {
    documentId: "a",
    original_lat: 53.4,
    original_lng: -3.1,
    local_area_code: "E08000015",
    local_area_version: atlasLocalGeography.version,
  },
]

it("derives the service boundary and map bounds from current eligible members", () => {
  const result = describeNetwork(
    network,
    [
      ...rows,
      { documentId: "closed", operationalStatus: "permanently_closed" },
    ],
    projections
  )
  expect(result).toMatchObject({
    areaName: "Wirral",
    areaCodes: ["E08000015"],
    available: true,
    eligibleLibraries: 1,
    excludedLibraries: 1,
    bounds: { west: -3.1, east: -3.1, south: 53.4, north: 53.4 },
  })
  expect(describeNetwork(network, rows, []).available).toBe(false)
  const moved = [{ ...rows[0], location: { lat: 54, lng: -3 } }]
  expect(describeNetwork(network, moved, projections).available).toBe(false)
})

it("rejects an unrelated reporting area before admitting any native work", async () => {
  const query = {
    where: () => query,
    whereIn: () => query,
    select: () => query,
    limit: async () => projections.map((projection) => ({ projection })),
  }
  const strapi = {
    db: { connection: () => query },
    documents: (uid: string) =>
      uid.includes("library-network")
        ? { findOne: async () => network }
        : { findMany: async () => rows },
  }
  await expect(
    requestAtlasNetworkReach(
      strapi,
      {
        schemaVersion: 1,
        networkId: "one",
        areaCode: "E06000014",
        mode: "walking",
        scope: {
          filters: emptyAtlasFilters(),
          accessibility: { enabled: false, selected: [], view: "matches" },
        },
      },
      "a".repeat(64),
      20
    )
  ).rejects.toThrow("outside this service")
})

it("bounds server search and pages services without loading a worldwide catalogue", async () => {
  const findMany = vi.fn().mockResolvedValue(
    Array.from({ length: 26 }, (_, n) => ({
      documentId: `id${n}`,
      name: `Service ${n}`,
    }))
  )
  const strapi = {
    documents: (uid: string) => ({
      findMany: uid.includes("library-network")
        ? findMany
        : vi.fn().mockResolvedValue([]),
    }),
  }
  const page = await atlasNetworkCatalogue(strapi, {
    q: "Library",
    country: "england",
    region: "merseyside",
  })
  expect(page.networks).toHaveLength(25)
  expect(page.next).toBe(JSON.stringify(["Service 24", "id24"]))
  expect(findMany.mock.calls[0]![0]).toMatchObject({
    limit: 26,
    filters: {
      libraries: {
        country: { documentId: "england" },
        region: { documentId: "merseyside" },
      },
      name: { $containsi: "Library" },
    },
  })
  expect(() => parseNetworkQuery({ q: "x".repeat(81) })).toThrow()
  expect(() => parseNetworkQuery({ region: "merseyside" })).toThrow()
  expect(() =>
    parseNetworkQuery({ after: JSON.stringify(["one", 3]) })
  ).toThrow()
})

it("rejects a large canonical reporting district even for one eligible origin", async () => {
  const row = { ...rows[0], location: { lat: 57.4, lng: -4.2 } }
  const query = {
    where: () => query,
    whereIn: () => query,
    select: () => query,
    limit: async () => [
      {
        projection: {
          ...projections[0],
          original_lat: 57.4,
          original_lng: -4.2,
          local_area_code: "S12000017",
        },
      },
    ],
  }
  const connection = vi.fn(() => query)
  const strapi = {
    db: { connection },
    documents: (uid: string) =>
      uid.includes("library-network")
        ? { findOne: async () => network }
        : { findMany: async () => [row] },
  }
  const response = await requestAtlasNetworkReach(
    strapi,
    {
      schemaVersion: 1,
      networkId: "one",
      mode: "walking",
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    },
    "a".repeat(64),
    20
  )
  expect(response.body).toMatchObject({
    state: "unsupported",
    message: expect.stringContaining("Reach calculation allowance"),
  })
  expect(connection.mock.calls).toEqual([["atlas_records"]])
})

it("requires a chosen time for an expanded rural service before native or cache access", async () => {
  const row = { ...rows[0], location: { lat: 57.2, lng: -2.5 } }
  const query = {
    where: () => query,
    whereIn: () => query,
    select: () => query,
    limit: async () => [
      {
        projection: {
          ...projections[0],
          original_lat: 57.2,
          original_lng: -2.5,
          local_area_code: "S12000034",
        },
      },
    ],
  }
  const connection = vi.fn(() => query)
  const strapi = {
    db: { connection },
    documents: (uid: string) =>
      uid.includes("library-network")
        ? { findOne: async () => network }
        : { findMany: async () => [row] },
  }
  const result = await requestAtlasNetworkReach(
    strapi,
    {
      schemaVersion: 1,
      networkId: "one",
      mode: "walking",
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    },
    "a".repeat(64),
    20
  )
  expect(result.body).toMatchObject({
    state: "unsupported",
    message: expect.stringContaining("one travel time"),
  })
  expect(connection.mock.calls).toEqual([["atlas_records"]])
})

it("reports missing reporting geography as a data limitation rather than a plan allowance", async () => {
  const query = {
    where: () => query,
    whereIn: () => query,
    select: () => query,
    limit: async () => [],
  }
  const connection = vi.fn(() => query)
  const strapi = {
    db: { connection },
    documents: (uid: string) =>
      uid.includes("library-network")
        ? { findOne: async () => network }
        : { findMany: async () => rows },
  }
  const result = await requestAtlasNetworkReach(
    strapi,
    {
      schemaVersion: 1,
      networkId: "one",
      mode: "walking",
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    },
    "a".repeat(64),
    20
  )
  expect(result.body).toMatchObject({
    state: "unsupported",
    message: expect.stringContaining("supported reporting boundaries"),
  })
  expect(connection.mock.calls).toEqual([["atlas_records"]])
})

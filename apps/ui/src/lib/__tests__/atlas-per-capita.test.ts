import {
  emptyAtlasFilters,
  type AtlasQueryRequest,
  type PopulationObservation,
} from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import type { AtlasBackend, AtlasBackendState } from "../atlas-backend"
import { AtlasQueryEngine } from "../atlas-query"

const state: AtlasBackendState = {
  schemaVersion: 1,
  queryEpoch: "test",
  canonicalLocale: "en",
  dictionary: { version: "test", entries: [] },
  indexedThrough: "1",
  projectionRevision: "1",
  journalFloor: "0",
  clockDue: null,
  heartbeatAt: null,
  manifest: null,
}
const request: Extract<AtlasQueryRequest, { purpose: "perCapita" }> = {
  schemaVersion: 1,
  purpose: "perCapita",
  scope: {
    filters: { ...emptyAtlasFilters(), events: true },
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
}
function backend(clipped = false): AtlasBackend {
  return {
    state: async () => state,
    bridge: vi.fn(async () => ({
      observations,
      populationVersion: "fixture",
      countries: [
        { documentId: "uk", iso2: "GB", iso3: null },
        { documentId: "us", iso2: "US", iso3: "USA" },
      ],
    })),
    search: vi.fn(async (query) => {
      const filter = String(query.filter)
      const events = filter.includes("has_events = true")
      const count = events ? 10 : 110
      const missing = filter.includes("country_id IS NULL")

      return {
        hits: [],
        estimatedTotalHits: missing ? 1 : count,
        facetDistribution: {
          locale: { en: missing ? 1 : count },
          ...(!missing
            ? {
                country_id: {
                  uk: clipped ? 2 : events ? 6 : 66,
                  us: events ? 2 : 40,
                  unknown: events ? 1 : 3,
                },
              }
            : {}),
        },
      }
    }),
  }
}
const observations: PopulationObservation[] = [
  ["GBR", "GB", 69281000],
  ["USA", "US", 340000000],
  ["FRA", "FR", 68000000],
].map(([reportingCode, iso2, population]) => ({
  key: `fixture:${reportingCode}`,
  reportingCode: String(reportingCode),
  iso2: String(iso2),
  population: Number(population),
  level: "country",
  name: String(reportingCode),
  year: 2024,
  source: "Test fixture",
  sourceUrl: "https://example.com",
  licence: "Test",
  retrievedAt: "2026-10-09T12:00:00Z",
  method: "direct",
}))
it("joins ISO2 metadata and accounts for unmatched/missing country IDs", async () => {
  const store = backend()
  const value = await new AtlasQueryEngine(
    store,
    state,
    new Date("2026-10-09T12:00:00Z")
  ).perCapita(request)
  expect(value.exactTotal).toBe(10)
  expect(value.unmappedLibraries).toBe(2)
  expect(value.countries.find((c) => c.iso3 === "GBR")).toMatchObject({
    libraryCount: 6,
    indexedCount: 66,
    per100k: (6 / 69281000) * 100000,
  })
  expect(value.countries.find((c) => c.iso3 === "FRA")).toMatchObject({
    per100k: null,
    status: "no_records",
  })
  expect(value.summary.libraryCount).toBe(8)
  for (const [query] of vi.mocked(store.search).mock.calls) {
    expect(query.filter).toContain('type_group != "mobile"')
    expect(query.filter).toContain('status != "planned"')
    expect(query.filter).not.toContain("_geoBoundingBox")
  }
})
it("refuses clipped facets instead of colouring a partial count", async () => {
  await expect(
    new AtlasQueryEngine(backend(true), state, new Date()).perCapita(request)
  ).rejects.toThrow("Incomplete Atlas country counts")
})
it("rejects contradictory country codes", async () => {
  const store = backend()
  vi.mocked(store.bridge).mockResolvedValue({
    observations,
    populationVersion: "fixture",
    countries: [{ documentId: "uk", iso2: "GB", iso3: "USA" }],
  })
  await expect(
    new AtlasQueryEngine(store, state, new Date()).perCapita(request)
  ).rejects.toThrow("Conflicting Atlas country ISO codes")
})

it("joins all four UK nations to a single managed population denominator", async () => {
  const store = backend()
  vi.mocked(store.bridge).mockResolvedValue({
    observations,
    populationVersion: "managed",
    countries: [
      {
        documentId: "uk",
        iso2: "GB-ENG",
        iso3: "ENG",
        populationReportingCode: "GBR",
      },
      {
        documentId: "us",
        iso2: "GB-SCT",
        iso3: "SCT",
        populationReportingCode: "GBR",
      },
    ],
  })
  const value = await new AtlasQueryEngine(store, state, new Date()).perCapita(
    request
  )
  expect(value.countries.find((row) => row.iso3 === "GBR")).toMatchObject({
    libraryCount: 8,
    indexedCount: 106,
    population: 69281000,
  })
  expect(value.summary.population).toBe(69281000)
  expect(value.baseline.populationVersion).toBe("managed")
})

it("fails before shading when the population import is unavailable or invalid", async () => {
  const store = backend()
  vi.mocked(store.bridge).mockResolvedValue({
    countries: [],
    observations: [],
    populationVersion: "empty",
  })
  await expect(
    new AtlasQueryEngine(store, state, new Date()).perCapita(request)
  ).rejects.toThrow("population import is not ready")
  vi.mocked(store.bridge).mockResolvedValue({
    countries: [],
    observations: [{ ...observations[0], year: 2023 }],
    populationVersion: "wrong-year",
  })
  await expect(
    new AtlasQueryEngine(store, state, new Date()).perCapita(request)
  ).rejects.toThrow("Invalid Atlas population")
})

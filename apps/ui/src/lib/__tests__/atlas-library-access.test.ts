import { atlasLocalGeography, emptyAtlasFilters } from "@repo/shared-data"
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
const scope = {
  filters: { ...emptyAtlasFilters(), events: true },
  accessibility: { enabled: false, selected: [], view: "matches" as const },
}
const codes = atlasLocalGeography.areas.slice(0, 2).map((area) => area.code)
function fixture(
  options: { clipped?: boolean; stale?: boolean; wrongYear?: boolean } = {}
) {
  const observations = atlasLocalGeography.areas.map((area) => ({
    reportingCode: area.code,
    population: 100000,
    year: options.wrongYear ? 2023 : 2024,
    boundaryVersion: atlasLocalGeography.version,
    source: "ONS",
    sourceUrl: "https://www.nomisweb.co.uk",
    licence: "OGL v3.0",
    retrievedAt: "2026-10-09T00:00:00Z",
  }))
  const backend: AtlasBackend = {
    state: async () => state,
    bridge: vi.fn(async (path) =>
      path.includes("population/local")
        ? {
            geography: atlasLocalGeography,
            observations,
            populationVersion: "fixture",
          }
        : { countries: [{ documentId: "uk", iso2: "GB", iso3: "GBR" }] }
    ),
    search: vi.fn(async (query) => {
      const filter = String(query.filter),
        local = filter.includes("local_area_code"),
        missing = filter.includes("IS NULL"),
        selected = filter.includes("has_events = true")
      const count = local
        ? missing
          ? 1
          : selected
            ? 6
            : 21
        : options.stale && filter.includes("local_area_version")
          ? 20
          : 21

      return {
        hits: [],
        estimatedTotalHits: count,
        facetDistribution: {
          locale: { en: count },
          ...(local && !missing
            ? {
                local_area_code: {
                  [codes[0]!]: selected ? (options.clipped ? 2 : 3) : 10,
                  [codes[1]!]: selected ? 2 : 10,
                },
              }
            : {}),
        },
      }
    }),
  }

  return backend
}
it("counts whole local reporting units with the same filters and source year", async () => {
  const backend = fixture(),
    response = await new AtlasQueryEngine(
      backend,
      state,
      new Date()
    ).libraryAccess({
      schemaVersion: 1,
      purpose: "libraryAccess",
      level: "local",
      scope,
    })
  expect(response.areas).toHaveLength(361)
  expect(response.exactTotal).toBe(6)
  expect(response.unmappedLibraries).toBe(1)
  expect(response.areas[0]).toMatchObject({
    libraryCount: 3,
    indexedCount: 10,
    population: 100000,
    populationYear: 2024,
    per100k: 3,
    peoplePerLibrary: 100000 / 3,
  })
  expect(response.areas[2]!.status).toBe("no_records")
  expect(response.geometry.property).toBe("code")
  const queryFilters = vi
    .mocked(backend.search)
    .mock.calls.map(([input]) => String(input.filter))
  expect(
    queryFilters.some(
      (filter) =>
        filter.includes("access_listed = true") &&
        filter.includes('status != "planned"')
    )
  ).toBe(true)
  expect(
    queryFilters.every((filter) => !filter.includes('type_group != "mobile"'))
  ).toBe(true)
})
it.each([{ clipped: true }, { stale: true }, { wrongYear: true }])(
  "rejects incomplete counts and mismatched population/geography versions: %j",
  async (options) => {
    await expect(
      new AtlasQueryEngine(fixture(options), state, new Date()).libraryAccess({
        schemaVersion: 1,
        purpose: "libraryAccess",
        level: "local",
        scope,
      })
    ).rejects.toThrow()
  }
)

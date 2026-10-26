import {
  atlasCellId,
  projectAtlasLibrary,
  emptyAtlasFilters,
  type AtlasQueryRequest,
  type AtlasManifest,
} from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import type { AtlasBackendState, AtlasSearchResult } from "../atlas-backend"
import { AtlasQueryEngine } from "../atlas-query"

const now = new Date("2026-10-25T12:00:00Z")
const archive: AtlasManifest = {
  schemaVersion: 1,
  projectionVersion: 1,
  dictionaryVersion: "one",
  buildId: "one",
  builtAt: now.toISOString(),
  sourceStartRevision: "1",
  sourceEndRevision: "1",
  builtAgainstQueryEpoch: "epoch",
  canonicalLocale: "en",
  sourceLayer: "libraries",
  detailZoom: 10,
  maxZoom: 16,
  count: 3000,
  url: "https://cdn.test/points.pmtiles",
  archiveBytes: 127,
  sha256: "a".repeat(64),
  bounds: { west: -180, east: 180, south: -85, north: 85 },
  attribution: "fixture",
  densityTiles: {
    version: 1,
    url: "https://cdn.test/density.pmtiles",
    archiveBytes: 127,
    sha256: "b".repeat(64),
    count: 3000,
    maxZoom: 16,
  },
}
function fixture({
  oldIndex = false,
  manifest = null,
  indexedThrough = "1",
  count = 3000,
  truncateAbove = 20,
}: {
  oldIndex?: boolean
  manifest?: AtlasManifest | null
  indexedThrough?: string
  count?: number
  truncateAbove?: number
} = {}) {
  const state: AtlasBackendState = {
    schemaVersion: 1,
    dictionary: { version: "one", entries: [] },
    canonicalLocale: "en",
    queryEpoch: "epoch",
    projectionRevision: indexedThrough,
    indexedThrough,
    journalFloor: "0",
    clockDue: null,
    heartbeatAt: now.toISOString(),
    manifest,
  }
  const search = vi.fn(
    async (body: Record<string, unknown>): Promise<AtlasSearchResult> => {
      const field = Array.isArray(body.facets)
        ? body.facets.find(
            (field): field is string =>
              typeof field === "string" && field.startsWith("atlas_cell_")
          )
        : undefined
      const resolution = field ? Number(field.split("_").at(-1)) : 0
      if (field && oldIndex && resolution > 12)
        throw new Error("Index field not installed")
      const total = String(body.filter).includes(
        'status = "permanently_closed"'
      )
        ? 0
        : count

      return {
        hits:
          Number(body.limit) > 0 && total > 0 && total <= 1000
            ? Array.from(
                { length: total },
                () =>
                  projectAtlasLibrary(
                    {
                      documentId: "one",
                      name: "One",
                      slug: "one",
                      published: true,
                      locale: "en",
                      location: { lat: 51.5, lng: -0.1 },
                    },
                    { atlasId: 1, canonicalLocale: "en", now }
                  )!
              )
            : [],
        estimatedTotalHits: total,
        facetDistribution: {
          locale: total ? { en: total } : {},
          ...(field
            ? {
                [field]: total
                  ? {
                      [atlasCellId({ lat: 51.5, lng: -0.1 }, resolution)]:
                        resolution > truncateAbove ? total - 1 : total,
                    }
                  : {},
              }
            : {}),
        },
      }
    }
  )
  const engine = new AtlasQueryEngine(
    { state: async () => state, search, bridge: vi.fn() },
    state,
    now
  )
  const request: Extract<AtlasQueryRequest, { purpose: "viewport" }> = {
    schemaVersion: 1,
    purpose: "viewport",
    drawingPreference: "auto",
    zoom: 12,
    centre: { lat: 51.5, lng: -0.1 },
    width: 800,
    height: 600,
    populations: ["closures"],
    scope: {
      bbox: { west: -180, east: 180, south: -90, north: 90 },
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
    libraryDensity: { detail: "auto", scale: "fixed" },
  }

  return { engine, request, search }
}
it("uses verified prepared counts only for an exactly matching unfiltered snapshot", async () => {
  const f = fixture({ manifest: archive })
  expect((await f.engine.viewport(f.request)).libraryDensity).toMatchObject({
    mode: "tiles",
    exactTotal: 3000,
    archive: archive.densityTiles,
  })
  expect(
    f.search.mock.calls.some(
      ([body]) =>
        Array.isArray(body.facets) &&
        body.facets.some((field: string) => field.startsWith("atlas_cell_"))
    )
  ).toBe(false)
})
it.each([
  { indexedThrough: "2", manifest: archive },
  { manifest: { ...archive, sourceStartRevision: "0" } },
  { manifest: { ...archive, builtAgainstQueryEpoch: "previous" } },
])(
  "does not overlay live additions onto stale or mixed-snapshot density (%j)",
  async (config) => {
    const f = fixture(config)
    expect((await f.engine.viewport(f.request)).libraryDensity).toMatchObject({
      mode: "cells",
      exactTotal: 3000,
      resolution: 16,
    })
  }
)
it("uses current complete cells for network filters and local contrast", async () => {
  const f = fixture({ manifest: archive })
  f.request.scope.filters.networks = ["service-one"]
  f.request.libraryDensity!.scale = "local"
  const data = (await f.engine.viewport(f.request)).libraryDensity!
  expect(data.mode).toBe("cells")
  expect(data.cells.reduce((sum, cell) => sum + cell.total, 0)).toBe(3000)
  expect(data.maxPer100Km2).toBeGreaterThan(0)
  for (const [body] of f.search.mock.calls)
    expect(body.filter).toContain('network_ids = "service-one"')
})
it("labels a complete coarse fallback while fine fields are being added to an older index", async () => {
  const f = fixture({ oldIndex: true })
  const data = (await f.engine.viewport(f.request)).libraryDensity!
  expect(data).toMatchObject({
    mode: "cells",
    requestedResolution: 16,
    resolution: 12,
    coarsened: true,
  })
  expect(data.cells.reduce((sum, cell) => sum + cell.total, 0)).toBe(3000)
})

it("uses original coordinates at fine resolution for small selections on an older index", async () => {
  const f = fixture({ oldIndex: true, count: 3 })
  const data = (await f.engine.viewport(f.request)).libraryDensity!
  expect(data).toMatchObject({
    mode: "cells",
    resolution: 16,
    coarsened: false,
    exactTotal: 3,
  })
  expect(data.cells).toEqual([
    { id: atlasCellId({ lat: 51.5, lng: -0.1 }, 16), total: 3 },
  ])
})

it("coarsens incomplete facets without dropping the unreturned records", async () => {
  const f = fixture({ truncateAbove: 14 })
  const data = (await f.engine.viewport(f.request)).libraryDensity!
  expect(data).toMatchObject({
    resolution: 14,
    coarsened: true,
    exactTotal: 3000,
  })
  expect(data.cells.reduce((sum, cell) => sum + cell.total, 0)).toBe(3000)
})
it("returns an explicit empty distribution rather than a missing result", async () => {
  const f = fixture({ count: 0 })
  expect((await f.engine.viewport(f.request)).libraryDensity).toMatchObject({
    exactTotal: 0,
    mode: "cells",
    cells: [],
    resolution: 16,
    coarsened: false,
  })
})

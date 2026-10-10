import {
  atlasNameSortKey,
  emptyAtlasFilters,
  projectAtlasLibrary,
  type AtlasExportRequest,
} from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AtlasExportConflict,
  AtlasExportLimit,
  fetchAtlasExport,
  parseAtlasExport,
  selectAtlasExport,
} from "../atlas-export"
import type { AtlasBackend, AtlasBackendState } from "../atlas-backend"
import { fetchExportRows } from "../library-export-bridge"

vi.mock("../library-export-bridge", () => ({ fetchExportRows: vi.fn() }))
const request: AtlasExportRequest = {
  schemaVersion: 1,
  sort: "name",
  centre: { lat: 0, lng: 0 },
  scope: {
    bbox: { west: -1, east: 1, south: -1, north: 1 },
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
}
const now = new Date("2026-10-09T12:00:00Z")
const row = projectAtlasLibrary(
  {
    documentId: "one",
    locale: "en",
    published: true,
    name: "Alpha",
    slug: "alpha",
    location: { lat: 0, lng: 0 },
  },
  { atlasId: 1, canonicalLocale: "en", now }
)!
const state: AtlasBackendState = {
  schemaVersion: 1,
  queryEpoch: "epoch",
  dictionary: { version: "dict", entries: [] },
  canonicalLocale: "en",
  projectionRevision: "1",
  indexedThrough: "1",
  journalFloor: "0",
  clockDue: null,
  heartbeatAt: null,
  manifest: null,
}
const backend = (): AtlasBackend => ({
  state: vi.fn(async () => state),
  search: vi.fn(async (body) => ({
    hits: body.limit === 0 ? [] : [row],
    estimatedTotalHits: 1,
    facetDistribution: { locale: { en: 1 } },
  })),
  bridge: vi.fn(async () => ({ stable: true, changes: [] })),
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
describe("Atlas server-selected exports", () => {
  it("rejects client IDs and requires a bounded spatial scope", () => {
    expect(() =>
      parseAtlasExport({ ...request, format: "csv", ids: ["one"] })
    ).toThrow()
    expect(() =>
      parseAtlasExport({
        ...request,
        scope: { ...request.scope, bbox: undefined },
        format: "csv",
      })
    ).toThrow()
  })
  it("uses exact preflight counts and rejects caps before retrieving rows", async () => {
    const api = backend()
    api.search = vi.fn(async () => ({
      hits: [],
      estimatedTotalHits: 1000,
      facetDistribution: { locale: { en: 10001 } },
    }))
    await expect(
      selectAtlasExport(api, request, 10000, now)
    ).rejects.toBeInstanceOf(AtlasExportLimit)
    expect(api.search).toHaveBeenCalledOnce()
  })
  it("continues 500-row keysets beyond the search window with no offsets", async () => {
    const api = backend(),
      hits = Array.from({ length: 1001 }, (_, n) => ({
        ...row,
        atlas_id: n + 1,
        documentId: `d${n}`,
        name_sort: atlasNameSortKey(String(n).padStart(6, "0")),
      }))
    let page = 0
    api.search = vi.fn(async (body) => ({
      hits: body.limit === 0 ? [] : hits.slice(page++ * 500, page * 500),
      estimatedTotalHits: 1000,
      facetDistribution: { locale: { en: 1001 } },
    }))
    const selected = await selectAtlasExport(api, request, 1001, now)
    expect(selected.rows).toHaveLength(1001)
    expect(new Set(selected.rows.map((r) => r.documentId)).size).toBe(1001)
    expect((api.search as any).mock.calls[2][0].filter).toContain(
      "atlas_id > 500"
    )
    expect(
      (api.search as any).mock.calls.every(
        ([body]: any[]) => body.offset === undefined
      )
    ).toBe(true)
  })
  it("retries a scoped mutation once and accepts changes outside the scope", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    vi.mocked(fetchExportRows).mockResolvedValue(
      new Map([["one", { name: "Authoritative" } as any]])
    )
    const api = backend()
    api.bridge = vi
      .fn()
      .mockResolvedValueOnce({
        stable: true,
        changes: [{ old_projection: row, new_projection: row }],
      })
      .mockResolvedValueOnce({
        stable: true,
        changes: [
          {
            old_projection: null,
            new_projection: { ...row, _geo: { lat: 40, lng: 40 } },
          },
        ],
      })
    expect(
      await fetchAtlasExport(api, request, 10000, new AbortController().signal)
    ).toHaveLength(1)
    expect(api.bridge).toHaveBeenCalledTimes(2)
    api.bridge = vi.fn(async () => ({ stable: false }))
    await expect(
      fetchAtlasExport(api, request, 10000, new AbortController().signal)
    ).rejects.toBeInstanceOf(AtlasExportConflict)
    expect(api.bridge).toHaveBeenCalledTimes(2)
  })
})

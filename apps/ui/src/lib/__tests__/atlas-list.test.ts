import { emptyAtlasFilters, projectAtlasLibrary } from "@repo/shared-data"
import { afterEach, expect, it, vi } from "vitest"

import type { AtlasBackend, AtlasBackendState } from "../atlas-backend"
import { AtlasQueryEngine } from "../atlas-query"

const now = new Date("2026-10-26T12:00:00Z")
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
afterEach(() => vi.unstubAllEnvs())
it.each([
  ["record", 50],
  ["record_desc", 50],
  ["record", null],
  ["record_desc", null],
] as const)(
  "continues %s through tied %s completeness values and binds the cursor to the order",
  async (sort, score) => {
    vi.stubEnv("ATLAS_CURSOR_SECRET", "fixture-secret".repeat(4))
    const rows = Array.from(
      { length: 36 },
      (_, i) =>
        projectAtlasLibrary(
          {
            documentId: String(i),
            name: `Library ${i}`,
            slug: String(i),
            locale: "en",
            published: true,
            location: { lat: 0, lng: 0 },
            completeness: score,
          },
          { atlasId: i + 1, canonicalLocale: "en", now }
        )!
    )
    const search: AtlasBackend["search"] = vi.fn(async (body) => ({
      hits:
        body.limit === 0
          ? []
          : String(body.filter).includes("atlas_id > 20")
            ? rows.slice(20)
            : rows.slice(0, 21),
      estimatedTotalHits: 36,
      facetDistribution: { locale: { en: 36 } },
    }))
    const engine = new AtlasQueryEngine(
      { search, state: async () => state, bridge: vi.fn() },
      state,
      now
    )
    const request = {
      schemaVersion: 1 as const,
      purpose: "list" as const,
      sort,
      centre: { lat: 0, lng: 0 },
      scope: {
        bbox: { west: -1, east: 1, south: -1, north: 1 },
        filters: emptyAtlasFilters(),
        accessibility: {
          enabled: false,
          selected: [],
          view: "matches" as const,
        },
      },
    }
    const first = await engine.list(request)
    const second = await engine.list({ ...request, cursor: first.nextCursor })
    expect(first.rows).toHaveLength(20)
    expect(second.rows).toHaveLength(16)
    expect(
      new Set([...first.rows, ...second.rows].map((r) => r.documentId)).size
    ).toBe(36)
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: [
          `completeness:${sort === "record" ? "asc" : "desc"}`,
          "atlas_id:asc",
        ],
      })
    )
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining(
          score === null
            ? "(completeness IS NULL OR completeness NOT EXISTS) AND atlas_id > 20"
            : `completeness ${sort === "record" ? ">" : "<"} 50`
        ),
      })
    )
    await expect(
      engine.list({
        ...request,
        sort: sort === "record" ? "record_desc" : "record",
        cursor: first.nextCursor,
      })
    ).rejects.toThrow("expired")
  }
)

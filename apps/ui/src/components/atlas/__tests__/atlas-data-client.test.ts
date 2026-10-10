import {
  emptyAtlasFilters,
  type AtlasPoint,
  type AtlasQueryRequest,
} from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import { loadAtlasGeneration, mergeAtlasDelta } from "../atlas-data-client"

const point = (id: string, name = "Current"): AtlasPoint => ({
  type: "Feature",
  id: 1,
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: {
    i: id,
    n: name,
    s: "one",
    t: "public",
    o: null,
    st: "open",
    ct: null,
    co: null,
    r: null,
    ar: null,
    ci: null,
    a: "",
    f: "",
    e: false,
    c: false,
    l: false,
    y: null,
    p: null,
  },
})
afterEach(() => vi.unstubAllGlobals())
describe("Atomic Atlas tile reconciliation", () => {
  it("replaces by document ID, retains deletion masks and rejects accumulated overflow", () => {
    const first = { changedIds: ["one"], upserts: [point("one", "Old")] }
    const delta = {
      schemaVersion: 1 as const,
      status: "complete" as const,
      buildId: "fixture",
      since: "0",
      throughRevision: "2",
      upserts: [point("two")],
      removedIds: ["one"],
    }
    expect(mergeAtlasDelta(first, delta)).toEqual({
      changedIds: ["one", "two"],
      upserts: [point("two")],
    })
    expect(() =>
      mergeAtlasDelta(
        {
          changedIds: Array.from({ length: 2000 }, (_, n) => `id${n}`),
          upserts: [],
        },
        delta
      )
    ).toThrow("budget")
    expect(() =>
      mergeAtlasDelta(
        { changedIds: [], upserts: [] },
        {
          ...delta,
          upserts: Array.from({ length: 350 }, (_, n) =>
            point(`id${n}`, "🌍".repeat(240))
          ),
        }
      )
    ).toThrow("budget")
  })
  it("falls back for the entire viewport on an expired archive or watermark mismatch", async () => {
    const request: Extract<AtlasQueryRequest, { purpose: "viewport" }> = {
      schemaVersion: 1,
      purpose: "viewport",
      scope: {
        bbox: { west: -1, east: 1, south: -1, north: 1 },
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
      zoom: 12,
      width: 800,
      height: 600,
      centre: { lat: 0, lng: 0 },
      populations: ["listed", "closures"],
      drawingPreference: "auto",
    }
    const seen: any[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (url === "/api/atlas/manifest")
          return Response.json({
            manifest: {
              buildId: "fixture",
              sourceStartRevision: "0",
              detailZoom: 10,
              builtAgainstQueryEpoch: "epoch",
            },
            dictionary: { version: "dict", entries: [] },
          })
        if (url === "/api/atlas/changes")
          return Response.json({ status: "expired", schemaVersion: 1 })
        const body = JSON.parse(init.body)
        seen.push(body)
        return Response.json({
          schemaVersion: 1,
          queryEpoch: "epoch",
          dictionaryVersion: "dict",
          indexedThrough: "2",
          populations: {
            listed: {
              mode: "points",
              exactTotal: 0,
              complete: true,
              points: [],
            },
            closures: {
              mode: "points",
              exactTotal: 0,
              complete: true,
              points: [],
            },
          },
        })
      })
    )
    const result = await loadAtlasGeneration(
      request,
      new AbortController().signal
    )
    expect(seen).toHaveLength(1)
    expect(seen[0].drawingPreference).toBe("current")
    expect(result.manifest).toBeNull()
    expect(result.changedIds).toEqual([])
    expect(Object.keys(result.viewport.populations)).toEqual([
      "listed",
      "closures",
    ])
  })
  it("initializes a tile generation from its scan start and replaces changed copies atomically", async () => {
    const request: Extract<AtlasQueryRequest, { purpose: "viewport" }> = {
      schemaVersion: 1,
      purpose: "viewport",
      scope: {
        bbox: { west: -1, east: 1, south: -1, north: 1 },
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
      zoom: 12,
      width: 800,
      height: 600,
      centre: { lat: 0, lng: 0 },
      populations: ["listed"],
      drawingPreference: "auto",
    }
    const seen: any[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (url === "/api/atlas/manifest")
          return Response.json({
            manifest: {
              buildId: "fixture",
              sourceStartRevision: "2",
              sourceEndRevision: "3",
              detailZoom: 10,
              builtAgainstQueryEpoch: "epoch",
            },
            dictionary: { version: "dict", entries: [] },
          })
        if (url === "/api/atlas/changes") {
          seen.push(JSON.parse(init.body))
          return Response.json({
            schemaVersion: 1,
            status: "complete",
            buildId: "fixture",
            since: "2",
            throughRevision: "4",
            upserts: [point("moved")],
            removedIds: ["deleted"],
          })
        }
        const body = JSON.parse(init.body)
        seen.push(body)
        return Response.json({
          schemaVersion: 1,
          queryEpoch: "epoch",
          dictionaryVersion: "dict",
          indexedThrough: "4",
          populations: {
            listed: {
              mode: "tiles",
              exactTotal: 1,
              complete: true,
              archiveBuildId: "fixture",
            },
          },
        })
      })
    )
    const result = await loadAtlasGeneration(
      request,
      new AbortController().signal
    )
    expect(seen[0]).toMatchObject({ since: "2", buildId: "fixture" })
    expect(seen[1]).toMatchObject({
      archiveBuildId: "fixture",
      drawingPreference: "auto",
    })
    expect(result.changedIds).toEqual(["deleted", "moved"])
    expect(result.upserts.map((point) => point.properties.i)).toEqual(["moved"])
    expect(result.manifest?.buildId).toBe("fixture")
  })
})

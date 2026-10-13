import {
  atlasCell,
  atlasPoint,
  emptyAtlasFilters,
  projectAtlasLibrary,
} from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import type { AtlasGeneration } from "../atlas-data-client"
import { AtlasScalableRenderer } from "../atlas-scalable-renderer"

const point = atlasPoint(
  projectAtlasLibrary(
    {
      documentId: "one",
      name: "One",
      slug: "one",
      locale: "en",
      published: true,
      location: { lat: 52, lng: 1 },
    },
    { atlasId: 1, canonicalLocale: "en", now: new Date() }
  )!
)
function fixture() {
  const sources = new Map<string, any>(),
    layers = new Map<string, any>()
  const map = {
    addSource: (id: string, source: any) => sources.set(id, source),
    addLayer: (layer: any) => layers.set(layer.id, layer),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    removeSource: (id: string) => sources.delete(id),
    removeLayer: (id: string) => layers.delete(id),
    getStyle: () => ({ glyphs: "fixture" }),
    setPaintProperty: vi.fn(),
    loaded: () => true,
    isSourceLoaded: () => true,
    on: vi.fn(),
    off: vi.fn(),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    queryRenderedFeatures: vi.fn(),
  }
  const select = vi.fn(),
    renderer = new AtlasScalableRenderer(map as any, select)
  const generation: AtlasGeneration = {
    dictionary: { version: "fixture", entries: [] },
    manifest: null,
    changedIds: [],
    upserts: [],
    scope: {
      filters: emptyAtlasFilters(),
      accessibility: { enabled: false, selected: [], view: "matches" },
    },
    viewport: {
      schemaVersion: 1,
      fingerprint: "fixture",
      queryEpoch: "fixture",
      dictionaryVersion: "fixture",
      indexedThrough: "1",
      evaluatedAt: new Date().toISOString(),
      populations: {},
    },
  }

  return { map, select, renderer, generation, sources, layers }
}
it("clusters bounded actual points and keeps heat on unclustered coordinates", async () => {
  const f = fixture()
  f.generation.viewport.populations.listed = {
    mode: "points",
    complete: true,
    exactTotal: 2,
    points: [
      point,
      { ...point, id: 2, properties: { ...point.properties, i: "two" } },
    ],
  }
  f.renderer.update(f.generation, ["pins", "density"], 0.7)
  const cluster = [...f.sources.entries()].find(([, source]) => source.cluster)
  expect(cluster).toBeTruthy()
  expect(
    [...f.layers.values()].find((layer) => layer.type === "heatmap")?.source
  ).not.toBe(cluster![0])
  const getClusterExpansionZoom = vi.fn(async () => 12)
  f.sources.set(cluster![0], { getClusterExpansionZoom })
  f.map.queryRenderedFeatures.mockReturnValue([
    {
      source: cluster![0],
      properties: { cluster_id: 1 },
      geometry: { type: "Point", coordinates: [1, 52] },
    },
  ])
  expect(f.renderer.click([0, 0])).toBe(true)
  await Promise.resolve()
  await Promise.resolve()
  expect(getClusterExpansionZoom).toHaveBeenCalledWith(1)
  expect(f.map.easeTo).toHaveBeenCalledWith({ center: [1, 52], zoom: 12 })
})
it("shows ready Atlas sources while unrelated basemap tiles are still loading", () => {
  const f = fixture()
  f.map.loaded = () => false
  f.generation.viewport.populations.listed = {
    mode: "points",
    complete: true,
    exactTotal: 1,
    points: [point],
  }
  f.renderer.update(f.generation, ["pins"], 0.7)
  expect(f.map.setPaintProperty).toHaveBeenCalled()
})
it("draws a one-library aggregate as a selectable pin instead of a numbered group", () => {
  const f = fixture(),
    cell = atlasCell("4/8/5")
  f.generation.viewport.populations.listed = {
    mode: "aggregate",
    complete: true,
    exactTotal: 1201,
    cells: [
      { ...cell, centre: { lat: 52, lng: 1 }, total: 1, point },
      { ...cell, id: "other", total: 1200 },
    ],
  }
  f.renderer.update(f.generation, ["pins"], 0.7)
  const features = [...f.sources.values()].flatMap((s) => s.data.features)
  expect(
    features.find((feature) => feature.properties.i === "one")?.geometry
  ).toEqual(point.geometry)
  f.map.queryRenderedFeatures.mockReturnValue([{ properties: { i: "one" } }])
  f.renderer.click([0, 0])
  expect(f.select).toHaveBeenCalledWith("one")
})
it("uses the complete density grid independently of pin anchors and hands over to pins at street zoom", () => {
  const f = fixture(),
    a = atlasCell("12/2037/1328"),
    b = atlasCell("12/2038/1328")
  f.generation.viewport.populations.listed = {
    mode: "aggregate",
    complete: true,
    exactTotal: 1201,
    cells: [{ ...a, centre: { lat: 52, lng: 1 }, total: 1201 }],
    density: {
      cells: [
        { id: a.id, total: 700 },
        { id: b.id, total: 501 },
      ],
    },
  }
  f.renderer.update(f.generation, ["pins", "density"], 0.9)
  const heat = [...f.layers.values()].find((layer) => layer.type === "heatmap")!
  const features = f.sources.get(heat.source).data.features
  expect(features.map((feature: any) => feature.geometry.coordinates)).toEqual([
    [a.centre.lng, a.centre.lat],
    [b.centre.lng, b.centre.lat],
  ])
  expect(
    features.reduce(
      (sum: number, feature: any) => sum + feature.properties.total,
      0
    )
  ).toBe(1201)
  expect(heat.paint["heatmap-intensity"]).toBeTruthy()
  expect(heat.paint["heatmap-radius"]).toBeInstanceOf(Array)
  expect(heat.maxzoom).toBe(13)
  f.map.queryRenderedFeatures.mockReturnValue([])
  expect(f.renderer.click([0, 0])).toBe(false)
  expect(f.map.queryRenderedFeatures).toHaveBeenCalledWith([0, 0], {
    layers: expect.not.arrayContaining([heat.id]),
  })
  expect(
    [...f.layers.values()]
      .filter((layer) => layer.type !== "heatmap")
      .every((layer) => layer.minzoom === 8)
  ).toBe(true)
  f.renderer.update(f.generation, ["pins"], 0.9)
  expect([...f.layers.values()].some((layer) => layer.type === "heatmap")).toBe(
    false
  )
  expect([...f.layers.values()].every((layer) => layer.minzoom === 0)).toBe(
    true
  )
})

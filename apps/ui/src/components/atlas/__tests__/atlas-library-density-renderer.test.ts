import {
  atlasCellId,
  atlasDensityCell,
  DEFAULT_ATLAS_DENSITY,
  type AtlasLibraryDensity,
} from "@repo/shared-data"
import type { FeatureCollection, Geometry } from "geojson"
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  SourceSpecification,
} from "maplibre-gl"
import { expect, it, vi } from "vitest"

import { AtlasLibraryDensityRenderer } from "../atlas-library-density-renderer"

vi.mock("../atlas-pmtiles", () => ({
  retainAtlasArchive: vi.fn(),
  releaseAtlasArchive: vi.fn(),
}))
function fixture() {
  const sources = new Map<string, SourceSpecification>(),
    layers = new Map<string, LayerSpecification>()
  const map = {
    getStyle: () => ({ layers: [{ id: "pins" }] }),
    addSource: (id: string, source: SourceSpecification) =>
      sources.set(id, source),
    getSource: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
    isSourceLoaded: () => true,
    setPaintProperty: vi.fn(),
    on: vi.fn<(event: string, callback: () => void) => void>(),
    off: vi.fn(),
    queryRenderedFeatures: vi.fn(
      () => [] as { properties: { cell: string; total: number } }[]
    ),
    getZoom: () => 18,
  }
  const select = vi.fn()
  const data: AtlasLibraryDensity = {
    mode: "cells",
    resolution: 18,
    requestedResolution: 18,
    coarsened: false,
    exactTotal: 3,
    cells: [{ id: atlasCellId({ lat: 51.5, lng: -0.1 }, 18), total: 3 }],
  }

  return {
    sources,
    layers,
    map,
    data,
    select,
    renderer: new AtlasLibraryDensityRenderer(
      map as unknown as MapLibreMap,
      select
    ),
  }
}
it("renders numeric geographic rates at street zoom without clusters or a zoom fade", () => {
  const f = fixture()
  f.renderer.update(f.data, DEFAULT_ATLAS_DENSITY)
  const source = [...f.sources.values()][0] as GeoJSONSourceSpecification
  expect(source.cluster).toBeUndefined()
  const data = source.data as FeatureCollection<
    Geometry,
    { cell: string; per100Km2: number }
  >
  const cell = data.features.find(
    (feature) => feature.geometry.type === "Polygon"
  )!
  expect(cell.properties.per100Km2).toBe(
    atlasDensityCell(cell.properties.cell, 3).per100Km2
  )
  expect(
    [...f.layers.values()].every((layer) => layer.maxzoom === undefined)
  ).toBe(true)
  expect(f.map.setPaintProperty).toHaveBeenCalledWith(
    expect.stringContaining("-grid"),
    "fill-opacity",
    DEFAULT_ATLAS_DENSITY.opacity
  )
  f.renderer.destroy()
  expect(f.layers.size).toBe(0)
  expect(f.sources.size).toBe(0)
})
it("inspects the original count in smooth mode, including empty cells", () => {
  const f = fixture()
  f.renderer.update(f.data, { ...DEFAULT_ATLAS_DENSITY, view: "smooth" })
  expect([...f.layers.values()].some((layer) => layer.type === "heatmap")).toBe(
    true
  )
  f.map.queryRenderedFeatures.mockReturnValue([
    { properties: { cell: f.data.cells[0]!.id, total: 3 } },
  ])
  f.renderer.click([10, 10], { lat: 51.5, lng: -0.1 })
  expect(f.select).toHaveBeenLastCalledWith(
    atlasDensityCell(f.data.cells[0]!.id, 3)
  )
  f.map.queryRenderedFeatures.mockReturnValue([])
  f.renderer.click([20, 20], { lat: 10, lng: 10 })
  expect(f.select.mock.lastCall?.[0].total).toBe(0)
})
it("commits a new source only when ready and discards superseded pending sources", () => {
  const f = fixture()
  f.renderer.update(f.data, DEFAULT_ATLAS_DENSITY)
  const before = [...f.sources.keys()][0]
  f.map.isSourceLoaded = () => false
  f.renderer.update({ ...f.data, exactTotal: 4 }, DEFAULT_ATLAS_DENSITY)
  expect(f.sources.has(before!)).toBe(true)
  f.renderer.update({ ...f.data, exactTotal: 5 }, DEFAULT_ATLAS_DENSITY)
  expect(f.sources.size).toBe(2)
  f.map.isSourceLoaded = () => true
  const commit = f.map.on.mock.lastCall?.[1] as () => void
  commit()
  expect(f.sources.size).toBe(1)
  expect(f.sources.has(before!)).toBe(false)
})

it("changes shading without rebuilding loaded geometry", () => {
  const f = fixture()
  f.renderer.update(f.data, DEFAULT_ATLAS_DENSITY)
  const source = [...f.sources.keys()][0]
  f.renderer.update({ ...f.data }, { ...DEFAULT_ATLAS_DENSITY, opacity: 0.3 })
  expect([...f.sources.keys()]).toEqual([source])
  expect(f.map.setPaintProperty).toHaveBeenCalledWith(
    `${source}-grid`,
    "fill-opacity",
    0.3
  )
})

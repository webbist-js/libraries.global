import type { AtlasReachResult } from "@repo/shared-data"
import { expect, it, vi } from "vitest"

import { AtlasReachRenderer } from "../atlas-reach-renderer"

it("renders one selected contour, reuses its source and removes all catchment geometry when cleared", () => {
  const layers = new Map(),
    sources = new Map()
  const map = {
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: Record<string, unknown>) =>
      sources.set(id, { ...source, setData: vi.fn() }),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    getStyle: () => ({ layers: [{ id: "pins", type: "circle" }] }),
    setPaintProperty: vi.fn(),
  }
  const renderer = new AtlasReachRenderer(
    map as unknown as ConstructorParameters<typeof AtlasReachRenderer>[0]
  )
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  }
  const result = {
    contours: [
      { minutes: 5, geometry },
      { minutes: 15, geometry },
    ],
  } as AtlasReachResult
  renderer.update(result, 5, 0.7)
  expect(sources.size).toBe(1)
  expect(layers.size).toBe(2)
  expect(sources.get("atlas-reach").data.features).toHaveLength(1)
  renderer.update(result, 5, 0.5)
  expect(sources.get("atlas-reach").setData).not.toHaveBeenCalled()
  renderer.update(result, 15, 0.5)
  expect(sources.get("atlas-reach").setData).toHaveBeenCalledOnce()
  renderer.update(null, 15, 0.5)
  expect(sources.size).toBe(0)
  expect(layers.size).toBe(0)
})

// @vitest-environment happy-dom
import type { Map as MapLibreMap } from "maplibre-gl"
import { afterEach, expect, it, vi } from "vitest"

import {
  bindMapAppearance,
  DARK_MAP_PALETTE,
  NEUTRAL_CLUSTER_METADATA,
} from "@/lib/map-appearance"

afterEach(() => {
  document.documentElement.classList.remove("dark")
})
it("retints only captured basemap paint and restores expressions without replacing style or camera", async () => {
  const expression = [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    "#fff",
    10,
    "#eee",
  ]
  const layers: {
    id: string
    type: string
    paint: Record<string, unknown>
  }[] = [
    {
      id: "land",
      type: "background",
      paint: { "background-color": "#faf8f4" },
    },
    { id: "water", type: "fill", paint: { "fill-color": expression } },
  ]
  const map = {
    getStyle: () => ({ layers }),
    getLayer: vi.fn(() => ({})),
    isStyleLoaded: () => true,
    on: vi.fn(),
    off: vi.fn(),
    setPaintProperty: vi.fn(),
    setStyle: vi.fn(),
    jumpTo: vi.fn(),
    removeSource: vi.fn(),
  }
  const dispose = bindMapAppearance(map as unknown as MapLibreMap)
  layers.push({
    id: "selected-library",
    type: "fill",
    paint: { "fill-color": "#4338ca" },
  })
  map.setPaintProperty.mockClear()
  document.documentElement.classList.add("dark")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "water",
    "fill-color",
    DARK_MAP_PALETTE.water
  )
  expect(
    map.setPaintProperty.mock.calls.some(
      (call) => call[0] === "selected-library"
    )
  ).toBe(false)
  document.documentElement.classList.remove("dark")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(map.setPaintProperty).toHaveBeenCalledWith(
    "water",
    "fill-color",
    expression
  )
  expect(map.setStyle).not.toHaveBeenCalled()
  expect(map.jumpTo).not.toHaveBeenCalled()
  expect(map.removeSource).not.toHaveBeenCalled()
  dispose()
  expect(map.off).toHaveBeenCalledWith("style.load", expect.any(Function))
})

it("themes new neutral clusters, preserves data expressions, and restores light paint without style reloads", async () => {
  type Layer = {
    id: string
    type: string
    paint: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
  const layers: Layer[] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#faf8f4" },
    },
    {
      id: "road_pri_case_noramp",
      type: "line",
      paint: { "line-color": "#aaa" },
    },
    {
      id: "road_pri_fill_noramp",
      type: "line",
      paint: { "line-color": "#fff" },
    },
  ]
  const listeners = new Map<string, () => void>()
  const map = {
    getStyle: () => ({ layers }),
    getLayer: (id: string) => layers.find((layer) => layer.id === id),
    isStyleLoaded: () => true,
    on: vi.fn((event: string, handler: () => void) =>
      listeners.set(event, handler)
    ),
    off: vi.fn(),
    setPaintProperty: vi.fn((id: string, property: string, value: unknown) => {
      layers.find((layer) => layer.id === id)!.paint[property] = value
    }),
    setStyle: vi.fn(),
  }
  const dispose = bindMapAppearance(map as unknown as MapLibreMap)
  const counts: Layer = {
    id: "scalable-7-1",
    type: "circle",
    metadata: NEUTRAL_CLUSTER_METADATA,
    paint: { "circle-color": "#fff", "circle-stroke-color": "#4338CA" },
  }
  const text: Layer = {
    id: "scalable-7-2",
    type: "symbol",
    metadata: NEUTRAL_CLUSTER_METADATA,
    paint: { "text-color": "#17162B" },
  }
  const access = ["case", ["get", "confirmed"], "#0072B2", "#fff"]
  layers.push(counts, text, {
    id: "accessibility",
    type: "circle",
    metadata: NEUTRAL_CLUSTER_METADATA,
    paint: { "circle-color": access },
  })
  document.documentElement.classList.add("dark")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(counts.paint["circle-color"]).toBe(DARK_MAP_PALETTE.cluster)
  expect(text.paint["text-color"]).toBe(DARK_MAP_PALETTE.clusterText)
  expect(map.getLayer("accessibility")!.paint["circle-color"]).toBe(access)
  expect(map.getLayer("road_pri_case_noramp")!.paint["line-color"]).not.toBe(
    map.getLayer("road_pri_fill_noramp")!.paint["line-color"]
  )
  // A newly loaded generation and an accessibility-to-neutral switch must both
  // pick up the current appearance, without waiting for another theme toggle.
  counts.paint["circle-color"] = "#fff"
  listeners.get("styledata")!()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(counts.paint["circle-color"]).toBe(DARK_MAP_PALETTE.cluster)
  const writes = map.setPaintProperty.mock.calls.length
  listeners.get("styledata")!()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(map.setPaintProperty).toHaveBeenCalledTimes(writes)
  document.documentElement.classList.remove("dark")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(counts.paint["circle-color"]).toBe("#fff")
  expect(text.paint["text-color"]).toBe("#17162b")
  expect(map.setStyle).not.toHaveBeenCalled()
  dispose()
  expect(map.off).toHaveBeenCalledWith("styledata", expect.any(Function))
})

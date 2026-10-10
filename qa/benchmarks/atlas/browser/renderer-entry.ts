import { atlasCell, emptyAtlasFilters, type AtlasPoint } from "@repo/shared-data"

import type { AtlasGeneration } from "../../../../apps/ui/src/components/atlas/atlas-data-client"
import { addPinImages } from "../../../../apps/ui/src/components/atlas/atlas-map.style"
import { AtlasScalableRenderer } from "../../../../apps/ui/src/components/atlas/atlas-scalable-renderer"

const lib = (globalThis as any).maplibregl
const point: AtlasPoint = {
  type: "Feature",
  id: 1,
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: {
    i: "one",
    n: "Fixture",
    s: "fixture",
    t: "public",
    o: null,
    st: "open",
    ct: null,
    co: null,
    r: null,
    ar: null,
    ci: null,
    a: ",access_one,",
    f: "",
    e: true,
    c: false,
    l: true,
    y: null,
    p: null,
  },
}
let map: any, renderer: AtlasScalableRenderer
const base = (): AtlasGeneration => ({
  scope: {
    bbox: { west: -1, east: 1, south: -1, north: 1 },
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
  dictionary: { version: "fixture", entries: [] },
  manifest: null,
  changedIds: [],
  upserts: [],
  viewport: {
    schemaVersion: 1,
    fingerprint: "fixture",
    queryEpoch: "fixture",
    dictionaryVersion: "fixture",
    indexedThrough: "1",
    evaluatedAt: new Date().toISOString(),
    populations: {},
  },
})
;(globalThis as any).atlasRendererSmoke = {
  async start() {
    map = new lib.Map({
      container: "map",
      preserveDrawingBuffer: true,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eee" },
          },
        ],
      },
      center: [0, 0],
      zoom: 12,
    })
    await new Promise((resolve) => map.once("load", resolve))
    addPinImages(map)
    renderer = new AtlasScalableRenderer(map, () => {})
    map.on("error", (event: any) => {
      ;(globalThis as any).atlasRendererErrors.push(event.error.message)
    })
  },
  async step(aggregate: boolean, x = 0) {
    const generation = base()
    generation.viewport.populations.listed = aggregate
      ? {
          mode: "aggregate",
          exactTotal: 1200,
          complete: true,
          cells: [
            {
              id: "cell",
              centre: { lat: 0, lng: 0 },
              bounds: { west: -1, east: 1, south: -1, north: 1 },
              total: 1200,
              completeness: { unknown: 300, low: 300, medium: 300, high: 300 },
              coverage: {
                total: 1200,
                matches: 700,
                partial: 300,
                unconfirmed: 500,
              },
            },
          ],
        }
      : { mode: "points", exactTotal: 1, complete: true, points: [point] }
    renderer.update(generation, ["pins", "complete", "density"], 0.7)
    map.jumpTo({ center: [x, 0] })
    await new Promise((resolve) => {
      if (map.loaded()) resolve(undefined)
      else map.once("idle", resolve)
    })
    // The commit changes paint on idle; wait for its next frame as well.
    await new Promise<void>((resolve) => {
      map.once("render", () => resolve())
      map.triggerRepaint()
    })
    const layers = map
      .getStyle()
      .layers.filter((layer: any) => layer.id.startsWith("scalable-"))
    const visible = layers.some((layer: any) =>
      Object.entries(layer.paint ?? {}).some(
        ([key, value]) =>
          key.endsWith("-opacity") && typeof value === "number" && value > 0
      )
    )

    return {
      layers: layers.length,
      sources: Object.keys(map.getStyle().sources).length,
      rendered: visible
        ? map
            .queryRenderedFeatures()
            .filter((f: any) => f.layer.id.startsWith("scalable-")).length
        : 0,
    }
  },
  finish() {
    renderer.destroy()
    const sources = Object.keys(map.getStyle().sources).length
    map.remove()

    return sources
  },
  async weightedCluster() {
    const generation = base()
    generation.viewport.populations.listed = {
      mode: "aggregate",
      exactTotal: 1901,
      complete: true,
      cells: [1200, 700, 1].map((total, index) => ({
        id: `weighted-${index}`,
        centre: { lat: 0, lng: index / 1000 },
        bounds: { west: -1, east: 1, south: -1, north: 1 },
        total,
        ...(total === 1 ? { point } : {}),
        completeness: { unknown: 0, low: 0, medium: 0, high: total },
        coverage: { total, matches: total, partial: 0, unconfirmed: 0 },
      })),
    }
    renderer.update(generation, ["pins", "complete", "density"], 0.7)
    map.jumpTo({ center: [0, 0], zoom: 8 })
    await new Promise((resolve) => map.once("idle", resolve))
    await new Promise((resolve) => {
      map.once("render", resolve)
      map.triggerRepaint()
    })

    return map
      .queryRenderedFeatures()
      .filter((feature: any) => feature.properties.cluster_id !== undefined)
      .map((feature: any) => feature.properties)
  },
  async densityGrid() {
    const generation = base(),
      cell = atlasCell("9/257/256"),
      density = {
        cells: Array.from({ length: 40 }, (_, n) => ({
          id: `12/${2044 + (n % 8)}/${2045 + Math.floor(n / 8)}`,
          total: 30,
        })),
      }
    generation.viewport.populations.listed = {
      mode: "aggregate",
      exactTotal: 1200,
      complete: true,
      cells: [{ ...cell, centre: { lat: 0, lng: 1 }, total: 1200 }],
      density,
    }
    const settled = async () => {
      await new Promise((resolve) => map.once("idle", resolve))
      await new Promise((resolve) => {
        map.once("render", resolve)
        map.triggerRepaint()
      })
    }
    const pixel = () => {
      const canvas = document.createElement("canvas"),
        source = map.getCanvas()
      canvas.width = source.width
      canvas.height = source.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(source, 0, 0)
      // Halfway between two occupied cells tests the blurred surface as well
      // as the per-cell weights with MapLibre's actual WebGL renderer.
      const centre = atlasCell("12/2047/2047").centre,
        screen = map.project([0, centre.lat]),
        scale = source.width / map.getContainer().clientWidth

      return [...ctx.getImageData(screen.x * scale, screen.y * scale, 1, 1).data]
    }
    renderer.update(generation, ["pins", "density"], 0.7)
    map.jumpTo({ center: [0, 0], zoom: 6.3 })
    await settled()
    const colour = pixel(),
      heatClickHandled = renderer.click([450, 300]),
      pinCount = map
        .queryRenderedFeatures()
        .filter((feature: any) => feature.layer.type !== "heatmap").length,
      style = map.getStyle(),
      heat = style.layers.find((layer: any) => layer.type === "heatmap")
    renderer.update(generation, ["pins", "density"], 0)
    await settled()
    const transparent = pixel()
    renderer.update(generation, ["pins"], 0.7)
    await settled()

    return {
      cells: density.cells.length,
      total: density.cells.reduce((sum, row) => sum + row.total, 0),
      colour,
      transparent,
      pinCount,
      heatClickHandled,
      restoredPins: map.queryRenderedFeatures().length,
      minzoom: heat.minzoom,
      maxzoom: heat.maxzoom,
    }
  },
}

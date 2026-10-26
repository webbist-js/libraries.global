import {
  atlasCell,
  atlasCellId,
  atlasDensityCell,
  atlasDensityGeometry,
  atlasDensityScale,
  atlasDensityResolution,
  ATLAS_DENSITY_OFFSET,
  ATLAS_DENSITY_COLORS,
  ATLAS_DENSITY_BREAKS,
  type AtlasDensitySelection,
  type AtlasDensitySettings,
  type AtlasLibraryDensity,
} from "@repo/shared-data"
import type {
  Map as MapLibreMap,
  ExpressionSpecification,
  LayerSpecification,
  PointLike,
} from "maplibre-gl"

import { heatColor } from "./atlas-map.style"
import { retainAtlasArchive, releaseAtlasArchive } from "./atlas-pmtiles"

type Graph = {
  source: string
  layers: string[]
  data: AtlasLibraryDensity
  archive?: string
  key: string
  view: AtlasDensitySettings["view"]
  scale: AtlasDensitySettings["scale"]
  smoothing: number
}
let sequence = 0

/** Density owns its data and zoom behaviour independently of pin clustering. */
export class AtlasLibraryDensityRenderer {
  private current: Graph | null = null
  private pending: Graph | null = null
  private commit: (() => void) | null = null
  constructor(
    private readonly map: MapLibreMap,
    private readonly select: (cell: AtlasDensitySelection) => void
  ) {}

  private remove(graph: Graph | null) {
    if (!graph) return
    for (const id of graph.layers)
      if (this.map.getLayer(id)) this.map.removeLayer(id)
    if (this.map.getSource(graph.source)) this.map.removeSource(graph.source)
    if (graph.archive) releaseAtlasArchive(graph.archive)
  }

  update(data: AtlasLibraryDensity | null, settings: AtlasDensitySettings) {
    const key = JSON.stringify(data)
    if (
      !this.pending &&
      this.current &&
      this.current.key === key &&
      this.current.view === settings.view &&
      this.current.scale === settings.scale &&
      this.current.smoothing === settings.smoothing
    ) {
      const source = this.current.source
      this.current.data = data!
      for (const [suffix, property, opacity] of [
        ["surface", "heatmap-opacity", settings.opacity],
        [
          "grid",
          "fill-opacity",
          settings.view === "grid" ? settings.opacity : 0,
        ],
        ["edges", "line-opacity", settings.opacity * 0.2],
      ] as const)
        if (this.map.getLayer(`${source}-${suffix}`))
          this.map.setPaintProperty(`${source}-${suffix}`, property, opacity)

      return
    }
    if (this.commit) this.map.off("sourcedata", this.commit)
    this.commit = null
    this.remove(this.pending)
    this.pending = null
    if (!data) {
      this.remove(this.current)
      this.current = null

      return
    }
    const source = `library-density-${++sequence}`
    const graph: Graph = {
      source,
      layers: [],
      data,
      key,
      view: settings.view,
      scale: settings.scale,
      smoothing: settings.smoothing,
    }
    this.pending = graph
    if (data.mode === "tiles" && data.archive) {
      retainAtlasArchive(data.archive.url)
      graph.archive = data.archive.url
      this.map.addSource(source, {
        type: "vector",
        url: `pmtiles://${data.archive.url}`,
        minzoom: 0,
        maxzoom: 16,
      })
    } else {
      const features = data.cells.flatMap(({ id, total }) => {
        const cell = atlasCell(id)
        const value = atlasDensityCell(id, total)
        const properties = {
          cell: id,
          total,
          areaKm2: value.areaKm2,
          per100Km2: value.per100Km2,
        }

        return [
          {
            type: "Feature" as const,
            geometry: atlasDensityGeometry(id),
            properties: { ...properties, shape: "grid" },
          },
          {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [cell.centre.lng, cell.centre.lat],
            },
            properties: { ...properties, shape: "point" },
          },
        ]
      })
      this.map.addSource(source, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
        buffer: 128,
        // Keep coarse-cell centres in their parent tiles when overzooming a
        // preferred resolution. Retiling them at street zoom would discard
        // centres whose broad smoothing kernel still intersects the view.
        maxzoom: Math.max(0, data.resolution - ATLAS_DENSITY_OFFSET),
      })
    }
    const before = this.map
      .getStyle()
      .layers?.find(
        (layer) =>
          layer.id.startsWith("scalable-") ||
          ["atlas-reach-fill", "pins", "heat"].includes(layer.id)
      )?.id
    const max = atlasDensityScale(data, settings.scale)
    const color = [
      "interpolate",
      ["linear"],
      ["get", "per100Km2"],
      ...ATLAS_DENSITY_COLORS.flatMap((c, i) => [
        (ATLAS_DENSITY_BREAKS[i]! * max) / 100,
        c,
      ]),
    ] as ExpressionSpecification
    const paints: {
      id: string
      property: "fill-opacity" | "heatmap-opacity" | "line-opacity"
      value: number
    }[] = []
    const add = (
      name: string,
      type: "fill" | "heatmap" | "line",
      paint: Record<string, unknown>,
      property: "fill-opacity" | "heatmap-opacity" | "line-opacity",
      opacity: number,
      grid: boolean
    ) => {
      const id = `${source}-${name}`
      this.map.addLayer(
        {
          id,
          type,
          source,
          ...(graph.archive
            ? { "source-layer": grid ? "density-grid" : "density" }
            : { filter: ["==", ["get", "shape"], grid ? "grid" : "point"] }),
          paint: {
            ...paint,
            [property]: 0,
            [`${property}-transition`]: { duration: 0 },
          },
        } as LayerSpecification,
        before
      )
      graph.layers.push(id)
      paints.push({ id, property, value: opacity })
    }
    if (settings.view === "smooth") {
      // Smooth concentration is deliberately labelled relative. Numeric area
      // rates always come from the underlying unsmoothed cells.
      const radius: ExpressionSpecification = graph.archive
        ? [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            0,
            32 * settings.smoothing,
            16,
            32 * settings.smoothing,
            24,
            8192 * settings.smoothing,
          ]
        : [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            0,
            (512 * settings.smoothing) / 2 ** data.resolution,
            24,
            512 * settings.smoothing * 2 ** (24 - data.resolution),
          ]
      add(
        "surface",
        "heatmap",
        {
          "heatmap-weight": [
            "min",
            1,
            ["sqrt", ["/", ["get", "per100Km2"], max]],
          ],
          "heatmap-intensity": 3,
          "heatmap-radius": radius,
          "heatmap-color": heatColor(ATLAS_DENSITY_COLORS),
        },
        "heatmap-opacity",
        settings.opacity,
        false
      )
    }
    add(
      "grid",
      "fill",
      { "fill-color": color, "fill-antialias": false },
      "fill-opacity",
      settings.view === "grid" ? settings.opacity : 0,
      true
    )
    if (settings.view === "grid")
      add(
        "edges",
        "line",
        { "line-color": "#4338CA", "line-width": 0.4 },
        "line-opacity",
        settings.opacity * 0.2,
        true
      )
    this.commit = () => {
      if (this.pending !== graph || !this.map.isSourceLoaded(source)) return
      for (const p of paints)
        this.map.setPaintProperty(p.id, p.property, p.value)
      this.remove(this.current)
      this.current = graph
      this.pending = null
      if (this.commit) this.map.off("sourcedata", this.commit)
      this.commit = null
    }
    this.map.on("sourcedata", this.commit)
    this.commit()
  }

  click(point: PointLike, location: { lat: number; lng: number }): boolean {
    const graph = this.current
    if (!graph) return false
    const hit = this.map.queryRenderedFeatures(point, {
      layers: [`${graph.source}-grid`],
    })[0]
    if (hit?.properties.cell)
      this.select(
        atlasDensityCell(
          String(hit.properties.cell),
          Number(hit.properties.total)
        )
      )
    else {
      const resolution =
        graph.data.mode === "tiles"
          ? atlasDensityResolution(this.map.getZoom())
          : graph.data.resolution
      const id = atlasCellId(location, resolution)
      this.select(
        atlasDensityCell(
          id,
          graph.data.cells.find((cell) => cell.id === id)?.total ?? 0
        )
      )
    }

    return true
  }

  highlight(cell: AtlasDensitySelection | null) {
    const source = "library-density-selection"
    for (const id of [`${source}-line`, `${source}-fill`])
      if (this.map.getLayer(id)) this.map.removeLayer(id)
    if (this.map.getSource(source)) this.map.removeSource(source)
    if (!cell || !this.current) return
    this.map.addSource(source, {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: atlasDensityGeometry(cell.id),
        properties: {},
      },
    })
    this.map.addLayer({
      id: `${source}-fill`,
      source,
      type: "fill",
      paint: { "fill-color": "#4338CA", "fill-opacity": 0.1 },
    })
    this.map.addLayer({
      id: `${source}-line`,
      source,
      type: "line",
      paint: { "line-color": "#4338CA", "line-width": 2 },
    })
  }

  destroy() {
    this.highlight(null)
    if (this.commit) this.map.off("sourcedata", this.commit)
    this.remove(this.pending)
    this.remove(this.current)
    this.pending = this.current = null
    this.commit = null
  }
}

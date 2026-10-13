import {
  atlasResolveScope,
  atlasTileFilter,
  atlasCell,
  type AtlasPopulation,
  type AtlasViewportPopulation,
} from "@repo/shared-data"
import type {
  Map as MapLibreMap,
  LayerSpecification,
  ExpressionSpecification,
  PointLike,
  GeoJSONSource,
  HeatmapLayerSpecification,
} from "maplibre-gl"

import type { AtlasGeneration } from "./atlas-data-client"
import {
  completenessColor,
  accessibilityClusterStyle,
  heatmapPaint,
  RAMP,
  INDIGO,
} from "./atlas-map.style"
import { retainAtlasArchive, releaseAtlasArchive } from "./atlas-pmtiles"
import type { LayerId } from "./atlas.logic"

type Graph = {
  archiveUrl?: string
  layers: {
    id: string
    opacity: Record<string, unknown>
    interactive: boolean
  }[]
  sources: string[]
}
const collection = (
  features: GeoJSON.Feature[]
): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features })
let nextGraph = 0

/** All building populations switch together once their new sources are ready.
 * Mobile sources, camera and selection DOM markers remain independently owned. */
export class AtlasScalableRenderer {
  private current: Graph = { layers: [], sources: [] }
  private pending: Graph | null = null
  private commit: (() => void) | null = null
  constructor(
    private readonly map: MapLibreMap,
    private readonly select: (id: string) => void
  ) {}

  private remove(graph: Graph) {
    for (const layer of graph.layers)
      if (this.map.getLayer(layer.id)) this.map.removeLayer(layer.id)
    for (const source of graph.sources)
      if (this.map.getSource(source)) this.map.removeSource(source)
    if (graph.archiveUrl) releaseAtlasArchive(graph.archiveUrl)
  }

  update(generation: AtlasGeneration, active: LayerId[], heatOpacity: number) {
    if (this.commit) this.map.off("sourcedata", this.commit)
    if (this.pending) this.remove(this.pending)
    const graph: Graph = { layers: [], sources: [] },
      prefix = `scalable-${++nextGraph}`
    this.pending = graph
    const add = (
      source: string,
      kind: LayerSpecification["type"],
      filter: unknown,
      paint: Record<string, unknown>,
      layout: Record<string, unknown> = {},
      layerName?: string,
      minzoom = 0
    ) => {
      const id = `${prefix}-${graph.layers.length}`
      const opacity: Record<string, unknown> = {}
      for (const property of Object.keys(paint))
        if (property.endsWith("-opacity")) opacity[property] = paint[property]
      if (kind === "symbol") {
        opacity["icon-opacity"] ??= 1
        if (layout["text-field"]) opacity["text-opacity"] ??= 1
      }
      if (kind === "circle") {
        opacity["circle-opacity"] ??= 1
        opacity["circle-stroke-opacity"] ??= 1
      }
      if (kind === "heatmap") opacity["heatmap-opacity"] ??= heatOpacity
      const hidden = Object.fromEntries(
        Object.keys(opacity).map((property) => [property, 0])
      )
      // A completed generation must become visible in the same frame that the
      // old one is removed, without MapLibre's default opacity fade from zero.
      const transitions = Object.fromEntries(
        Object.keys(opacity).map((property) => [
          `${property}-transition`,
          { duration: 0, delay: 0 },
        ])
      )
      this.map.addLayer({
        id,
        type: kind,
        source,
        minzoom,
        maxzoom: kind === "heatmap" ? 13 : 24,
        ...(layerName ? { "source-layer": layerName } : {}),
        ...(filter ? { filter } : {}),
        paint: { ...paint, ...hidden, ...transitions },
        layout,
      } as LayerSpecification)
      graph.layers.push({ id, opacity, interactive: kind !== "heatmap" })
    }
    const pinZoom = (population: AtlasPopulation) =>
      population === "listed" &&
      (active.includes("density") || active.includes("events"))
        ? 8
        : 0
    const points = (
      source: string,
      population: AtlasPopulation,
      filter: unknown,
      layerName?: string,
      drawHeat = true
    ) => {
      if (
        drawHeat &&
        ((population === "listed" && active.includes("density")) ||
          (population === "events" && active.includes("events")))
      )
        add(source, "heatmap", filter, heatmapPaint(heatOpacity), {}, layerName)
      if (population === "listed") {
        if (active.includes("pins")) {
          if (active.includes("complete")) {
            // The compact properties retain null completeness explicitly.
            const color = completenessColor("p")
            add(
              source,
              "circle",
              filter,
              {
                "circle-radius": 7,
                "circle-color": color,
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 1.5,
              },
              {},
              layerName,
              pinZoom(population)
            )
          } else {
            const resolved = atlasResolveScope(
              generation.scope,
              generation.dictionary
            )
            const membership: unknown[] = resolved.access.length
              ? [
                  "all",
                  ...resolved.access.map((group) => [
                    "any",
                    ...group.map((code) => ["in", `,${code},`, ["get", "a"]]),
                  ]),
                ]
              : ["!=", ["get", "a"], ""]
            const icon = active.includes("access")
              ? ["case", membership, "pin-access-match", "pin-access-gap"]
              : ["concat", "pin-", ["get", "t"]]
            add(
              source,
              "symbol",
              filter,
              {},
              {
                "icon-image": icon,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
              layerName,
              pinZoom(population)
            )
          }
        }
      } else if (population === "late" && active.includes("openLate"))
        add(
          source,
          "circle",
          filter,
          {
            "circle-radius": 13,
            "circle-color": "rgba(67,56,202,.14)",
            "circle-stroke-color": INDIGO,
            "circle-stroke-width": 2,
          },
          {},
          layerName
        )
      else if (population === "closures" && active.includes("closures"))
        add(
          source,
          "symbol",
          filter,
          {},
          { "icon-image": "pin-closed", "icon-allow-overlap": true },
          layerName
        )
    }
    const groups = (
      source: string,
      population: AtlasPopulation,
      filter: unknown
    ) => {
      const show =
        population === "listed"
          ? active.includes("pins")
          : population === "closures"
            ? active.includes("closures")
            : population === "late" && active.includes("openLate")
      if (!show) return
      const accessibility =
        population === "listed" && active.includes("access")
          ? accessibilityClusterStyle(
              "total",
              "matches",
              generation.scope.accessibility.view === "compare"
            )
          : null
      if (accessibility)
        add(
          source,
          "circle",
          filter,
          accessibility.halo,
          {},
          undefined,
          pinZoom(population)
        )
      add(
        source,
        "circle",
        filter,
        {
          "circle-radius": [
            "step",
            ["get", "total"],
            15,
            10,
            20,
            100,
            26,
            1000,
            32,
          ],
          "circle-color": "#fff",
          "circle-stroke-color": INDIGO,
          "circle-stroke-width": 2,
          ...accessibility?.circle,
        },
        {},
        undefined,
        pinZoom(population)
      )
      if (population === "listed" && active.includes("complete")) {
        for (const [bin, color, offset] of [
          ["unknown", "#777", [-9, -9]],
          ["low", RAMP.seq[2]!, [9, -9]],
          ["medium", RAMP.seq[3]!, [-9, 9]],
          ["high", RAMP.seq[4]!, [9, 9]],
        ] as const)
          add(
            source,
            "circle",
            ["all", filter, [">", ["coalesce", ["get", bin], 0], 0]],
            {
              "circle-radius": ["+", 3, ["min", 7, ["sqrt", ["get", bin]]]],
              "circle-color": color,
              "circle-translate": [...offset],
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
            {},
            undefined,
            pinZoom(population)
          )
      }
      if (this.map.getStyle().glyphs)
        add(
          source,
          "symbol",
          filter,
          { "text-color": "#17162B", ...accessibility?.text },
          {
            "text-field": accessibility?.label ?? [
              "to-string",
              ["get", "total"],
            ],
            "text-font": ["Montserrat Medium"],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          undefined,
          pinZoom(population)
        )
    }
    const clustered = (
      population: AtlasPopulation,
      features: GeoJSON.Feature[],
      densityFeatures?: GeoJSON.Feature[]
    ) => {
      const source = `${prefix}-${population}`
      const heat =
        population === "events"
          ? active.includes("events")
          : population === "listed" && active.includes("density")
      if (heat) {
        const raw = `${source}-raw`
        this.map.addSource(raw, {
          type: "geojson",
          data: collection(densityFeatures ?? features),
        })
        graph.sources.push(raw)
        add(
          raw,
          "heatmap",
          null,
          heatmapPaint(heatOpacity, ["get", "total"], Boolean(densityFeatures))
        )
      }
      const show =
        population === "listed"
          ? active.includes("pins")
          : population === "closures"
            ? active.includes("closures")
            : population === "late" && active.includes("openLate")
      if (!show) return
      this.map.addSource(source, {
        type: "geojson",
        data: collection(features),
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 32,
        // A large population contributes its exact cell count, not one seed.
        clusterProperties: Object.fromEntries(
          [
            "total",
            "matches",
            "partial",
            "unknown",
            "low",
            "medium",
            "high",
          ].map((key) => [key, ["+", ["coalesce", ["get", key], 0]]])
        ),
      })
      graph.sources.push(source)
      points(
        source,
        population,
        ["all", ["!", ["has", "point_count"]], ["has", "i"]],
        undefined,
        false
      )
      groups(source, population, [
        "any",
        ["has", "point_count"],
        ["!", ["has", "i"]],
      ])
    }
    const aggregates = (
      population: AtlasPopulation,
      value: Extract<AtlasViewportPopulation, { mode: "aggregate" }>
    ) => {
      clustered(
        population,
        value.cells.map((cell) => ({
          type: "Feature" as const,
          geometry: cell.point?.geometry ?? {
            type: "Point" as const,
            coordinates: [cell.centre.lng, cell.centre.lat],
          },
          properties: {
            ...cell.point?.properties,
            total: cell.total,
            matches: cell.coverage?.matches ?? 0,
            partial: cell.coverage?.partial ?? 0,
            bounds: JSON.stringify(cell.bounds),
            ...cell.completeness,
          },
        })),
        value.density?.cells.map(({ id, total }) => {
          const cell = atlasCell(id),
            zoom = Number(id.split("/")[0])

          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [cell.centre.lng, cell.centre.lat],
            },
            properties: { total, cellPixels: 512 / 2 ** zoom },
          }
        })
      )
    }
    let archiveSource: string | null = null
    for (const [kind, value] of Object.entries(
      generation.viewport.populations
    )) {
      const population = kind as AtlasPopulation
      if (value.mode === "aggregate") {
        aggregates(population, value)
        continue
      }
      if (value.mode === "points") {
        const resolved = atlasResolveScope(
          generation.scope,
          generation.dictionary
        )
        clustered(
          population,
          value.points.map((point) => {
            const p = point.properties
            const matches = resolved.access.length
              ? resolved.access.every((codes) =>
                  codes.some((code) => p.a.includes(`,${code},`))
                )
              : p.a !== ""
            const partial = resolved.access.length
              ? resolved.access.some((codes) =>
                  codes.some((code) => p.a.includes(`,${code},`))
                )
              : matches

            return {
              ...point,
              properties: {
                ...p,
                total: 1,
                matches: Number(matches),
                partial: Number(partial && !matches),
                unknown: Number(p.p === null),
                low: Number(p.p !== null && p.p < 50),
                medium: Number(p.p !== null && p.p >= 50 && p.p < 80),
                high: Number(p.p !== null && p.p >= 80),
              },
            }
          })
        )
        continue
      }
      if (
        !generation.manifest ||
        generation.manifest.buildId !== value.archiveBuildId
      )
        throw new Error("Atlas archive generation missing")
      if (!archiveSource) {
        archiveSource = `${prefix}-archive`
        retainAtlasArchive(generation.manifest.url)
        graph.archiveUrl = generation.manifest.url
        this.map.addSource(archiveSource, {
          type: "vector",
          url: `pmtiles://${generation.manifest.url}`,
          minzoom: generation.manifest.detailZoom,
          maxzoom: 16,
        })
        graph.sources.push(archiveSource)
      }
      const predicate = atlasTileFilter(
        atlasResolveScope(generation.scope, generation.dictionary),
        population
      )
      points(
        archiveSource,
        population,
        [
          "all",
          predicate,
          ["!", ["in", ["get", "i"], ["literal", generation.changedIds]]],
        ],
        "libraries"
      )
      const source = `${prefix}-${population}-delta`
      this.map.addSource(source, {
        type: "geojson",
        data: collection(generation.upserts),
      })
      graph.sources.push(source)
      points(source, population, predicate)
    }
    this.commit = () => {
      if (this.pending !== graph) return
      if (!graph.sources.every((source) => this.map.isSourceLoaded(source)))
        return
      for (const layer of graph.layers)
        for (const [property, value] of Object.entries(layer.opacity))
          this.map.setPaintProperty(
            layer.id,
            property as keyof NonNullable<HeatmapLayerSpecification["paint"]>,
            value as ExpressionSpecification
          )
      this.remove(this.current)
      this.current = graph
      this.pending = null
      if (this.commit) this.map.off("sourcedata", this.commit)
      this.commit = null
    }
    this.map.on("sourcedata", this.commit)
    // Unrelated basemap/glyph requests must not keep ready Atlas sources hidden.
    this.commit()
  }

  click(point: PointLike): boolean {
    const layers = this.current.layers
      .filter((layer) => layer.interactive)
      .map((layer) => layer.id)
      .filter((id) => this.map.getLayer(id))
    const hit = layers.length
      ? this.map.queryRenderedFeatures(point, { layers })[0]
      : undefined
    if (!hit) return false
    if (hit.properties.i) this.select(String(hit.properties.i))
    else if (
      hit.properties.cluster_id !== undefined &&
      hit.geometry.type === "Point"
    ) {
      const source = this.map.getSource(hit.source) as GeoJSONSource
      const graph = this.current
      const centre = hit.geometry.coordinates as [number, number]
      source
        .getClusterExpansionZoom(Number(hit.properties.cluster_id))
        .then((zoom) => {
          if (this.current === graph) this.map.easeTo({ center: centre, zoom })
        })
        .catch(() => {})
    } else if (hit.properties.bounds) {
      const b = JSON.parse(hit.properties.bounds)
      this.map.fitBounds(
        [
          [b.west, b.south],
          [b.east, b.north],
        ],
        { padding: 70, maxZoom: 16 }
      )
    }

    return true
  }

  destroy() {
    if (this.commit) this.map.off("sourcedata", this.commit)
    if (this.pending) this.remove(this.pending)
    this.remove(this.current)
  }
}

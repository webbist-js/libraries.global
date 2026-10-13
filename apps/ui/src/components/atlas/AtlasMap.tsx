"use client"

import type {
  AtlasLibraryAccessResponse,
  PublicLiveState,
} from "@repo/shared-data"
import type { Point } from "geojson"
import type * as MapLibre from "maplibre-gl"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import { useTranslations as useUiTranslations } from "next-intl"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

import { T } from "@/lib/design-tokens"
import { MAP_WORKER_URL } from "@/lib/maplibre"
import type { PublicMobileTimetable } from "@/lib/mobile/types"
import type { MobileStopHit } from "@/lib/mobile-stop-search"

import type { AtlasGeneration } from "./atlas-data-client"
import {
  addPinImages,
  accessibilityClusterStyle,
  completenessColor,
  heatColor,
  INDIGO,
  RAMP,
} from "./atlas-map.style"
import { AtlasPerCapitaRenderer } from "./atlas-per-capita-renderer"
import { atlasProtocol } from "./atlas-pmtiles"
import { AtlasScalableRenderer } from "./atlas-scalable-renderer"
import {
  type AtlasLibrary,
  type AccessibilityView,
  type Bounds,
  hasAccessibility,
  isOpenLateOrSunday,
  type LayerId,
  typeGroupOf,
} from "./atlas.logic"
import { mobileMapData } from "./mobile-map-data"
import { BASEMAP_ATTRIBUTION } from "../map/map.helpers"

let protocolRegistered = false

// v2 is light-only — Voyager's warm tones sit well on the paper palette
const BASEMAP =
  "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"

export interface AtlasView {
  bounds: Bounds
  lat: number
  lng: number
  zoom: number
}

export interface AtlasMapHandle {
  fitBounds: (bounds: Bounds) => void
  flyTo: (lat: number, lng: number, zoom?: number) => void
  fitTo: (libs: AtlasLibrary[]) => void
  zoomBy: (delta: number) => void
  locate: () => Promise<boolean>
}

interface AtlasMapProps {
  perCapita?: AtlasLibraryAccessResponse | null
  perCapitaOpacity?: number
  selectedCountry?: string | null
  onCountrySelect?: (iso3: string) => void
  onPerCapitaGeometryError?: () => void
  generation?: AtlasGeneration | null
  onGeometryError?: () => void
  libraries: AtlasLibrary[]
  closures: AtlasLibrary[]
  layers: LayerId[]
  accessibility?: string[]
  accessibilityView?: AccessibilityView
  /** 0–1, applied to heat layers. */
  heatOpacity: number
  selected: AtlasLibrary | null
  hovered: AtlasLibrary | null
  projection: "globe" | "flat"
  initialView: { lat: number; lng: number; zoom: number } | null
  /** Left/right panel widths, so fitTo keeps results out from under them. */
  padding: { left: number; right: number; bottom: number }
  onSelect: (id: string | null) => void
  onView: (view: AtlasView) => void
  onReady: () => void
  onError: (reason: "webgl" | "style") => void
  className?: string
  mobileStops?: MobileStopHit[]
  mobileClusters?: { lat: number; lng: number; count: number }[]
  mobileRoutes?: PublicMobileTimetable[]
  mobileLive?: Record<string, PublicLiveState>
  mobileZoomIn?: boolean
  mobileRouteLines?: boolean
  mobileOpacity?: number
  now?: Date
  onStopSelect?: (id: string) => void
}

function toGeoJSON(libs: AtlasLibrary[], accessibility: string[] = []) {
  return {
    type: "FeatureCollection" as const,
    features: libs.map((l) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        group: typeGroupOf(l.type),
        late: l.atlasLate ?? isOpenLateOrSunday(l.hours),
        accessibility: hasAccessibility(l, accessibility),
        events: l.events,
        complete: l.complete,
      },
    })),
  }
}

/** Selected pin: indigo halo plus a name label, drawn as DOM so it uses Figtree. */
function selectionElement(name: string, small: boolean): HTMLElement {
  const el = document.createElement("div")
  el.setAttribute("aria-hidden", "true")
  el.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none"
  const halo = document.createElement("span")
  const s = small ? 30 : 44
  halo.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:rgba(67,56,202,.16);border:2px solid ${INDIGO}`
  el.append(halo)
  if (!small) {
    const label = document.createElement("span")
    label.textContent = name
    label.style.cssText =
      "font:700 13px var(--font-figtree),system-ui,sans-serif;color:#17162B;background:#fff;border:1px solid #D9D3C9;border-radius:999px;padding:4px 10px;white-space:nowrap"
    el.append(label)
  }

  return el
}

export const AtlasMap = forwardRef<AtlasMapHandle, AtlasMapProps>(
  function AtlasMap(props, ref) {
    const tUi = useUiTranslations("ui")

    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<MapLibreMap | null>(null)
    const libRef = useRef<typeof MapLibre | null>(null)
    const readyRef = useRef(false)
    const selMarker = useRef<Marker | null>(null)
    const hoverMarker = useRef<Marker | null>(null)
    const meMarker = useRef<Marker | null>(null)
    const scalableRenderer = useRef<AtlasScalableRenderer | null>(null)
    const perCapitaRenderer = useRef<AtlasPerCapitaRenderer | null>(null)
    // Latest props for event handlers registered once.
    const latest = useRef(props)
    latest.current = props

    useImperativeHandle(ref, () => ({
      fitBounds(bounds) {
        const east = bounds.east < bounds.west ? bounds.east + 360 : bounds.east
        const { left, right, bottom } = latest.current.padding
        mapRef.current?.fitBounds(
          [
            [bounds.west, bounds.south],
            [east, bounds.north],
          ],
          {
            padding: {
              top: 90,
              left: left + 40,
              right: right + 40,
              bottom: bottom + 40,
            },
            maxZoom: 14,
            duration: reducedMotion() ? 0 : 900,
          }
        )
      },
      flyTo(lat, lng, zoom = 12) {
        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom,
          essential: false,
          duration: reducedMotion() ? 0 : 900,
        })
      },
      fitTo(libs) {
        const map = mapRef.current
        if (!map || libs.length === 0) return
        const { left, right, bottom } = latest.current.padding
        if (libs.length === 1) {
          const [l] = libs
          map.flyTo({
            center: [l!.lng, l!.lat],
            zoom: 13,
            duration: reducedMotion() ? 0 : 900,
          })

          return
        }
        let w = 180
        let e = -180
        let s = 90
        let n = -90
        for (const l of libs) {
          w = Math.min(w, l.lng)
          e = Math.max(e, l.lng)
          s = Math.min(s, l.lat)
          n = Math.max(n, l.lat)
        }
        map.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          {
            padding: {
              top: 90,
              left: left + 40,
              right: right + 40,
              bottom: bottom + 40,
            },
            maxZoom: 13,
            duration: reducedMotion() ? 0 : 900,
          }
        )
      },
      zoomBy(delta) {
        const map = mapRef.current
        if (!map) return
        map.easeTo({
          zoom: map.getZoom() + delta,
          duration: reducedMotion() ? 0 : 250,
        })
      },
      locate() {
        return new Promise<boolean>((resolve) => {
          if (!("geolocation" in navigator)) return resolve(false)
          // Only called from the "Show my location" button, never on load.
          // eslint-disable-next-line sonarjs/no-intrusive-permissions
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const map = mapRef.current
              const lib = libRef.current
              if (!map || !lib) return resolve(false)
              const { latitude, longitude } = pos.coords
              meMarker.current?.remove()
              const dot = document.createElement("span")
              dot.setAttribute("aria-hidden", "true")
              dot.style.cssText = `display:block;width:16px;height:16px;border-radius:50%;background:${INDIGO};border:3px solid #fff;box-shadow:0 0 0 6px rgba(67,56,202,.2)`
              meMarker.current = new lib.Marker({ element: dot })
                .setLngLat([longitude, latitude])
                .addTo(map)
              map.flyTo({
                center: [longitude, latitude],
                zoom: 13,
                duration: reducedMotion() ? 0 : 900,
              })
              resolve(true)
            },
            () => resolve(false),
            { enableHighAccuracy: false, timeout: 10_000 }
          )
        })
      },
    }))

    // ── Create the map once ────────────────────────────────────────────────
    useEffect(() => {
      let alive = true
      let observer: ResizeObserver | null = null

      import("maplibre-gl").then((maplibregl) => {
        maplibregl.setWorkerUrl(MAP_WORKER_URL)
        if (!protocolRegistered) {
          maplibregl.addProtocol("pmtiles", atlasProtocol.tile)
          protocolRegistered = true
        }
        if (!alive || !containerRef.current) return
        libRef.current = maplibregl
        const v = latest.current.initialView
        let map: MapLibreMap
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP,
            center: v ? [v.lng, v.lat] : [10, 30],
            zoom: v ? v.zoom : 1.6,
            attributionControl: {
              compact: true,
              customAttribution: BASEMAP_ATTRIBUTION,
            },
            dragRotate: false,
            pitchWithRotate: false,
          })
        } catch {
          // No WebGL (old devices, locked-down browsers): fall back to the list.
          latest.current.onError("webgl")

          return
        }
        mapRef.current = map
        map.touchZoomRotate.disableRotation()

        map.on("error", (e) => {
          if (
            readyRef.current &&
            (e as { sourceId?: string }).sourceId === "per-capita-countries"
          ) {
            perCapitaRenderer.current?.destroy()
            perCapitaRenderer.current = null
            latest.current.onPerCapitaGeometryError?.()
          }
          if (
            readyRef.current &&
            (e as { sourceId?: string }).sourceId?.startsWith("scalable-")
          )
            latest.current.onGeometryError?.()
          // Tile hiccups are recoverable; only a failed style load is fatal.
          if (!readyRef.current && (e as { error?: { status?: number } }).error)
            latest.current.onError("style")
        })

        map.on("style.load", () => {
          map.setProjection({
            type: latest.current.projection === "globe" ? "globe" : "mercator",
          })
        })

        map.on("load", () => {
          addPinImages(map as never)
          const empty = { type: "FeatureCollection" as const, features: [] }

          map.addSource("atlas", {
            type: "geojson",
            data: empty,
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 44,
            clusterProperties: {
              accessMatches: [
                "+",
                ["case", ["==", ["get", "accessibility"], true], 1, 0],
              ],
            },
          })
          map.addSource("atlas-raw", { type: "geojson", data: empty })
          map.addSource("atlas-closed", { type: "geojson", data: empty })
          for (const source of [
            "mobile-stops",
            "mobile-clusters",
            "mobile-routes",
            "mobile-vehicles",
            "mobile-rings",
          ])
            map.addSource(source, {
              type: "geojson",
              data: empty,
              ...(source === "mobile-stops"
                ? { cluster: true, clusterMaxZoom: 12, clusterRadius: 44 }
                : {}),
            })
          const square = document.createElement("canvas")
          square.width = 40
          square.height = 40
          const context = square.getContext("2d")!
          context.fillStyle = "#fff"
          context.strokeStyle = T.map.stopRing
          context.lineWidth = 4
          context.beginPath()
          context.roundRect(3, 3, 34, 34, 9)
          context.fill()
          context.stroke()
          map.addImage(
            "atlas-stop-square",
            context.getImageData(0, 0, 40, 40),
            { pixelRatio: 2 }
          )
          map.addLayer({
            id: "mobile-route-lines",
            type: "line",
            source: "mobile-routes",
            filter: ["!=", ["get", "live"], true],
            paint: {
              "line-color": T.map.route,
              "line-width": 3,
              "line-opacity": 0.7,
              "line-dasharray": [2, 2],
            },
          })
          map.addLayer({
            id: "mobile-live-lines",
            type: "line",
            source: "mobile-routes",
            filter: ["==", ["get", "live"], true],
            paint: { "line-color": T.map.route, "line-width": 4 },
          })
          map.addLayer({
            id: "mobile-coarse-rings",
            type: "fill",
            source: "mobile-rings",
            minzoom: 12,
            paint: { "fill-color": T.map.route, "fill-opacity": 0.15 },
          })
          map.addLayer({
            id: "mobile-stop-squares",
            type: "symbol",
            source: "mobile-stops",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": "atlas-stop-square",
              "icon-allow-overlap": true,
            },
          })
          map.addLayer({
            id: "mobile-cluster-squares",
            type: "symbol",
            source: "mobile-clusters",
            layout: {
              "icon-image": "atlas-stop-square",
              "icon-size": 1.5,
              "icon-allow-overlap": true,
            },
          })
          map.addLayer({
            id: "mobile-stop-clusters",
            type: "symbol",
            source: "mobile-stops",
            filter: ["has", "point_count"],
            layout: {
              "icon-image": "atlas-stop-square",
              "icon-size": 1.5,
              "icon-allow-overlap": true,
            },
          })
          map.addLayer({
            id: "mobile-vehicle",
            type: "circle",
            source: "mobile-vehicles",
            minzoom: 12,
            paint: {
              "circle-color": T.map.route,
              "circle-radius": 10,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 3,
            },
          })
          if (map.getStyle().glyphs) {
            map.addLayer({
              id: "mobile-stop-labels",
              type: "symbol",
              source: "mobile-stops",
              filter: ["!", ["has", "point_count"]],
              minzoom: 12,
              layout: {
                "text-field": [
                  "concat",
                  ["get", "number"],
                  " ",
                  ["get", "label"],
                ],
                "text-font": ["Montserrat Medium"],
                "text-size": 12,
                "text-offset": [0, 1.9],
              },
              paint: {
                "text-color": T.map.stopRing,
                "text-halo-color": "#fff",
                "text-halo-width": 2,
              },
            })
            map.addLayer({
              id: "mobile-stop-cluster-count",
              type: "symbol",
              source: "mobile-stops",
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["to-string", ["get", "point_count"]],
                "text-font": ["Montserrat Medium"],
                "text-size": 12,
                "text-allow-overlap": true,
              },
              paint: { "text-color": T.map.stopRing },
            })
            map.addLayer({
              id: "mobile-cluster-count",
              type: "symbol",
              source: "mobile-clusters",
              layout: {
                "text-field": ["to-string", ["get", "count"]],
                "text-font": ["Montserrat Medium"],
                "text-size": 12,
                "text-allow-overlap": true,
              },
              paint: { "text-color": T.map.stopRing },
            })
          }

          // Order: heat, then area/pin styling, then pins, then clusters.
          map.addLayer({
            id: "heat",
            type: "heatmap",
            source: "atlas-raw",
            maxzoom: 13,
            layout: { visibility: "none" },
            paint: {
              "heatmap-weight": 1,
              "heatmap-intensity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                0.6,
                9,
                1.6,
              ],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                6,
                6,
                18,
                11,
                34,
              ],
              "heatmap-color": heatColor(RAMP.heat) as never,
            },
          })
          map.addLayer({
            id: "late-halo",
            type: "circle",
            source: "atlas-raw",
            minzoom: 7,
            filter: ["==", ["get", "late"], true],
            layout: { visibility: "none" },
            paint: {
              "circle-radius": 13,
              "circle-color": "rgba(67,56,202,.14)",
              "circle-stroke-color": INDIGO,
              "circle-stroke-width": 2,
            },
          })
          map.addLayer({
            id: "styled-pins",
            type: "circle",
            source: "atlas-raw",
            layout: { visibility: "none" },
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                2,
                3.5,
                8,
                6,
                13,
                8,
              ],
              "circle-color": completenessColor() as never,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            },
          })
          map.addLayer({
            id: "closed-pins",
            type: "symbol",
            source: "atlas-closed",
            layout: {
              visibility: "none",
              "icon-image": "pin-closed",
              "icon-allow-overlap": true,
            },
          })
          map.addLayer({
            id: "pins",
            type: "symbol",
            source: "atlas",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": ["concat", "pin-", ["get", "group"]],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          })
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "atlas",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#fff",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                15,
                10,
                20,
                100,
                26,
                1000,
                32,
              ],
              "circle-stroke-color": INDIGO,
              "circle-stroke-width": 2,
            },
          })
          map.addLayer({
            id: "cluster-halo",
            type: "circle",
            source: "atlas",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "rgba(0,0,0,0)",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                19,
                10,
                24,
                100,
                30,
                1000,
                36,
              ],
              "circle-stroke-color": "rgba(67,56,202,.16)",
              "circle-stroke-width": 4,
            },
          })
          // CARTO serves Montserrat glyphs; only draw counts if the style has glyphs.
          if (map.getStyle().glyphs) {
            map.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "atlas",
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["Montserrat Medium"],
                "text-size": 13,
                "text-allow-overlap": true,
              },
              paint: { "text-color": "#17162B" },
            })
          }

          // ── Interaction ──────────────────────────────────────────────────
          const selectable = ["pins", "styled-pins", "closed-pins"]
          map.on("click", (e) => {
            const mobile = map.queryRenderedFeatures(e.point, {
              layers: [
                "mobile-stop-squares",
                "mobile-stop-clusters",
                "mobile-cluster-squares",
              ],
            })[0]
            if (mobile) {
              if (mobile.properties.id)
                latest.current.onStopSelect?.(String(mobile.properties.id))
              else if (mobile.properties.cluster_id !== undefined)
                (map.getSource("mobile-stops") as GeoJSONSource)
                  .getClusterExpansionZoom(Number(mobile.properties.cluster_id))
                  .then((zoom) =>
                    map.easeTo({
                      center: (mobile.geometry as Point).coordinates as [
                        number,
                        number,
                      ],
                      zoom,
                      duration: reducedMotion() ? 0 : 400,
                    })
                  )
                  .catch(() => {})
              else
                map.easeTo({
                  center: (mobile.geometry as Point).coordinates as [
                    number,
                    number,
                  ],
                  zoom: Math.max(9, map.getZoom() + 2),
                  duration: reducedMotion() ? 0 : 400,
                })

              return
            }
            const cluster = map.queryRenderedFeatures(e.point, {
              layers: ["clusters"],
            })[0]
            if (scalableRenderer.current?.click(e.point)) return
            if (cluster) {
              const src = map.getSource("atlas") as GeoJSONSource
              src
                .getClusterExpansionZoom(
                  cluster.properties.cluster_id as number
                )
                .then((zoom) => {
                  map.easeTo({
                    center: (
                      cluster.geometry as unknown as {
                        coordinates: [number, number]
                      }
                    ).coordinates,
                    zoom,
                    duration: reducedMotion() ? 0 : 400,
                  })
                })

              return
            }
            const hit = map.queryRenderedFeatures(e.point, {
              layers: selectable.filter(
                (l) => map.getLayoutProperty(l, "visibility") !== "none"
              ),
            })[0]
            if (!hit && perCapitaRenderer.current?.click(e.point)) return
            latest.current.onSelect(hit ? (hit.properties.id as string) : null)
          })
          for (const l of [
            ...selectable,
            "clusters",
            "mobile-stop-squares",
            "mobile-cluster-squares",
            "mobile-stop-clusters",
          ]) {
            map.on(
              "mouseenter",
              l,
              () => (map.getCanvas().style.cursor = "pointer")
            )
            map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""))
          }

          const report = () => {
            const b = map.getBounds()
            const c = map.getCenter()
            latest.current.onView({
              bounds: {
                west: b.getWest(),
                south: b.getSouth(),
                east: b.getEast(),
                north: b.getNorth(),
              },
              lat: c.lat,
              lng: c.lng,
              zoom: map.getZoom(),
            })
          }
          map.on("moveend", report)

          readyRef.current = true
          syncData()
          syncMobileData()
          syncLayers()
          syncMarkers()
          syncPerCapita()
          report()
          latest.current.onReady()
        })

        observer = new ResizeObserver(() => map.resize())
        observer.observe(containerRef.current)
      })

      return () => {
        alive = false
        observer?.disconnect()
        scalableRenderer.current?.destroy()
        scalableRenderer.current = null
        perCapitaRenderer.current?.destroy()
        perCapitaRenderer.current = null
        mapRef.current?.remove()
        mapRef.current = null
        readyRef.current = false
      }
    }, [])

    // ── Sync helpers (read latest props) ────────────────────────────────────
    function syncPerCapita() {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      if (!perCapitaRenderer.current && !latest.current.perCapita) return
      perCapitaRenderer.current ??= new AtlasPerCapitaRenderer(map, (iso3) =>
        latest.current.onCountrySelect?.(iso3)
      )
      perCapitaRenderer.current.update(
        latest.current.layers.includes("perCapita")
          ? (latest.current.perCapita ?? null)
          : null,
        latest.current.perCapitaOpacity ?? 0.55,
        latest.current.selectedCountry ?? null
      )
    }
    function syncData() {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      const { libraries, closures } = latest.current
      const data = toGeoJSON(
        latest.current.generation ? [] : libraries,
        latest.current.accessibility
      )
      ;(map.getSource("atlas") as GeoJSONSource).setData(data)
      ;(map.getSource("atlas-raw") as GeoJSONSource).setData(data)
      ;(map.getSource("atlas-closed") as GeoJSONSource).setData(
        toGeoJSON(latest.current.generation ? [] : closures)
      )
      if (latest.current.generation) {
        scalableRenderer.current ??= new AtlasScalableRenderer(map, (id) =>
          latest.current.onSelect(id)
        )
        scalableRenderer.current.update(
          latest.current.generation,
          latest.current.layers,
          latest.current.heatOpacity
        )
      }
    }

    // The mobile sources depend on the clock (vehicle position between
    // stops), so they refresh on their own without rebuilding the pins.
    function syncMobileData() {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      const p = latest.current
      const mobile = mobileMapData(
        p.mobileStops ?? [],
        p.mobileZoomIn ? (p.mobileClusters ?? []) : [],
        p.mobileRoutes ?? [],
        p.mobileLive ?? {},
        p.now ?? new Date()
      )
      for (const [source, data] of Object.entries(mobile))
        (map.getSource(`mobile-${source}`) as GeoJSONSource).setData(data)
    }

    function syncLayers() {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      const { layers, heatOpacity } = latest.current
      const on = (id: LayerId) => layers.includes(id)
      const vis = (layer: string, show: boolean) =>
        map.setLayoutProperty(layer, "visibility", show ? "visible" : "none")

      const heat = on("density") || on("events")
      vis("heat", heat)
      if (heat) {
        map.setFilter(
          "heat",
          on("events") ? ["==", ["get", "events"], true] : null
        )
        // Hand over from heat to points: heat only at low zoom, pins take over by 12.
        map.setPaintProperty("heat", "heatmap-opacity", [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          heatOpacity,
          9,
          heatOpacity * 0.5,
          12,
          0,
        ])
      }

      const pinStyle = on("complete")
      const access = on("access")
      const compare = access && latest.current.accessibilityView === "compare"
      vis("styled-pins", pinStyle && on("pins"))
      if (on("complete"))
        map.setPaintProperty("styled-pins", "circle-color", completenessColor())
      map.setLayoutProperty(
        "pins",
        "icon-image",
        access
          ? [
              "case",
              ["==", ["get", "accessibility"], true],
              "pin-access-match",
              "pin-access-gap",
            ]
          : ["concat", "pin-", ["get", "group"]]
      )
      const clusterRadius: MapLibre.ExpressionSpecification = [
        "step",
        ["get", "point_count"],
        compare ? 26 : 15,
        10,
        compare ? 30 : 20,
        100,
        compare ? 36 : 26,
        1000,
        compare ? 42 : 32,
      ]
      const clusterStyle: ReturnType<typeof accessibilityClusterStyle> = access
        ? accessibilityClusterStyle("point_count", "accessMatches", compare)
        : {
            circle: {
              "circle-radius": clusterRadius,
              "circle-color": "#fff",
              "circle-stroke-color": INDIGO,
              "circle-stroke-width": 2,
            },
            halo: {
              "circle-radius": ["+", clusterRadius, 4],
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": "rgba(67,56,202,.16)",
              "circle-stroke-width": 4,
              "circle-blur": 0,
            },
            text: { "text-color": "#17162B" },
            label: ["get", "point_count_abbreviated"],
          }
      for (const [property, value] of Object.entries(clusterStyle.circle))
        map.setPaintProperty(
          "clusters",
          property as keyof NonNullable<
            MapLibre.CircleLayerSpecification["paint"]
          >,
          value
        )
      for (const [property, value] of Object.entries(clusterStyle.halo))
        map.setPaintProperty(
          "cluster-halo",
          property as keyof NonNullable<
            MapLibre.CircleLayerSpecification["paint"]
          >,
          value
        )
      if (map.getLayer("cluster-count")) {
        for (const [property, value] of Object.entries(clusterStyle.text))
          map.setPaintProperty(
            "cluster-count",
            property as keyof NonNullable<
              MapLibre.SymbolLayerSpecification["paint"]
            >,
            value
          )
        map.setLayoutProperty("cluster-count", "text-field", clusterStyle.label)
      }
      // Completeness uses individual pins; accessibility keeps scalable clusters.
      for (const l of ["pins", "clusters", "cluster-halo", "cluster-count"]) {
        if (map.getLayer(l)) vis(l, on("pins") && !pinStyle)
      }
      // With heat on, points only appear once you've zoomed in.
      for (const l of [
        "pins",
        "clusters",
        "cluster-halo",
        "cluster-count",
        "styled-pins",
      ]) {
        if (map.getLayer(l)) map.setLayerZoomRange(l, heat ? 8 : 0, 24)
      }

      vis("late-halo", on("openLate"))
      vis("closed-pins", on("closures"))
      const mobileOpacity = latest.current.mobileOpacity ?? 1
      for (const layer of ["mobile-route-lines", "mobile-live-lines"]) {
        vis(layer, on("mobile") && latest.current.mobileRouteLines !== false)
        map.setPaintProperty(layer, "line-opacity", mobileOpacity)
      }
      for (const layer of [
        "mobile-coarse-rings",
        "mobile-stop-squares",
        "mobile-cluster-squares",
        "mobile-stop-clusters",
        "mobile-stop-cluster-count",
        "mobile-vehicle",
        "mobile-stop-labels",
        "mobile-cluster-count",
      ])
        if (map.getLayer(layer)) {
          vis(layer, on("mobile"))
          if (layer === "mobile-coarse-rings")
            map.setPaintProperty(layer, "fill-opacity", 0.15 * mobileOpacity)
          else if (layer === "mobile-vehicle") {
            map.setPaintProperty(layer, "circle-opacity", mobileOpacity)
            map.setPaintProperty(layer, "circle-stroke-opacity", mobileOpacity)
          } else {
            map.setPaintProperty(layer, "icon-opacity", mobileOpacity)
            map.setPaintProperty(layer, "text-opacity", mobileOpacity)
          }
        }
    }

    function syncMarkers() {
      const map = mapRef.current
      const lib = libRef.current
      if (!map || !lib) return
      const { selected, hovered } = latest.current
      selMarker.current?.remove()
      selMarker.current = null
      if (
        selected &&
        selected.mapped !== false &&
        latest.current.layers.includes("pins")
      ) {
        selMarker.current = new lib.Marker({
          element: selectionElement(selected.name, false),
          anchor: "top",
          offset: [0, -22],
        })
          .setLngLat([selected.lng, selected.lat])
          .addTo(map)
      }
      hoverMarker.current?.remove()
      hoverMarker.current = null
      if (
        hovered &&
        hovered.id !== selected?.id &&
        hovered.mapped !== false &&
        latest.current.layers.includes("pins")
      ) {
        hoverMarker.current = new lib.Marker({
          element: selectionElement(hovered.name, true),
        })
          .setLngLat([hovered.lng, hovered.lat])
          .addTo(map)
      }
    }

    useEffect(syncData, [
      props.libraries,
      props.accessibility,
      props.closures,
      props.generation,
      props.layers,
      props.heatOpacity,
    ])
    useEffect(syncPerCapita, [
      props.perCapita,
      props.perCapitaOpacity,
      props.selectedCountry,
      props.layers,
    ])
    useEffect(syncMobileData, [
      props.mobileStops,
      props.mobileClusters,
      props.mobileRoutes,
      props.mobileLive,
      props.mobileZoomIn,
      props.now,
    ])
    useEffect(syncLayers, [
      props.mobileRouteLines,
      props.mobileOpacity,
      props.layers,
      props.heatOpacity,
      props.accessibilityView,
    ])
    useEffect(syncMarkers, [props.selected, props.hovered, props.layers])
    useEffect(() => {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      map.setProjection({
        type: props.projection === "globe" ? "globe" : "mercator",
      })
    }, [props.projection])

    // MapLibre sets `position: relative` on its container, so positioning
    // lives on this wrapper and the map fills it.
    return (
      <div className={props.className}>
        <div
          ref={containerRef}
          className="h-full w-full"
          role="application"
          aria-label={tUi(
            "map_of_libraries_use_the_list_view_for_a_keyboardfriendly_alternative"
          )}
        />
      </div>
    )
  }
)

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

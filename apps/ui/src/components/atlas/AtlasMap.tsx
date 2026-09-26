"use client"

import type * as MapLibre from "maplibre-gl"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

import {
  addPinImages,
  completenessColor,
  heatColor,
  INDIGO,
  MUTED,
  OK,
  RAMP,
} from "./atlas-map.style"
import {
  type AtlasLibrary,
  type Bounds,
  hasStepFree,
  isOpenLateOrSunday,
  type LayerId,
  typeGroupOf,
} from "./atlas.logic"

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
  flyTo: (lat: number, lng: number, zoom?: number) => void
  fitTo: (libs: AtlasLibrary[]) => void
  zoomBy: (delta: number) => void
  locate: () => Promise<boolean>
}

interface AtlasMapProps {
  libraries: AtlasLibrary[]
  closures: AtlasLibrary[]
  layers: LayerId[]
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
}

function toGeoJSON(libs: AtlasLibrary[]) {
  return {
    type: "FeatureCollection" as const,
    features: libs.map((l) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        group: typeGroupOf(l.type),
        late: isOpenLateOrSunday(l.hours),
        stepFree: hasStepFree(l),
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
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<MapLibreMap | null>(null)
    const libRef = useRef<typeof MapLibre | null>(null)
    const readyRef = useRef(false)
    const selMarker = useRef<Marker | null>(null)
    const hoverMarker = useRef<Marker | null>(null)
    const meMarker = useRef<Marker | null>(null)
    // Latest props for event handlers registered once.
    const latest = useRef(props)
    latest.current = props

    useImperativeHandle(ref, () => ({
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
            attributionControl: { compact: true },
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
          })
          map.addSource("atlas-raw", { type: "geojson", data: empty })
          map.addSource("atlas-closed", { type: "geojson", data: empty })

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
            const cluster = map.queryRenderedFeatures(e.point, {
              layers: ["clusters"],
            })[0]
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
            latest.current.onSelect(hit ? (hit.properties.id as string) : null)
          })
          for (const l of [...selectable, "clusters"]) {
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
          syncLayers()
          syncMarkers()
          report()
          latest.current.onReady()
        })

        observer = new ResizeObserver(() => map.resize())
        observer.observe(containerRef.current)
      })

      return () => {
        alive = false
        observer?.disconnect()
        mapRef.current?.remove()
        mapRef.current = null
        readyRef.current = false
      }
    }, [])

    // ── Sync helpers (read latest props) ────────────────────────────────────
    function syncData() {
      const map = mapRef.current
      if (!map || !readyRef.current) return
      const { libraries, closures } = latest.current
      const data = toGeoJSON(libraries)
      ;(map.getSource("atlas") as GeoJSONSource).setData(data)
      ;(map.getSource("atlas-raw") as GeoJSONSource).setData(data)
      ;(map.getSource("atlas-closed") as GeoJSONSource).setData(
        toGeoJSON(closures)
      )
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

      const pinStyle = on("complete") || on("access")
      vis("styled-pins", pinStyle)
      if (on("complete"))
        map.setPaintProperty("styled-pins", "circle-color", completenessColor())
      if (on("access"))
        map.setPaintProperty("styled-pins", "circle-color", [
          "case",
          ["==", ["get", "stepFree"], true],
          OK,
          MUTED,
        ])
      // Styled pins replace type pins and clusters so every point is visible.
      for (const l of ["pins", "clusters", "cluster-halo", "cluster-count"]) {
        if (map.getLayer(l)) vis(l, !pinStyle)
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
    }

    function syncMarkers() {
      const map = mapRef.current
      const lib = libRef.current
      if (!map || !lib) return
      const { selected, hovered } = latest.current
      selMarker.current?.remove()
      selMarker.current = null
      if (selected) {
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
      if (hovered && hovered.id !== selected?.id) {
        hoverMarker.current = new lib.Marker({
          element: selectionElement(hovered.name, true),
        })
          .setLngLat([hovered.lng, hovered.lat])
          .addTo(map)
      }
    }

    useEffect(syncData, [props.libraries, props.closures])
    useEffect(syncLayers, [props.layers, props.heatOpacity])
    useEffect(syncMarkers, [props.selected, props.hovered])
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
          aria-label="Map of libraries. Use the list view for a keyboard-friendly alternative."
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

"use client"
import {
  addDays,
  dayRoute,
  localDateTime,
  type MobileTimetable,
  type TimetableNotice,
  type PublicLiveState,
} from "@repo/shared-data"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import { useEffect, useMemo, useRef, useState } from "react"

import { coarseRing } from "@/components/atlas/mobile-map-data"
import { EmptyState } from "@/components/ds/EmptyState"
import { BASEMAP_ATTRIBUTION } from "@/components/map/map.helpers"
import { T } from "@/lib/design-tokens"
import { MAP_WORKER_URL } from "@/lib/maplibre"
import { weekdayCopy } from "@/lib/staff/format"

import { useMobileClock } from "./useMobileClock"
import { usePublicMobileLive } from "./usePublicMobileLive"

export function routeForMap(
  tt: MobileTimetable,
  notices: TimetableNotice[],
  date: string
) {
  for (let offset = 0; offset <= 183; offset += 1) {
    const serviceDate = addDays(date, offset),
      route = dayRoute(tt, notices, serviceDate).filter(
        (row) => !row.cancelledBy
      )
    if (route.length) return { date: serviceDate, route }
  }

  return { date, route: [] }
}
export function MobileRouteMap({
  tt,
  notices,
  timezone,
  onStop,
  selectedStop = null,
  live: suppliedLive = null,
  libraryDocumentId,
  status,
  compact = false,
  date: forcedDate,
  caption,
}: {
  readonly tt: MobileTimetable
  readonly notices: TimetableNotice[]
  readonly timezone: string
  readonly onStop?: (id: string) => void
  readonly selectedStop?: string | null
  readonly live?: PublicLiveState | null
  readonly libraryDocumentId?: string
  readonly status?: string | null
  readonly compact?: boolean
  /** Show this service day's route instead of today's (the timetable editor). */
  readonly date?: string
  /** Replaces the figure caption (the editor names the day itself). */
  readonly caption?: string
}) {
  const element = useRef<HTMLDivElement>(null),
    mapRef = useRef<MapLibreMap | null>(null),
    vehicle = useRef<Marker | null>(null),
    [unavailable, setUnavailable] = useState(false),
    [loaded, setLoaded] = useState(false),
    now = useMobileClock()
  const polledLive = usePublicMobileLive(
      libraryDocumentId,
      tt,
      notices,
      timezone,
      status
    ),
    live = suppliedLive ?? polledLive
  const date =
    forcedDate ?? (now ? localDateTime(now, timezone).date : tt.cycle.anchor)
  const route = useMemo(
    () => routeForMap(tt, notices, date),
    [tt, notices, date]
  )
  const latest = useRef({ tt, route, onStop, selectedStop, live })
  latest.current = { tt, route, onStop, selectedStop, live }
  function sync() {
    const map = mapRef.current
    if (!map?.getSource("mobile-stops")) return
    const current = latest.current,
      numbers = new Map(
        current.route.route.map((visit, index) => [visit.stopId, index + 1])
      )
    const stops = {
      type: "FeatureCollection" as const,
      features: current.tt.stops.flatMap((stop) =>
        stop.location &&
        current.tt.visits.some((visit) => visit.stopId === stop.id)
          ? [
              {
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates: [stop.location.lng, stop.location.lat],
                },
                properties: {
                  id: stop.id,
                  label: stop.name,
                  number: numbers.has(stop.id)
                    ? String(numbers.get(stop.id))
                    : "",
                  selected: stop.id === current.selectedStop,
                },
              },
            ]
          : []
      ),
    }
    const coordinates = current.route.route.flatMap((visit) => {
      const stop = current.tt.stops.find((row) => row.id === visit.stopId)

      return stop?.location ? [[stop.location.lng, stop.location.lat]] : []
    })
    ;(map.getSource("mobile-stops") as GeoJSONSource).setData(stops)
    ;(map.getSource("mobile-route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        coordinates.length > 1
          ? [
              {
                type: "Feature",
                geometry: { type: "LineString", coordinates },
                properties: {},
              },
            ]
          : [],
    })
    const liveRoute =
      current.live?.sharesLive &&
      ["here", "road", "late"].includes(current.live.kind)
    map.setPaintProperty(
      "mobile-line",
      "line-dasharray",
      liveRoute ? [1, 0] : [2, 2.67]
    )
    map.setPaintProperty("mobile-line", "line-width", liveRoute ? 4 : 3)
    const state = current.live,
      stop = current.tt.stops.find((s) => s.id === state?.stopId),
      nextStop = current.tt.stops.find((s) => s.id === state?.nextStopId)
    const point =
      liveRoute && state
        ? (state.position ??
          (state.kind === "here" || state.until
            ? stop?.location
            : stop?.location && nextStop?.location
              ? {
                  lat: (stop.location.lat + nextStop.location.lat) / 2,
                  lng: (stop.location.lng + nextStop.location.lng) / 2,
                }
              : nextStop?.location))
        : null
    ;(map.getSource("mobile-vehicle") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: point
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [point.lng, point.lat] },
              properties: {},
            },
          ]
        : [],
    })
    ;(map.getSource("mobile-coarse") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        point && state?.position
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [coarseRing(point.lat, point.lng)],
                },
                properties: {},
              },
            ]
          : [],
    })
  }
  useEffect(() => {
    let stopped = false,
      observer: ResizeObserver | null = null
    import("maplibre-gl").then((lib) => {
      lib.setWorkerUrl(MAP_WORKER_URL)
      if (stopped || !element.current) return
      const pins = latest.current.tt.stops.flatMap((stop) =>
        stop.location ? [stop.location] : []
      )
      if (!pins.length) {
        setUnavailable(true)

        return
      }
      try {
        const map = new lib.Map({
          container: element.current,
          style:
            "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json",
          center: [pins[0]!.lng, pins[0]!.lat],
          zoom: 11,
          attributionControl: {
            compact: true,
            customAttribution: BASEMAP_ATTRIBUTION,
          },
          dragRotate: false,
          pitchWithRotate: false,
        })
        mapRef.current = map
        map.touchZoomRotate.disableRotation()
        // Canvas and MapLibre paint can't read CSS variables: resolve the
        // paper token once, falling back to white.
        const paper =
          getComputedStyle(element.current)
            .getPropertyValue("--t-bg-deep")
            .trim() || "#FFFFFF"
        map.on("load", () => {
          setLoaded(true)
          const empty = { type: "FeatureCollection" as const, features: [] }
          map.addSource("mobile-stops", { type: "geojson", data: empty })
          map.addSource("mobile-route", { type: "geojson", data: empty })
          map.addSource("mobile-vehicle", { type: "geojson", data: empty })
          map.addSource("mobile-coarse", { type: "geojson", data: empty })
          const canvas = document.createElement("canvas")
          canvas.width = 40
          canvas.height = 40
          const context = canvas.getContext("2d")!
          context.fillStyle = paper
          context.strokeStyle = T.map.stopRing
          context.lineWidth = 4
          context.beginPath()
          context.roundRect(3, 3, 34, 34, 9)
          context.fill()
          context.stroke()
          map.addImage(
            "mobile-stop-square",
            context.getImageData(0, 0, 40, 40),
            { pixelRatio: 2 }
          )
          map.addLayer({
            id: "mobile-line",
            type: "line",
            source: "mobile-route",
            paint: {
              "line-color": T.map.route,
              "line-width": 3,
              "line-dasharray": [2, 2.67],
            },
          })
          map.addLayer({
            id: "mobile-coarse-ring",
            type: "fill",
            source: "mobile-coarse",
            paint: {
              "fill-color": T.map.coarseRing,
              "fill-opacity": T.map.coarseOpacity,
            },
          })
          map.addLayer({
            id: "mobile-vehicle-marker",
            type: "circle",
            source: "mobile-vehicle",
            paint: {
              "circle-radius": 9,
              "circle-color": T.map.route,
              "circle-stroke-color": paper,
              "circle-stroke-width": 3,
            },
          })
          map.addLayer({
            id: "mobile-stop-pins",
            type: "symbol",
            source: "mobile-stops",
            layout: {
              "icon-image": "mobile-stop-square",
              "icon-allow-overlap": true,
            },
          })
          if (map.getStyle().glyphs)
            map.addLayer({
              id: "mobile-labels",
              type: "symbol",
              source: "mobile-stops",
              minzoom: 12,
              layout: {
                "text-field": [
                  "concat",
                  ["get", "number"],
                  " ",
                  ["get", "label"],
                ],
                "text-size": 12,
                "text-font": ["Montserrat Medium"],
                "text-offset": [0, 1.9],
              },
              paint: {
                "text-color": T.map.stopRing,
                "text-halo-color": paper,
                "text-halo-width": 2,
              },
            })
          map.on("click", "mobile-stop-pins", (event) => {
            const id = event.features?.[0]?.properties?.id
            if (typeof id === "string") latest.current.onStop?.(id)
          })
          map.on("mouseenter", "mobile-stop-pins", () => {
            map.getCanvas().style.cursor = "pointer"
          })
          map.on("mouseleave", "mobile-stop-pins", () => {
            map.getCanvas().style.cursor = ""
          })
          if (pins.length > 1)
            map.fitBounds(
              [
                [
                  Math.min(...pins.map((p) => p.lng)),
                  Math.min(...pins.map((p) => p.lat)),
                ],
                [
                  Math.max(...pins.map((p) => p.lng)),
                  Math.max(...pins.map((p) => p.lat)),
                ],
              ],
              { padding: 45, maxZoom: 13, duration: 0 }
            )
          sync()
        })
        observer = new ResizeObserver(() => map.resize())
        observer.observe(element.current)
      } catch {
        setUnavailable(true)
      }
    })

    return () => {
      stopped = true
      observer?.disconnect()
      vehicle.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])
  useEffect(sync, [tt, route, selectedStop, live])

  return (
    <figure
      className="m-0 overflow-hidden rounded-[20px] border"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <div className="relative">
        <div
          ref={element}
          className={compact ? "h-72 w-full" : "h-96 w-full"}
          role="region"
          aria-label="Mobile library route map. Stops are also listed in the timetable."
        />
        {!loaded && !unavailable ? (
          <p
            className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center text-sm"
            style={{ background: T.bg.surface, color: T.ink.dim }}
          >
            Loading map…
          </p>
        ) : null}
      </div>
      {unavailable ? (
        <EmptyState
          compact
          icon="mdi:map-outline"
          lead="The map can’t load here"
          detail="Use the stops and timetable instead. Nothing about the route is lost."
        />
      ) : null}
      <figcaption className="px-4 py-3 text-sm" style={{ color: T.ink.dim }}>
        {caption ??
          (now
            ? `${route.date === date ? "Today’s route" : `Next service: ${weekdayCopy(route.date, date)}`} · ${route.route.length} ${route.route.length === 1 ? "stop" : "stops"}. Lines join the stops; they are not road directions.`
            : "Route map. Current service dates appear when the page is ready.")}
      </figcaption>
    </figure>
  )
}

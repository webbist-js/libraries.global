"use client"

import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  formatCoord,
  isLatitude,
  isLongitude,
  readCoord,
} from "@/lib/geocode/coordinates"
import { MAP_WORKER_URL } from "@/lib/maplibre"

import { fieldHintStyle } from "./wizard.constants"

// Voyager with labels: placing a pin needs street and place names.
const VOYAGER = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"

/** The form's coordinates as [lng, lat], or null unless both are valid. */
function pointOf(lat: string, lng: string): [number, number] | null {
  const y = readCoord(lat)
  const x = readCoord(lng)

  return isLatitude(y) && isLongitude(x) ? [x, y] : null
}

const keyOf = (lat: number, lng: number) =>
  `${formatCoord(lat)},${formatCoord(lng)}`

/** The pin: an indigo dot in a white ring, drawn in the DOM so it takes the tokens. */
function pinElement(): HTMLElement {
  const el = document.createElement("div")
  Object.assign(el.style, {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background: T.accent.primary,
    border: `3px solid ${T.bg.deep}`,
    outline: `1px solid ${T.accent.primaryHover}`,
    cursor: "grab",
  })

  return el
}

/**
 * Step 2's map: shows the coordinates as a pin, and sets them when the pin
 * is dragged or the map clicked. The coordinate boxes are the keyboard way
 * to do the same.
 */
export function LocationPinMap({
  lat,
  lng,
  precise,
  onMove,
}: {
  readonly lat: string
  readonly lng: string
  /** The point is a building or an address: zoom in close. */
  readonly precise: boolean
  /** The pin was dragged, or the map clicked. */
  readonly onMove: (lat: number, lng: number) => void
}) {
  const tUi = useUiTranslations("ui")

  const captionId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onMoveRef = useRef(onMove)
  // The last point the map set itself, so it doesn't fly to its own pin.
  const ownPoint = useRef("")
  // The camera has shown a point: later ones fly, the first one jumps.
  const shown = useRef(false)
  const [ready, setReady] = useState(false)
  // No WebGL (old devices, some headless browsers): show a note instead.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onMoveRef.current = onMove
  })

  useEffect(() => {
    if (!containerRef.current) return
    let alive = true
    let observer: ResizeObserver | undefined

    import("maplibre-gl")
      .then((maplibregl) => {
        maplibregl.setWorkerUrl(MAP_WORKER_URL)
        if (!alive || !containerRef.current) return
        let map: MapLibreMap
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            style: VOYAGER,
            center: [10, 25],
            zoom: 1,
            // Scroll and one-finger drags move the page; zooming the map
            // takes Ctrl or two fingers.
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            // The Voyager style carries its own CARTO / OpenStreetMap credit.
            attributionControl: { compact: true },
          })
        } catch {
          setFailed(true)

          return
        }
        map.touchZoomRotate.disableRotation()
        map.keyboard.disableRotation()
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-left"
        )

        const marker = new maplibregl.Marker({
          element: pinElement(),
          draggable: true,
        })
        const report = (at: { lat: number; lng: number }) => {
          ownPoint.current = keyOf(at.lat, at.lng)
          onMoveRef.current(at.lat, at.lng)
        }
        marker.on("dragend", () => report(marker.getLngLat().wrap()))
        map.on("click", (e) => {
          marker.setLngLat(e.lngLat).addTo(map)
          report(e.lngLat.wrap())
        })
        map.on("load", () => {
          if (alive) setReady(true)
        })
        mapRef.current = map
        markerRef.current = marker

        observer = new ResizeObserver(() => map.resize())
        observer.observe(containerRef.current)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
      observer?.disconnect()
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Follow coordinates set elsewhere: typed, pasted, searched or located.
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!ready || !map || !marker) return
    const point = pointOf(lat, lng)
    if (!point) {
      marker.remove()

      return
    }
    marker.setLngLat(point).addTo(map)
    if (keyOf(point[1], point[0]) === ownPoint.current) return
    const view = { center: point, zoom: precise ? 17 : 14 }
    if (shown.current) map.flyTo(view)
    else map.jumpTo(view)
    shown.current = true
  }, [ready, lat, lng, precise])

  const hasPoint = pointOf(lat, lng) !== null

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        className="relative h-[220px] overflow-hidden rounded-[20px] sm:h-[280px]"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
        }}
      >
        <div
          ref={containerRef}
          role="region"
          aria-label={tUi("map_for_placing_the_library_s_pin")}
          aria-describedby={captionId}
          // maplibre-gl.css makes the container position: relative, so size it
          // explicitly rather than with inset-0.
          style={{ width: "100%", height: "100%" }}
        />
        {failed ? (
          <p
            className="absolute inset-0 m-0 flex items-center justify-center px-8 text-center text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {tUi(
              "the_map_can_t_load_in_this_browser_use_the_latitude_and_longitude_boxes_above"
            )}{" "}
          </p>
        ) : null}
        {!failed && !hasPoint ? (
          <p
            className="pointer-events-none absolute top-3 right-3 left-14 z-[1] m-0 rounded-full px-4 py-2 text-center text-[13.5px] font-semibold"
            style={{
              background: T.bg.deep,
              color: T.ink.base,
              border: `1px solid ${T.border.line}`,
            }}
          >
            {tUi(
              "zoom_in_and_click_the_map_to_drop_a_pin_or_search_above"
            )}{" "}
          </p>
        ) : null}
      </div>
      <figcaption id={captionId} style={fieldHintStyle}>
        Drag the pin or click the map to move it. The latitude and longitude
        boxes set it too.
      </figcaption>
    </figure>
  )
}

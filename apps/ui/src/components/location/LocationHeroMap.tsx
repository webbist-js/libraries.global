"use client"

import { Icon } from "@iconify/react"
import { atlasPopulationBaseline, type AtlasScope } from "@repo/shared-data"
import type { Map as MapLibreMap } from "maplibre-gl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { parseBounds } from "@/components/map/map.helpers"
import { MapLoading } from "@/components/map/MapLoading"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { MAP_WORKER_URL } from "@/lib/maplibre"
import { Link } from "@/lib/navigation"

import { AtlasRegionMap } from "./AtlasRegionMap"
import {
  countNoun,
  formatCount,
  groupScreenPoints,
} from "./location-page.helpers"

// ── Types ─────────────────────────────────────────────────────────────────────

/** A child location drawn as a count circle (continent → countries, country → regions). */
export type HeroMapCountPoint = {
  id: string
  name: string
  href: string
  lat: number
  lng: number
  count: number
}

/** A library drawn as a type-tinted pin (region pages). */
export type HeroMapLibraryPin = {
  id: string
  name: string
  href: string | null
  lat: number
  lng: number
  libraryType?: string | null
}

type Group = {
  ids: string[]
  lng: number
  lat: number
  weight: number
}

// Circles closer than this (px) share one group circle.
const GROUP_RADIUS = 34
const VOYAGER_NO_LABELS =
  "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

const circleSize = (count: number) => (count < 10 ? 26 : count < 100 ? 32 : 38)

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * The hero map on atlas location pages: per-child count circles that merge
 * when they crowd (select a group to zoom in), or library pins on a region.
 * The grid below the hero carries the same data for keyboard and screen
 * reader users; the circles and pins are ordinary links too.
 */
export function LocationHeroMap({
  label,
  caption,
  points = [],
  pins = [],
  bounds,
  childNoun,
  atlasPlace,
  countryRecords = [],
  listHref,
}: {
  /** Accessible name for the map region, e.g. "Map of libraries in Europe". */
  readonly countryRecords?: readonly { iso2?: string | null; count: number }[]
  readonly listHref?: string
  readonly label: string
  /** Visible legend line over the map. */
  readonly caption: string
  readonly points?: HeroMapCountPoint[]
  readonly pins?: HeroMapLibraryPin[]
  readonly atlasPlace?: NonNullable<AtlasScope["place"]>
  /** CMS bounding box ("lat,lng" strings); otherwise fits the data. */
  readonly bounds?: { ne?: string | null; sw?: string | null } | null
  /** Names a group circle, e.g. { singular: "country", plural: "countries" }. */
  readonly childNoun?: { singular: string; plural: string }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  // No WebGL (old devices, some headless browsers): show a note instead.
  const [failed, setFailed] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  // Bumped on every camera move so overlay markers re-project.
  const [, setFrame] = useState(0)

  const pointById = useMemo(
    () => new Map(points.map((p) => [p.id, p])),
    [points]
  )

  const regroup = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const projected = points.map((p) => {
      const { x, y } = map.project([p.lng, p.lat])

      return { id: p.id, x, y, weight: p.count }
    })
    setGroups(
      groupScreenPoints(projected, GROUP_RADIUS).map((g) => {
        const { lng, lat } = map.unproject([g.x, g.y])

        return { ids: g.ids, lng, lat, weight: g.weight }
      })
    )
  }, [points])

  const regroupRef = useRef(regroup)
  regroupRef.current = regroup

  // ── Initialise once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let alive = true
    let observer: ResizeObserver | undefined

    import("maplibre-gl")
      .then((maplibregl) => {
        maplibregl.setWorkerUrl(MAP_WORKER_URL)
        if (!alive || !containerRef.current) return

        const coords = [...points, ...pins].map((p) => [p.lng, p.lat] as const)
        let map: MapLibreMap
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            style: VOYAGER_NO_LABELS,
            center: coords[0] ? [coords[0][0], coords[0][1]] : [10, 50],
            zoom: coords.length === 1 ? 10 : 3,
            scrollZoom: false,
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
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right"
        )
        mapRef.current = map

        const b = parseBounds(bounds?.ne, bounds?.sw)
        if (b) {
          map.fitBounds(
            [
              [b.swLng, b.swLat],
              [b.neLng, b.neLat],
            ],
            { padding: 28, duration: 0 }
          )
        } else if (coords.length > 1) {
          const extent = new maplibregl.LngLatBounds(
            [coords[0]![0], coords[0]![1]],
            [coords[0]![0], coords[0]![1]]
          )
          for (const [lng, lat] of coords) extent.extend([lng, lat])
          map.fitBounds(extent, { padding: 56, maxZoom: 11, duration: 0 })
        }

        map.on("load", () => {
          if (!alive) return
          const countries = new Map<string, number>()
          for (const record of countryRecords) {
            const code = record.iso2?.toUpperCase()
            const shape = atlasPopulationBaseline.countries.find(
              (country) =>
                country.iso2 === code ||
                (code?.startsWith("GB-") && country.iso2 === "GB")
            )
            if (shape)
              countries.set(
                shape.iso3,
                (countries.get(shape.iso3) ?? 0) + record.count
              )
          }
          if (countries.size) {
            const known = [...countries.keys()]
            const populated = [...countries]
              .filter(([, count]) => count > 0)
              .map(([code]) => code)
            const empty = [...countries]
              .filter(([, count]) => count === 0)
              .map(([code]) => code)
            map.addSource("place-record-countries", {
              type: "geojson",
              data: atlasPopulationBaseline.geometryUrl,
            })
            map.addLayer({
              id: "place-record-fill",
              type: "fill",
              source: "place-record-countries",
              filter: ["in", ["get", "iso3"], ["literal", populated]],
              paint: { "fill-color": "#4338CA", "fill-opacity": 0.14 },
            })
            map.addLayer({
              id: "place-record-outline",
              type: "line",
              source: "place-record-countries",
              filter: ["in", ["get", "iso3"], ["literal", known]],
              paint: {
                "line-color": "#4338CA",
                "line-opacity": 0.35,
                "line-width": 1,
              },
            })
            map.addLayer({
              id: "place-record-empty",
              type: "line",
              source: "place-record-countries",
              filter: ["in", ["get", "iso3"], ["literal", empty]],
              paint: {
                "line-color": "#4338CA",
                "line-opacity": 0.8,
                "line-width": 1.5,
                "line-dasharray": [3, 2],
              },
            })
          }
          regroupRef.current()
          setFailed(false)
          setReady(true)
        })
        map.on("error", (event) => {
          if (alive && !("sourceId" in event) && !map.isStyleLoaded())
            setFailed(true)
        })
        map.on("zoomend", () => regroupRef.current())
        map.on("resize", () => regroupRef.current())
        map.on("move", () => setFrame((f) => f + 1))

        // The hero column can settle after the map mounts (fonts, grid).
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
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Group click: zoom to its members ────────────────────────────────────────
  const zoomToGroup = (group: Group) => {
    const map = mapRef.current
    if (!map) return
    const members = group.ids.flatMap((id) => {
      const point = pointById.get(id)

      return point ? [point] : []
    })
    const lngs = members.map((m) => m.lng)
    const lats = members.map((m) => m.lat)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      {
        padding: 72,
        maxZoom: Math.max(map.getZoom() + 2, 6),
        duration: prefersReducedMotion() ? 0 : 700,
      }
    )
  }

  const project = (lng: number, lat: number) =>
    mapRef.current?.project([lng, lat]) ?? { x: 0, y: 0 }

  // Skip markers panned out of view so they don't take keyboard focus.
  const inView = ({ x, y }: { x: number; y: number }) => {
    const el = mapRef.current?.getContainer()
    if (!el) return false
    const pad = 20

    return (
      x > -pad &&
      y > -pad &&
      x < el.clientWidth + pad &&
      y < el.clientHeight + pad
    )
  }

  const nouns = childNoun ?? { singular: "place", plural: "places" }

  if (atlasPlace) return <AtlasRegionMap label={label} place={atlasPlace} />

  return (
    <figure
      className="relative m-0 h-[320px] overflow-hidden rounded-[22px] sm:h-[400px] lg:h-auto lg:min-h-[400px]"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <div
        ref={containerRef}
        role="region"
        aria-busy={!ready && !failed}
        aria-label={label}
        // maplibre-gl.css makes the container position: relative, so size it
        // explicitly rather than with inset-0.
        style={{ width: "100%", height: "100%" }}
      />

      {!ready && !failed ? <MapLoading /> : null}

      {failed ? (
        <p
          className="absolute inset-0 m-0 flex items-center justify-center px-8 text-center text-[14px]"
          style={{ color: T.ink.dim }}
        >
          The map can&rsquo;t load in this browser. The list below has the same
          places.
        </p>
      ) : null}

      {listHref ? (
        <a
          href={listHref}
          className="absolute top-3 left-3 z-[2] inline-flex min-h-11 items-center rounded-full border bg-white px-3 text-[12px] font-semibold"
          style={{ borderColor: T.border.line }}
        >
          View places as a list →
        </a>
      ) : null}

      {/* Overlay markers — real links, above the canvas, below the controls */}
      {ready ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {groups.map((group) => {
            const { x, y } = project(group.lng, group.lat)
            if (!inView({ x, y })) return null
            const size = circleSize(group.weight)
            const style = {
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
            }
            const className =
              "pointer-events-auto absolute flex items-center justify-center rounded-full border-2 border-(--t-accent-primary) bg-white text-[12px] font-semibold text-(--t-accent-primary) transition-colors hover:bg-(--t-accent-primary) hover:text-white"

            if (group.ids.length === 1) {
              const point = pointById.get(group.ids[0]!)
              if (!point) return null
              const title = `${point.name}: ${formatCount(point.count)} ${countNoun(point.count, "library", "libraries")}`

              return (
                <Link
                  key={point.id}
                  href={point.href}
                  aria-label={title}
                  title={title}
                  className={className}
                  style={style}
                >
                  {formatCount(point.count)}
                </Link>
              )
            }

            const title = `${group.ids.length} ${nouns.plural}, ${formatCount(group.weight)} ${countNoun(group.weight, "library", "libraries")}. Zoom in`

            return (
              <button
                key={group.ids.join("|")}
                type="button"
                aria-label={title}
                title={title}
                onClick={() => zoomToGroup(group)}
                className={className}
                style={style}
              >
                {formatCount(group.weight)}
              </button>
            )
          })}

          {pins.map((pin) => {
            const { x, y } = project(pin.lng, pin.lat)
            if (!inView({ x, y })) return null
            const tint = tintForLibraryType(pin.libraryType)
            const body = (
              <Icon
                aria-hidden="true"
                height={16}
                icon="mdi:bank-outline"
                width={16}
              />
            )
            const className =
              "pointer-events-auto absolute flex size-[30px] items-center justify-center rounded-full border-2 transition-transform hover:scale-110 motion-reduce:hover:scale-100"
            const style = {
              left: x - 15,
              top: y - 15,
              background: tint.bg,
              color: tint.fg,
              borderColor: tint.fg,
            }

            return pin.href ? (
              <Link
                key={pin.id}
                href={pin.href}
                aria-label={pin.name}
                title={pin.name}
                className={className}
                style={style}
              >
                {body}
              </Link>
            ) : (
              <span
                key={pin.id}
                title={pin.name}
                className={className}
                style={style}
              >
                {body}
              </span>
            )
          })}
        </div>
      ) : null}

      <figcaption
        className="absolute bottom-8 left-3 z-[2] flex max-w-[calc(100%-4.5rem)] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[12.5px] leading-[1.35]"
        style={{
          background: "rgba(255,255,255,.94)",
          borderColor: T.border.line,
          color: T.ink.dim,
        }}
      >
        {pins.length > 0 ? (
          <span
            aria-hidden="true"
            className="flex size-[20px] shrink-0 items-center justify-center rounded-full border"
            style={{
              background: "var(--tint-public-bg)",
              borderColor: "var(--tint-public-fg)",
              color: "var(--tint-public-fg)",
            }}
          >
            <Icon height={11} icon="mdi:bank-outline" width={11} />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="flex size-[20px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px] font-semibold"
            style={{
              borderColor: T.accent.primary,
              color: T.accent.primary,
              background: "#fff",
            }}
          >
            n
          </span>
        )}
        <span>
          {countryRecords.length ? (
            <span className="mb-1 flex flex-wrap gap-3">
              <span>■ Place-based records</span>
              <span>▱ None recorded yet</span>
            </span>
          ) : null}
          {caption}
        </span>
      </figcaption>
    </figure>
  )
}

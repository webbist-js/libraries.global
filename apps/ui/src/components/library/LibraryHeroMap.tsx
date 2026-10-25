"use client"

import { Icon } from "@iconify/react"
import type { Map as MapLibreMap } from "maplibre-gl"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { MapLoading } from "@/components/map/MapLoading"
import { T } from "@/lib/design-tokens"
import { MAP_WORKER_URL } from "@/lib/maplibre"
import { Link } from "@/lib/navigation"

/** A numbered neighbour pin; the number matches the "Nearby libraries" list. */
export type LibraryMapNeighbour = {
  id: string
  name: string
  href: string | null
  lat: number
  lng: number
}

// Same basemap as the atlas location pages (LocationHeroMap).
const VOYAGER_NO_LABELS =
  "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"

const PILL =
  "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-[13.5px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/**
 * The library page's hero map: this library as a labelled indigo pin, its
 * nearest neighbours as numbered pins, and pills for directions and the
 * Atlas. The Visit section and the nearby list carry the same facts for
 * keyboard and screen reader users; the neighbour pins are links too.
 */
export function LibraryHeroMap({
  name,
  lat,
  lng,
  neighbours,
  directionsUrl,
  atlasHref,
}: {
  readonly name: string
  readonly lat: number
  readonly lng: number
  readonly neighbours: LibraryMapNeighbour[]
  readonly directionsUrl: string
  readonly atlasHref: string
}) {
  const tUi = useUiTranslations("ui")

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  // No WebGL (old devices, some headless browsers): show a note instead.
  const [failed, setFailed] = useState(false)
  // Bumped on every camera move so overlay markers re-project.
  const [, setFrame] = useState(0)

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
            style: VOYAGER_NO_LABELS,
            center: [lng, lat],
            zoom: 13,
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
          "top-left"
        )
        mapRef.current = map

        if (neighbours.length > 0) {
          const extent = new maplibregl.LngLatBounds([lng, lat], [lng, lat])
          for (const n of neighbours) extent.extend([n.lng, n.lat])
          map.fitBounds(extent, {
            padding: { top: 56, bottom: 72, left: 48, right: 48 },
            maxZoom: 14,
            duration: 0,
          })
        }

        map.on("load", () => {
          if (alive) {
            setFailed(false)
            setReady(true)
          }
        })
        map.on("error", (event) => {
          if (alive && !("sourceId" in event) && !map.isStyleLoaded())
            setFailed(true)
        })
        map.on("move", () => setFrame((f) => f + 1))

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

  const project = (pLng: number, pLat: number) =>
    mapRef.current?.project([pLng, pLat]) ?? { x: 0, y: 0 }

  const inView = ({ x, y }: { x: number; y: number }) => {
    const el = mapRef.current?.getContainer()
    if (!el) return false

    return (
      x > -16 && y > -16 && x < el.clientWidth + 16 && y < el.clientHeight + 16
    )
  }

  const here = project(lng, lat)

  return (
    <figure
      className="relative m-0 aspect-[4/3] w-full overflow-hidden rounded-3xl"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <div
        ref={containerRef}
        role="region"
        aria-busy={!ready && !failed}
        aria-label={`Map of ${name} and nearby libraries`}
        // Override MapLibre's relative positioning so the map fills the
        // media frame even when its height comes from the aspect ratio.
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {!ready && !failed ? <MapLoading /> : null}

      {failed ? (
        <p
          className="absolute inset-0 m-0 flex items-center justify-center px-8 text-center text-[14px]"
          style={{ color: T.ink.dim }}
        >
          The map can&rsquo;t load in this browser. The address and nearby
          libraries are listed below.
        </p>
      ) : null}

      {ready ? (
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {neighbours.map((n, i) => {
            const at = project(n.lng, n.lat)
            if (!inView(at)) return null
            const label = `${i + 1}. ${n.name}`
            const className =
              "pointer-events-auto absolute flex size-[26px] items-center justify-center rounded-full border-2 text-[12px] font-bold no-underline transition-transform hover:scale-110 motion-reduce:hover:scale-100"
            const style = {
              left: at.x - 13,
              top: at.y - 13,
              background: "var(--tint-public-bg)",
              borderColor: "var(--tint-public-fg)",
              color: "var(--tint-public-fg)",
            }

            return n.href ? (
              <Link
                key={n.id}
                aria-label={label}
                className={className}
                href={n.href}
                style={style}
                title={n.name}
              >
                {i + 1}
              </Link>
            ) : (
              <span
                key={n.id}
                className={className}
                style={style}
                title={n.name}
              >
                {i + 1}
              </span>
            )
          })}

          {inView(here) ? (
            <div
              aria-hidden="true"
              className="absolute flex flex-col items-center"
              style={{
                left: here.x,
                top: here.y,
                transform: "translate(-50%, calc(-100% + 9px))",
              }}
            >
              <span
                className="mb-1.5 max-w-[220px] truncate rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-white"
                style={{ background: T.ink.base }}
              >
                {name}
              </span>
              <span
                className="size-[18px] rounded-full border-[3px] border-white"
                style={{
                  background: T.accent.primary,
                  boxShadow: `0 0 0 2px ${T.accent.primary}`,
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 z-[2] flex flex-wrap gap-2 pr-16">
        <a
          className={PILL}
          href={directionsUrl}
          rel="noopener noreferrer"
          style={{ borderColor: T.border.line, color: T.ink.base }}
          target="_blank"
        >
          <Icon
            aria-hidden="true"
            height={15}
            icon="mdi:navigation-variant-outline"
            width={15}
          />
          Get directions
          <span className="sr-only"> {tUi("opens_in_a_new_tab")}</span>
        </a>
        <Link
          className={PILL}
          href={atlasHref}
          style={{ borderColor: T.border.line, color: T.ink.base }}
        >
          Open in the atlas
        </Link>
      </div>
    </figure>
  )
}

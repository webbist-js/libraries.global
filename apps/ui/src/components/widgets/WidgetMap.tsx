"use client"

import type { WidgetLibrary } from "@repo/shared-data"
import type { Map as MapLibreMap } from "maplibre-gl"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { MAP_WORKER_URL } from "@/lib/maplibre"
import { widgetCopy } from "@/lib/widgets/copy"

type MappedLibrary = WidgetLibrary & { location: { lat: number; lng: number } }
type MarkerBucket = { key: string; x: number; y: number; rows: MappedLibrary[] }

/** The same MapLibre basemap and worker as library/location pages, with HTML keyboard controls. */
export default function WidgetMap({
  rows,
  selected,
  onSelect,
  accent,
  clusters,
  labels,
  reset,
  locale = "en",
}: {
  readonly rows: WidgetLibrary[]
  readonly selected: string | null
  readonly onSelect: (id: string) => void
  readonly accent: string
  readonly clusters: boolean
  readonly labels: boolean
  readonly locale?: string
  readonly reset: boolean
}) {
  const t = (text: string) => widgetCopy(locale, text)
  const element = useRef<HTMLDivElement>(null),
    map = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0),
    [buckets, setBuckets] = useState<MarkerBucket[]>([])
  const extent = useRef<() => void>(() => {})
  useEffect(() => {
    if (!element.current) return
    let alive = true,
      instance: MapLibreMap | undefined,
      observer: ResizeObserver | undefined
    import("maplibre-gl")
      .then((lib) => {
        if (!alive || !element.current) return
        lib.setWorkerUrl(MAP_WORKER_URL)
        try {
          instance = new lib.Map({
            container: element.current,
            style:
              "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json",
            center: [0, 20],
            zoom: 1,
            cooperativeGestures: true,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            attributionControl: { compact: true },
          })
          instance.touchZoomRotate.disableRotation()
          instance.addControl(
            new lib.NavigationControl({ showCompass: false }),
            "top-left"
          )
          map.current = instance
          instance.on("load", () => {
            if (alive) setReady(true)
          })
          instance.on("error", () => {
            if (alive && !instance?.isStyleLoaded()) setFailed(true)
          })
          observer = new ResizeObserver(() => {
            instance?.resize()
          })
          observer.observe(element.current)
        } catch {
          setFailed(true)
        }
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
      observer?.disconnect()
      instance?.remove()
      map.current = null
    }
  }, [attempt])
  const points = useMemo(
    () => rows.filter((r): r is MappedLibrary => Boolean(r.location)),
    [rows]
  )
  useEffect(() => {
    const m = map.current
    if (!ready || !m || !points.length) return
    const fit = () => {
      const lngs = points.map((p) => p.location.lng),
        lats = points.map((p) => p.location.lat)
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 52, maxZoom: 14, duration: 0 }
      )
    }
    extent.current = fit
    fit()
    // Membership, rather than the selected record, determines the default extent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rows])
  useEffect(() => {
    const row = points.find((p) => p.documentId === selected)
    if (ready && row)
      map.current?.easeTo({
        center: [row.location.lng, row.location.lat],
        duration: 0,
      })
  }, [selected, ready, points])
  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    // MapLibre owns its viewport. Snapshot projected positions at its event
    // boundary; reading a mutable map ref in render can be memoised stale.
    const projectMarkers = () => {
      const container = m.getContainer()
      const next = new Map<string, MarkerBucket>()
      for (const row of points) {
        const point = m.project([row.location.lng, row.location.lat])
        if (
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < 0 ||
          point.y < 0 ||
          point.x > container.clientWidth ||
          point.y > container.clientHeight
        )
          continue
        const key =
          clusters && m.getZoom() < 13
            ? `${Math.round(point.x / 52)}:${Math.round(point.y / 52)}`
            : row.documentId
        const bucket = next.get(key)
        if (bucket) bucket.rows.push(row)
        else next.set(key, { key, x: point.x, y: point.y, rows: [row] })
      }
      setBuckets([...next.values()])
    }
    m.on("move", projectMarkers)
    m.on("resize", projectMarkers)
    const initialFrame = requestAnimationFrame(projectMarkers)

    return () => {
      cancelAnimationFrame(initialFrame)
      m.off("move", projectMarkers)
      m.off("resize", projectMarkers)
    }
  }, [ready, points, clusters])

  return (
    <div
      className="relative isolate min-h-[360px] overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface)"
      aria-label="Library map. Use the list for all records, including libraries without coordinates."
    >
      {/* MapLibre's unlayered .maplibregl-map position rule overrides Tailwind
          utilities. Keep the canvas positioned explicitly inside its fixed frame. */}
      <div ref={element} style={{ position: "absolute", inset: 0 }} />
      {failed ? (
        <p
          role="status"
          className="absolute inset-x-5 top-16 z-10 rounded-xl bg-white p-4 text-sm shadow"
        >
          {t("The map is unavailable. Browse the same libraries in the list.")}
          <Button
            variant="link"
            className="mt-2 min-h-11 px-0"
            onClick={() => {
              setReady(false)
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
          >
            {t("Retry map")}
          </Button>
        </p>
      ) : !ready ? (
        <p
          role="status"
          className="absolute inset-x-5 top-16 rounded-xl bg-white p-4 text-sm"
        >
          {t("Loading map…")}
        </p>
      ) : null}
      {ready && !failed
        ? buckets.map((b) => (
            <button
              key={b.key}
              type="button"
              className="absolute z-10 flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2"
              style={{ left: b.x, top: b.y }}
              title={
                b.rows.length > 1
                  ? `${b.rows.length} libraries — zoom in`
                  : b.rows[0]!.name
              }
              aria-label={
                b.rows.length > 1
                  ? `Zoom to ${b.rows.length} libraries`
                  : b.rows[0]!.name
              }
              aria-pressed={
                b.rows.length === 1
                  ? selected === b.rows[0]!.documentId
                  : undefined
              }
              onClick={() => {
                if (b.rows.length === 1) onSelect(b.rows[0]!.documentId)
                else
                  map.current?.easeTo({
                    center: [b.rows[0]!.location.lng, b.rows[0]!.location.lat],
                    zoom: (map.current?.getZoom() ?? 5) + 2,
                    duration: 0,
                  })
              }}
            >
              <span
                className="flex items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-md"
                style={{
                  background: accent,
                  width: b.rows.length > 1 ? 36 : 20,
                  height: b.rows.length > 1 ? 36 : 20,
                  outline: b.rows.some((r) => r.documentId === selected)
                    ? "3px solid #17162B"
                    : undefined,
                }}
              >
                {b.rows.length > 1 ? b.rows.length : null}
              </span>
              {labels && b.rows.length === 1 ? (
                <span className="absolute top-10 max-w-36 rounded bg-white px-2 py-1 text-xs font-semibold text-black shadow">
                  {b.rows[0]!.name}
                </span>
              ) : null}
            </button>
          ))
        : null}
      {reset && ready ? (
        <Button
          size="pill"
          variant="surface"
          className="absolute top-3 right-3 z-10"
          onClick={() => extent.current()}
        >
          {t("Reset view")}
        </Button>
      ) : null}
      <span className="sr-only">
        Scroll zoom requires a modifier key. Use two fingers to move the map on
        a phone.
      </span>
    </div>
  )
}

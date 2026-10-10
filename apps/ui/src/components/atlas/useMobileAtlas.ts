"use client"

import { localDateTime, type PublicLiveState } from "@repo/shared-data"
import { useEffect, useMemo, useRef, useState } from "react"

import type { PublicMobileTimetable } from "@/lib/mobile/types"
import {
  loadStopTimetable,
  searchMobileViewport,
  stopMatchesOpening,
  type MobileStopHit,
  type MobileVisitFilter,
  type MobileViewport,
  type MobileStopFilters,
} from "@/lib/mobile-stop-search"

import type { AtlasView } from "./AtlasMap"

const EMPTY: MobileViewport = {
  stops: [],
  clusters: [],
  total: 0,
  zoomIn: false,
}

export const isFreshLive = (state: PublicLiveState | undefined) =>
  !!state && state.sharesLive && ["here", "road", "late"].includes(state.kind)

/** Viewport queries never download the worldwide stop list. Route and live work
 * are bounded independently, and hidden pages make no polling requests. */
export function useMobileAtlas(
  view: AtlasView | null,
  enabled: boolean,
  mode: MobileVisitFilter,
  now: Date,
  filters?: MobileStopFilters
) {
  const [viewport, setViewport] = useState(EMPTY)
  const [error, setError] = useState(false)
  const [routes, setRoutes] = useState<PublicMobileTimetable[]>([])
  const [live, setLive] = useState<Record<string, PublicLiveState>>({})
  const cache = useRef(
    new Map<string, { at: number; data: PublicMobileTimetable }>()
  )
  const roadCache = useRef(
    new Map<
      string,
      {
        at: number
        data: Pick<PublicMobileTimetable, "roadRoutes" | "routesUnavailable">
      }
    >()
  )
  const minute = Math.floor(now.getTime() / 60_000)
  const filterKey = JSON.stringify(filters ?? {})
  useEffect(() => {
    if (!enabled || !view) {
      setViewport(EMPTY)
      setError(false)

      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchMobileViewport(
        view.bounds,
        view.zoom,
        mode,
        new Date(),
        JSON.parse(filterKey)
      )
        .then((result) => {
          if (!cancelled) {
            setViewport(result)
            setError(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setViewport(EMPTY)
            setError(true)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [view, enabled, mode, minute, filterKey])

  const ids = useMemo(
    () =>
      [
        ...new Set(viewport.stops.map((stop) => stop.library_document_id)),
      ].slice(0, 25),
    [viewport.stops]
  )
  const idsKey = ids.join(",")
  useEffect(() => {
    if (!enabled || !idsKey) {
      setRoutes([])
      setLive({})

      return
    }
    if (document.hidden) return
    const controller = new AbortController()
    Promise.allSettled(
      idsKey.split(",").map(async (id) => {
        const existing = cache.current.get(id)
        const data =
          existing && Date.now() - existing.at < 300_000
            ? existing.data
            : await loadStopTimetable(
                { library_document_id: id },
                controller.signal
              )
        if (!existing || Date.now() - existing.at >= 300_000)
          cache.current.set(id, { at: Date.now(), data })
        if (cache.current.size > 50)
          cache.current.delete(cache.current.keys().next().value!)
        const date = localDateTime(new Date(), data.timezone).date
        const key = `${id}:${data.updatedAt}:${date}:${mode}`
        const road = roadCache.current.get(key)
        if (road && Date.now() - road.at < 300_000)
          return { ...data, ...road.data }
        let geometry: Pick<
          PublicMobileTimetable,
          "roadRoutes" | "routesUnavailable"
        >
        try {
          const response = await fetch(
            `/api/mobile/${encodeURIComponent(id)}/routes?${new URLSearchParams({ date, mode })}`,
            { signal: controller.signal }
          )
          if (!response.ok) throw new Error("Road routes unavailable")
          const result = await response.json()
          geometry = {
            roadRoutes: result.routes,
            routesUnavailable: result.unavailable,
          }
        } catch {
          geometry = { roadRoutes: [], routesUnavailable: true }
        }
        if (!controller.signal.aborted && !geometry.routesUnavailable) {
          roadCache.current.set(key, { at: Date.now(), data: geometry })
          if (roadCache.current.size > 50)
            roadCache.current.delete(roadCache.current.keys().next().value!)
        }

        return { ...data, ...geometry }
      })
    ).then((data) => {
      if (!controller.signal.aborted)
        setRoutes(
          data.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : []
          )
        )
    })

    return () => controller.abort()
  }, [enabled, idsKey, minute, mode])
  useEffect(() => {
    if (!enabled || !idsKey) return
    const controller = new AbortController()
    let busy = false
    async function poll() {
      if (document.hidden || busy) return
      busy = true
      try {
        const response = await fetch(
          `/api/mobile/live?ids=${encodeURIComponent(idsKey)}`,
          { signal: controller.signal, cache: "no-store" }
        )
        if (!response.ok) throw new Error("Live data unavailable")
        const result = (await response.json()) as { states: PublicLiveState[] }
        if (!controller.signal.aborted)
          setLive(
            Object.fromEntries(
              result.states.map((state) => [state.libraryDocumentId, state])
            )
          )
      } catch {
        if (!controller.signal.aborted) setLive({})
      } finally {
        busy = false
      }
    }
    void poll()
    const timer = setInterval(poll, 30_000)
    document.addEventListener("visibilitychange", poll)

    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener("visibilitychange", poll)
    }
  }, [enabled, idsKey])
  const periodStops: MobileStopHit[] =
    mode === "live"
      ? viewport.stops.filter((stop) =>
          isFreshLive(live[stop.library_document_id])
        )
      : viewport.stops
  const stops =
    filters && filters.opening !== "any"
      ? periodStops.filter((stop) =>
          stopMatchesOpening(stop, filters, now, live[stop.library_document_id])
        )
      : periodStops
  const preciseCount = mode === "live" || (filters && filters.opening !== "any")

  return {
    ...viewport,
    stops,
    clusters: preciseCount ? [] : viewport.clusters,
    total: preciseCount && !viewport.zoomIn ? stops.length : viewport.total,
    routes: preciseCount
      ? routes.filter((route) =>
          stops.some((stop) => stop.library_document_id === route.documentId)
        )
      : routes,
    live,
    error,
    routesUnavailable: routes.some((library) => library.routesUnavailable),
  }
}

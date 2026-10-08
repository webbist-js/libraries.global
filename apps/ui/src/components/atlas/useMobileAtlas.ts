"use client"

import type { PublicLiveState } from "@repo/shared-data"
import { useEffect, useMemo, useRef, useState } from "react"

import type { PublicMobileTimetable } from "@/lib/mobile/types"
import {
  loadStopTimetable,
  searchMobileViewport,
  type MobileStopHit,
  type MobileVisitFilter,
  type MobileViewport,
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
  now: Date
) {
  const [viewport, setViewport] = useState(EMPTY)
  const [error, setError] = useState(false)
  const [routes, setRoutes] = useState<PublicMobileTimetable[]>([])
  const [live, setLive] = useState<Record<string, PublicLiveState>>({})
  const cache = useRef(
    new Map<string, { at: number; data: PublicMobileTimetable }>()
  )
  const minute = Math.floor(now.getTime() / 60_000)
  useEffect(() => {
    if (!enabled || !view) {
      setViewport(EMPTY)

      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchMobileViewport(view.bounds, view.zoom, mode, new Date())
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
  }, [view, enabled, mode, minute])

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
        if (existing && Date.now() - existing.at < 300_000) return existing.data
        const data = await loadStopTimetable(
          { library_document_id: id },
          controller.signal
        )
        cache.current.set(id, { at: Date.now(), data })
        if (cache.current.size > 50)
          cache.current.delete(cache.current.keys().next().value!)

        return data
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
  }, [enabled, idsKey, minute])
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
  const stops: MobileStopHit[] =
    mode === "live"
      ? viewport.stops.filter((stop) =>
          isFreshLive(live[stop.library_document_id])
        )
      : viewport.stops

  return {
    ...viewport,
    stops,
    clusters: mode === "live" ? [] : viewport.clusters,
    total: mode === "live" ? stops.length : viewport.total,
    routes,
    live,
    error,
  }
}

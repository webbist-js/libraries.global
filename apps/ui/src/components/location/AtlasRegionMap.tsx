"use client"

import {
  emptyAtlasFilters,
  type AtlasScope,
  type AtlasExtentResponse,
} from "@repo/shared-data"
import { useEffect, useRef, useState } from "react"

import {
  atlasQuery,
  loadAtlasGeneration,
  type AtlasGeneration,
} from "@/components/atlas/atlas-data-client"
import type { LayerId } from "@/components/atlas/atlas.logic"
import {
  AtlasMap,
  type AtlasMapHandle,
  type AtlasView,
} from "@/components/atlas/AtlasMap"
import { useRouter } from "@/lib/navigation"

const layers: LayerId[] = ["pins"]
const libraries: never[] = []

export function AtlasRegionMap({
  label,
  place,
}: {
  readonly label: string
  readonly place: NonNullable<AtlasScope["place"]>
}) {
  const map = useRef<AtlasMapHandle>(null),
    router = useRouter()
  const [view, setView] = useState<AtlasView | null>(null),
    [ready, setReady] = useState(false),
    [generation, setGeneration] = useState<AtlasGeneration | null>(null),
    [error, setError] = useState<string | null>(null),
    [current, setCurrent] = useState(false)
  const key = JSON.stringify({ view, place, current })
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController(),
      scope: AtlasScope = {
        place,
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      }
    atlasQuery<AtlasExtentResponse>(
      {
        schemaVersion: 1,
        purpose: "extent",
        scope,
        centre: { lat: 30, lng: 10 },
      },
      controller.signal
    )
      .then((result) => {
        if (result.bounds) map.current?.fitBounds(result.bounds)
      })
      .catch(() => setError("The map is temporarily unavailable."))

    return () => controller.abort()
  }, [ready, place])
  useEffect(() => {
    if (!view) return
    let controller: AbortController | undefined
    const run = () => {
      controller?.abort()
      if (document.hidden) return
      controller = new AbortController()
      const signal = controller.signal
      loadAtlasGeneration(
        {
          schemaVersion: 1,
          purpose: "viewport",
          scope: {
            place,
            bbox: view.bounds,
            filters: emptyAtlasFilters(),
            accessibility: { enabled: false, selected: [], view: "matches" },
          },
          zoom: view.zoom,
          centre: { lat: view.lat, lng: view.lng },
          width: 800,
          height: 450,
          populations: ["listed"],
          drawingPreference: current ? "current" : "auto",
        },
        signal
      )
        .then((value) => {
          if (!signal.aborted) {
            setGeneration(value)
            setError(null)
          }
        })
        .catch(() => {
          if (!signal.aborted) setError("The map is temporarily unavailable.")
        })
    }
    const debounce = setTimeout(run, 200),
      poll = setInterval(run, 15000)
    document.addEventListener("visibilitychange", run)

    return () => {
      clearTimeout(debounce)
      clearInterval(poll)
      controller?.abort()
      document.removeEventListener("visibilitychange", run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const select = async (id: string) => {
    try {
      const response = await fetch(
        `/api/atlas/library?${new URLSearchParams({ key: id })}`
      )
      if (!response.ok) throw new Error("Selected library unavailable")
      const body = await response.json()
      if (body.library.path) router.push(body.library.path)
    } catch {
      setError("This library could not be loaded.")
    }
  }

  return (
    <div
      role="region"
      aria-label={label}
      className="relative h-[420px] overflow-hidden rounded-2xl"
    >
      <AtlasMap
        ref={map}
        libraries={libraries}
        closures={libraries}
        layers={layers}
        heatOpacity={0.7}
        selected={null}
        hovered={null}
        projection="flat"
        initialView={null}
        padding={{ left: 0, right: 0, bottom: 0 }}
        onSelect={(id) => {
          if (id) void select(id)
        }}
        onView={setView}
        onReady={() => setReady(true)}
        onError={() => setError("This browser could not load the map.")}
        generation={generation}
        onGeometryError={() => setCurrent(true)}
        className="absolute inset-0"
      />
      <p
        role="status"
        className="absolute bottom-8 left-3 rounded-xl bg-white px-3 py-2 text-sm"
      >
        {error ??
          (generation
            ? `${generation.viewport.populations.listed?.exactTotal.toLocaleString()} mapped libraries in view`
            : "Loading library locations…")}
      </p>
    </div>
  )
}

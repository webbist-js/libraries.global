"use client"

import type {
  AtlasCountsResponse,
  AtlasExtentResponse,
  AtlasQueryRequest,
  AtlasQueryResponse,
  AtlasScope,
  AtlasSearchResponse,
  AtlasSuggestionsResponse,
} from "@repo/shared-data"
import { useCallback, useEffect, useMemo, useState } from "react"

import { atlasListLibrary, atlasPointLibrary } from "./atlas-data-adapter"
import {
  atlasQuery,
  loadAtlasGeneration,
  type AtlasGeneration,
} from "./atlas-data-client"
import { atlasBuildingFilters, atlasViewportCamera } from "./atlas-query-input"
import type {
  AtlasFilters,
  AtlasLibrary,
  LayerId,
  AccessibilityView,
} from "./atlas.logic"
import type { AtlasView } from "./AtlasMap"
import type { Place } from "./AtlasSearchTab"

/** Requests pause in background tabs and abort on every generation change. */
export function useAtlasRequest<T extends AtlasQueryResponse>(
  request: AtlasQueryRequest | null,
  refresh = 0
) {
  const key = JSON.stringify(request)
  const [state, setState] = useState<{
    key: string
    value?: T
    error?: string
  }>({ key })
  useEffect(() => {
    if (!request) return
    let controller: AbortController | undefined
    const run = () => {
      controller?.abort()
      if (document.hidden) return
      const current = new AbortController()
      controller = current
      atlasQuery<T>(request, current.signal)
        .then((value) => {
          if (!current.signal.aborted) setState({ key, value })
        })
        .catch((error) => {
          if (!current.signal.aborted)
            setState({
              key,
              error:
                error instanceof Error ? error.message : "Atlas unavailable",
            })
        })
    }
    const timer = setTimeout(run, 250),
      poll = setInterval(run, 60000)
    document.addEventListener("visibilitychange", run)

    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      controller?.abort()
      document.removeEventListener("visibilitychange", run)
    }
    // The serialized, normalized request controls identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh])

  return state.key === key ? state : { key }
}

export function useAtlasData(
  enabled: boolean,
  filters: AtlasFilters,
  layers: LayerId[],
  access: string[],
  accessView: AccessibilityView,
  view: AtlasView | null,
  query: string,
  selectedId: string | null,
  now: Date
) {
  const [refresh, setRefresh] = useState(0),
    retry = useCallback(() => setRefresh((n) => n + 1), [])
  const [facilityQuery, setFacilityQuery] = useState(""),
    [facilityAfter, setFacilityAfter] = useState<string | undefined>()
  const world = useMemo<AtlasScope>(
    () => ({
      filters: atlasBuildingFilters(filters),
      accessibility: {
        enabled: layers.includes("access"),
        selected: access,
        view: accessView,
      },
    }),
    [filters, layers, access, accessView]
  )
  const scope = useMemo<AtlasScope>(
    () => ({
      ...world,
      bbox: atlasViewportCamera(view).bbox,
    }),
    [world, view]
  )
  const [forceCurrent, setForceCurrent] = useState(false)
  const viewportRequest = useMemo<
    Extract<AtlasQueryRequest, { purpose: "viewport" }>
  >(
    () => ({
      schemaVersion: 1,
      purpose: "viewport",
      scope,
      zoom: atlasViewportCamera(view).zoom,
      centre: atlasViewportCamera(view).centre,
      width: globalThis.innerWidth || 1024,
      height: globalThis.innerHeight || 768,
      populations: [
        "listed",
        ...(layers.includes("closures") ? ["closures" as const] : []),
        ...(layers.includes("events") ? ["events" as const] : []),
        ...(layers.includes("openLate") ? ["late" as const] : []),
      ],
      drawingPreference: forceCurrent ? "current" : "auto",
      quality: layers.includes("complete"),
      density: layers.includes("density") || layers.includes("events"),
    }),
    [scope, view, layers, forceCurrent]
  )
  const key = JSON.stringify(viewportRequest)
  const [generation, setGeneration] = useState<AtlasGeneration | null>(null),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let controller: AbortController | undefined
    const run = () => {
      controller?.abort()
      if (document.hidden) return
      const current = new AbortController()
      controller = current
      loadAtlasGeneration(viewportRequest, current.signal)
        .then((value) => {
          if (!current.signal.aborted) {
            setGeneration(value)
            setError(null)
          }
        })
        .catch((reason) => {
          if (!current.signal.aborted)
            setError(
              reason instanceof Error ? reason.message : "Atlas unavailable"
            )
        })
    }
    const timer = setTimeout(run, 200),
      poll = setInterval(run, 15000)
    document.addEventListener("visibilitychange", run)

    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      controller?.abort()
      document.removeEventListener("visibilitychange", run)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, refresh])
  const counts = useAtlasRequest<AtlasCountsResponse>(
    enabled
      ? {
          schemaVersion: 1,
          purpose: "counts",
          scope: world,
          facilityQuery,
          facilityAfter,
        }
      : null,
    refresh
  )
  const suggestions = useAtlasRequest<AtlasSuggestionsResponse>(
    enabled && counts.value?.exactTotal === 0
      ? { schemaVersion: 1, purpose: "suggestions", scope: world }
      : null,
    refresh
  )
  const search = useAtlasRequest<AtlasSearchResponse>(
    enabled && query.trim().length >= 2
      ? {
          schemaVersion: 1,
          purpose: "search",
          scope: world,
          q: query.slice(0, 80),
        }
      : null,
    refresh
  )
  const [selection, setSelection] = useState<{
    key: string
    library: AtlasLibrary | null
    revision: number
    error?: string
  } | null>(null)
  useEffect(() => {
    if (!enabled || !selectedId) return
    const controller = new AbortController()
    fetch(
      `/api/atlas/library?${new URLSearchParams({ key: selectedId, locale: document.documentElement.lang || "en" })}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      }
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "This library is no longer available."
              : "The selected library could not be loaded."
          )

        return r.json()
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setSelection({
            key: selectedId,
            revision: refresh,
            library: data.library,
          })
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setSelection({
            key: selectedId,
            revision: refresh,
            library: null,
            error: reason.message,
          })
      })

    return () => controller.abort()
  }, [enabled, selectedId, refresh])
  const points = useMemo(
    () => (population: "listed" | "closures") => {
      const value = generation?.viewport.populations[population]

      return value?.mode === "points"
        ? value.points.map((p) => atlasPointLibrary(p, generation!.dictionary))
        : []
    },
    [generation]
  )
  const listed = useMemo(() => points("listed"), [points]),
    closures = useMemo(() => points("closures"), [points])
  const fit = async (place?: Place["scope"]) =>
    atlasQuery<AtlasExtentResponse>({
      schemaVersion: 1,
      purpose: "extent",
      scope: {
        ...world,
        ...(place
          ? {
              place,
              filters: {
                ...world.filters,
                types: [],
                opening: "any",
                operators: [],
                facilities: [],
                events: false,
                catalogue: false,
                founded: null,
              },
              accessibility: { ...world.accessibility, enabled: false },
            }
          : {}),
      },
      centre: { lat: view?.lat ?? 30, lng: view?.lng ?? 10 },
    })
  const places: Place[] = (search.value?.places ?? [])
    .filter((p) => ["city", "region", "country"].includes(p.level))
    .map((p) => ({
      key: `${p.level}:${p.id}`,
      label: p.name,
      sub: p.level === "city" ? "Place" : p.level,
      kind: p.level as Place["kind"],
      libraries: [],
      exactTotal: p.exactTotal,
      scope: { level: p.level, id: p.id },
    }))

  return {
    generation,
    scope,
    world,
    retry,
    onGeometryError: () => setForceCurrent(true),
    error:
      error ??
      counts.error ??
      search.error ??
      (selection?.key === selectedId && selection.revision === refresh
        ? selection.error
        : undefined),
    counts: counts.value,
    suggestions: suggestions.value,
    searchLibraries: (search.value?.libraries ?? []).map(atlasListLibrary),
    places,
    listed,
    closures,
    selected:
      selection?.key === selectedId && selection.revision === refresh
        ? selection.library
        : null,
    selectionLoading: Boolean(
      enabled &&
      selectedId &&
      (selection?.key !== selectedId || selection.revision !== refresh)
    ),
    selectionError:
      selection?.key === selectedId && selection.revision === refresh
        ? selection.error
        : undefined,
    fit,
    now,
    onFacilitySearch: (value: string) => {
      setFacilityAfter(undefined)
      setFacilityQuery(value)
    },
    onMoreFacilities: () => setFacilityAfter(counts.value?.facilitiesNext),
  }
}

"use client"

import {
  atlasLocalGeography,
  type AtlasAccessMetric,
  type AtlasAccessLevel,
  type AtlasLibraryAccessResponse,
  type AtlasQueryRequest,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { AnalysisTab } from "@/components/atlas/AtlasAnalysisWorkspace"
import { useEntitlements } from "@/lib/access-client"
import { pushAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import type { MobileStopHit, MobileVisitFilter } from "@/lib/mobile-stop-search"
import { cn } from "@/lib/styles"

import { atlasBuildingFilters } from "./atlas-query-input"
import { Icon, type IconName, PANEL_STYLE } from "./atlas-ui"
import {
  activeFilterCount,
  applyFilters,
  accessibilityLibraries,
  accessibilitySummary,
  type AccessibilityView,
  type AtlasFilters,
  type AtlasLibrary,
  EMPTY_FILTERS,
  fromFeatureCollection,
  inBounds,
  layerAccess,
  layerDef,
  type LayerId,
  loosenSuggestions,
  parseUrlState,
  type Tier,
  tierForPlan,
  toggleLayer,
  withRequiredLibraryLocations,
  toUrlParams,
  typeGroupOf,
  TYPE_GROUPS,
} from "./atlas.logic"
import { AtlasAccessAnalysis } from "./AtlasAccessAnalysis"
import { AtlasAccessibilityAnalysis } from "./AtlasAccessibilityAnalysis"
import {
  AtlasCount,
  AtlasLegends,
  AtlasMapLegend,
  ViewToggle,
} from "./AtlasBottomBar"
import {
  AtlasBanner,
  AtlasLoading,
  AtlasNoMatch,
  AtlasToast,
} from "./AtlasEdgeStates"
import { AtlasFiltersTab } from "./AtlasFiltersTab"
import { AtlasLayersTab } from "./AtlasLayersTab"
import { AtlasLibraryPanel } from "./AtlasLibraryPanel"
import { AtlasListView } from "./AtlasListView"
import { AtlasMap, type AtlasMapHandle, type AtlasView } from "./AtlasMap"
import { AtlasMobileFilters, AtlasMobileStops } from "./AtlasMobileStops"
import { AtlasPlansSheet } from "./AtlasPlansSheet"
import {
  AtlasSearchTab,
  buildPlaces,
  type Place,
  type RecentItem,
} from "./AtlasSearchTab"
import { AtlasStopPanel } from "./AtlasStopPanel"
import { useAtlasData, useAtlasRequest } from "./useAtlasData"
import { useMobileAtlas } from "./useMobileAtlas"

type Tab = "search" | "filter" | "layers"
type SheetSize = "peek" | "half" | "full"
type AnalysisMode = "libraryAccess" | "accessibility"

const LEFT_W = 400
const RIGHT_W = 380
const GAP = 16
const RECENT_KEY = "atlas.recent"
const HINT_KEY = "atlas.globeHintDismissed"

// Per-viewer conveniences only; the page works without storage.
function readStorage<V>(key: string, fallback: V): V {
  try {
    const raw = globalThis.localStorage?.getItem(key)

    return raw ? (JSON.parse(raw) as V) : fallback
  } catch {
    return fallback
  }
}
function writeStorage(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode, blocked) — ignore
  }
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener("change", update)

    return () => mq.removeEventListener("change", update)
  }, [])

  return mobile
}

function useTier(): { tier: Tier; ready: boolean } {
  const { plan, ready } = useEntitlements()

  return { tier: tierForPlan(plan), ready }
}

export function AtlasExplorer({
  contributePrompt,
  feedbackPrompt,
  scalable = false,
}: {
  /** Server-rendered invitation to contribute, at the foot of the Search
   * tab; null when the reader has hidden it. */
  readonly contributePrompt?: ReactNode
  /** Feedback stays in the bottom controls in both map and list views. */
  readonly feedbackPrompt?: ReactNode
  readonly scalable?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const mapRef = useRef<AtlasMapHandle>(null)
  const isMobile = useIsMobile()
  const { tier, ready: entitlementsReady } = useTier()

  // ── State (hydrated from the URL after mount) ─────────────────────────────
  const [hydrated, setHydrated] = useState(false)
  const [initialView, setInitialView] = useState<{
    lat: number
    lng: number
    zoom: number
  } | null>(null)
  const [filters, setFilters] = useState<AtlasFilters>(EMPTY_FILTERS)
  const [layers, setLayers] = useState<LayerId[]>(["pins"])
  const [accessibility, setAccessibility] = useState<string[]>([])
  const [accessibilityView, setAccessibilityView] =
    useState<AccessibilityView>("matches")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [list, setList] = useState(false)
  const [projection, setProjection] = useState<"globe" | "flat">("globe")

  const [all, setAll] = useState<AtlasLibrary[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<"webgl" | "style" | null>(null)
  const [online, setOnline] = useState(true)
  const [view, setView] = useState<AtlasView | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [mobileMode, setMobileMode] = useState<MobileVisitFilter>("any")
  const [selectedStop, setSelectedStop] = useState<MobileStopHit | null>(null)

  const [tab, setTab] = useState<Tab>("search")
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState("")
  const [hovered, setHovered] = useState<AtlasLibrary | null>(null)
  const [heatOpacity, setHeatOpacity] = useState(0.7)
  const [perCapitaOpacity, setPerCapitaOpacity] = useState(0.85)
  const [accessMetric, setAccessMetric] = useState<AtlasAccessMetric>("per100k")
  const [accessLevel, setAccessLevel] = useState<AtlasAccessLevel>("auto")
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null)
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false)
  const [libraryAccessTab, setLibraryAccessTab] =
    useState<AnalysisTab>("overview")
  const [layerSettings, setLayerSettings] = useState<LayerId | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [perCapitaRefresh, setPerCapitaRefresh] = useState(0)
  const [perCapitaGeometryError, setPerCapitaGeometryError] = useState(false)
  const [mobileRouteLines, setMobileRouteLines] = useState(true)
  const [mobileOpacity, setMobileOpacity] = useState(1)
  const [plansOpen, setPlansOpen] = useState(false)
  const [replaced, setReplaced] = useState<{
    removed: LayerId
    added: LayerId
    prev: LayerId[]
  } | null>(null)
  const [hintDismissed, setHintDismissed] = useState(true)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [sheet, setSheet] = useState<SheetSize>("peek")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = parseUrlState(params)
    setQuery(params.get("q") ?? "")
    setInitialView(s.view)
    setFilters(s.filters)
    setLayers(s.layers)
    setAccessibility(s.accessibility ?? [])
    setAccessibilityView(s.accessibilityView ?? "matches")
    const mode = params.get("visits")
    if (mode === "today" || mode === "week" || mode === "live")
      setMobileMode(mode)
    setSelectedId(s.library)
    if (
      /^(?:[A-Z]{3}|[EWSN]\d{8})$/.test(
        params.get("accessArea") ?? params.get("countryComparison") ?? ""
      )
    )
      setSelectedCountry(
        params.get("accessArea") ?? params.get("countryComparison")
      )
    setAccessMetric(
      params.get("accessMetric") === "peoplePerLibrary"
        ? "peoplePerLibrary"
        : "per100k"
    )
    const areaLevel = params.get("accessAreas")
    setAccessLevel(
      areaLevel === "local" || areaLevel === "countries" ? areaLevel : "auto"
    )
    setAnalysisMode(
      params.get("analysis") === "accessibility"
        ? "accessibility"
        : s.layers.includes("perCapita")
          ? "libraryAccess"
          : s.layers.includes("access")
            ? "accessibility"
            : null
    )
    const shadingOpacity = Number(
      params.get("accessOpacity") ?? params.get("perCapitaOpacity") ?? "0.85"
    )
    if (Number.isFinite(shadingOpacity))
      setPerCapitaOpacity(Math.max(0.1, Math.min(0.9, shadingOpacity)))
    setList(s.list)
    setProjection(s.projection)
    setMobileRouteLines(params.get("routeLines") !== "0")
    const opacity = Number(params.get("mobileOpacity") ?? "1")
    if (Number.isFinite(opacity))
      setMobileOpacity(Math.max(0, Math.min(1, opacity)))
    if (activeFilterCount(s.filters) > 0) setTab("filter")
    else if (
      s.layers.some((layer) => layer !== "pins") ||
      params.get("analysis") === "accessibility"
    )
      setTab("layers")
    setRecent(readStorage<RecentItem[]>(RECENT_KEY, []))
    setHintDismissed(readStorage(HINT_KEY, false) || Boolean(s.view))
    setOnline(navigator.onLine)
    setHydrated(true)
  }, [])

  // Load every published library once.
  const load = useCallback(() => {
    if (scalable) return
    setLoadError(false)
    fetch("/api/public-proxy/api/libraries/atlas")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))

        return r.json()
      })
      .then((fc) => setAll(fromFeatureCollection(fc)))
      .catch(() => setLoadError(true))
  }, [scalable])
  useEffect(load, [load])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener("online", up)
    window.addEventListener("offline", down)

    return () => {
      clearInterval(tick)
      window.removeEventListener("online", up)
      window.removeEventListener("offline", down)
    }
  }, [])

  // Drop layers the viewer can't use (e.g. a Pro layer in a shared link).
  const usableLayers = useMemo(
    () =>
      withRequiredLibraryLocations(
        layers.filter((id) => layerAccess(layerDef(id), tier) === "available")
      ),
    [layers, tier]
  )
  const accessView = view ?? initialView
  const resolvedAccessLevel =
    accessLevel === "auto"
      ? accessView &&
        accessView.zoom >= 6 &&
        atlasLocalGeography.areas.some(
          ({ bounds }) =>
            accessView.lng >= bounds.west &&
            accessView.lng <= bounds.east &&
            accessView.lat >= bounds.south &&
            accessView.lat <= bounds.north
        )
        ? "local"
        : "countries"
      : accessLevel
  const perCapitaRequest = useMemo<AtlasQueryRequest | null>(
    () =>
      hydrated && usableLayers.includes("perCapita")
        ? {
            schemaVersion: 1,
            purpose: "libraryAccess",
            level: resolvedAccessLevel,
            scope: {
              filters: atlasBuildingFilters(filters),
              accessibility: {
                enabled: usableLayers.includes("access"),
                selected: accessibility,
                view: accessibilityView,
              },
            },
          }
        : null,
    [
      hydrated,
      usableLayers,
      filters,
      accessibility,
      accessibilityView,
      resolvedAccessLevel,
    ]
  )
  const perCapita = useAtlasRequest<AtlasLibraryAccessResponse>(
    perCapitaRequest,
    perCapitaRefresh
  )
  const retryPerCapita = () => {
    setPerCapitaGeometryError(false)
    setPerCapitaRefresh((n) => n + 1)
  }
  const perCapitaError = usableLayers.includes("perCapita")
    ? (perCapita.error ??
      (perCapitaGeometryError ? "Area geometry unavailable" : undefined))
    : undefined
  const selectCountry = (iso3: string) => {
    setSelectedCountry(iso3 || null)
    setSelectedId(null)
    setSelectedStop(null)
    setAnalysisMode("libraryAccess")
    setAnalysisCollapsed(false)
    if (isMobile) setSheet("half")
  }
  const mobiles = useMobileAtlas(
    view,
    usableLayers.includes("mobile") &&
      (!filters.types.length || filters.types.includes("mobile")),
    mobileMode,
    now,
    filters
  )
  const data = useAtlasData(
    scalable && hydrated,
    filters,
    usableLayers,
    accessibility,
    accessibilityView,
    view,
    query,
    selectedId,
    now
  )
  useEffect(() => {
    if (scalable && data.generation) setAll([])
  }, [scalable, data.generation])
  const resultCount = scalable
    ? (data.generation?.viewport.populations.listed?.exactTotal ?? 0)
    : null
  const worldCount = scalable ? data.counts?.exactTotal : undefined
  const fitResults = async (place?: Place["scope"]) => {
    try {
      const result = await data.fit(place)
      if (result.bounds) mapRef.current?.fitBounds(result.bounds)
    } catch {
      data.retry()
    }
  }

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !entitlementsReady) return
    const t = setTimeout(() => {
      const params = toUrlParams({
        view: view
          ? { lat: view.lat, lng: view.lng, zoom: view.zoom }
          : initialView,
        filters,
        layers: usableLayers,
        accessibility,
        accessibilityView,
        library: selectedId,
        list,
        projection,
      })
      params.set(
        "layers",
        usableLayers
          .map((layer) => (layer === "perCapita" ? "libraryAccess" : layer))
          .join(",")
      )
      if (query) params.set("q", query)
      if (mobileMode !== "any") params.set("visits", mobileMode)
      if (!mobileRouteLines) params.set("routeLines", "0")
      if (mobileOpacity !== 1)
        params.set("mobileOpacity", String(mobileOpacity))
      if (selectedCountry) params.set("accessArea", selectedCountry)
      if (perCapitaOpacity !== 0.85)
        params.set("accessOpacity", String(perCapitaOpacity))
      if (accessMetric !== "per100k") params.set("accessMetric", accessMetric)
      if (accessLevel !== "auto") params.set("accessAreas", accessLevel)
      if (analysisMode === "accessibility")
        params.set("analysis", "accessibility")
      const mobileQs = params.toString()
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${mobileQs ? `?${mobileQs}` : ""}`
      )
    }, 400)

    return () => clearTimeout(t)
  }, [
    hydrated,
    entitlementsReady,
    view,
    initialView,
    filters,
    usableLayers,
    selectedId,
    list,
    projection,
    query,
    mobileMode,
    accessibility,
    accessibilityView,
    mobileRouteLines,
    mobileOpacity,
    selectedCountry,
    perCapitaOpacity,
    accessMetric,
    accessLevel,
    analysisMode,
  ])

  // ── Derived data ──────────────────────────────────────────────────────────
  const libs = useMemo(() => all ?? [], [all])
  const filtered = useMemo(
    () => (scalable ? data.listed : applyFilters(libs, filters, now)),
    [libs, filters, now, scalable, data.listed]
  )
  const listed = useMemo(
    () =>
      scalable
        ? data.listed
        : usableLayers.includes("access")
          ? accessibilityLibraries(filtered, accessibility, accessibilityView)
          : filtered,
    [
      filtered,
      usableLayers,
      accessibility,
      accessibilityView,
      scalable,
      data.listed,
    ]
  )
  const closures = useMemo(
    () =>
      scalable
        ? data.closures
        : usableLayers.includes("closures")
          ? libs.filter((l) => l.status === "permanently_closed")
          : [],
    [libs, usableLayers, scalable, data.closures]
  )
  const inView = useMemo(
    () => (view ? listed.filter((l) => inBounds(l, view.bounds)) : listed),
    [listed, view]
  )
  const accessibilityCoverage = useMemo(
    () =>
      scalable
        ? (data.generation?.viewport.coverage ?? null)
        : all
          ? accessibilitySummary(
              view
                ? filtered.filter((l) => inBounds(l, view.bounds))
                : filtered,
              accessibility
            )
          : null,
    [all, filtered, view, accessibility, scalable, data.generation]
  )
  const groupsInView = useMemo(
    () =>
      scalable
        ? filters.types.length
          ? filters.types
          : TYPE_GROUPS.map((g) => g.key)
        : [...new Set(inView.map((l) => typeGroupOf(l.type)))],
    [inView, scalable, filters.types]
  )
  const places = useMemo(
    () => buildPlaces(libs.filter((l) => l.status !== "permanently_closed")),
    [libs]
  )
  const selected = useMemo(
    () =>
      scalable
        ? data.selected
        : (libs.find((l) => l.id === selectedId) ?? null),
    [libs, selectedId, scalable, data.selected]
  )
  const recentCameraId = useRef<string | null>(null)
  useEffect(() => {
    if (selected && recentCameraId.current === selected.id) {
      if (selected.mapped !== false)
        mapRef.current?.flyTo(selected.lat, selected.lng, 14)
      recentCameraId.current = null
    }
  }, [selected])
  const filterCount = activeFilterCount(filters)
  const suggestions = useMemo(
    () =>
      scalable
        ? (data.suggestions?.suggestions ?? []).map((s) => ({
            patch: s.patch,
            gain: s.exactTotal,
            label: s.patch.opening
              ? "Remove the opening time"
              : s.patch.types
                ? "Include all library types"
                : s.patch.operators
                  ? "Include all operators"
                  : s.patch.facilities
                    ? "Remove a feature filter"
                    : s.patch.founded === null
                      ? "Widen the year range"
                      : "Remove a filter",
          }))
        : all && filtered.length === 0 && filterCount > 0
          ? loosenSuggestions(libs, filters, now)
          : [],
    [
      all,
      filtered.length,
      filterCount,
      libs,
      filters,
      now,
      scalable,
      data.suggestions,
    ]
  )

  // A shared link may point at a library by slug rather than id.
  useEffect(() => {
    if (scalable) return
    if (!all || !selectedId || selected) return
    const bySlug = all.find((l) => l.slug === selectedId)
    setSelectedId(bySlug?.id ?? null)
  }, [all, selectedId, selected, scalable])

  // ── Actions ───────────────────────────────────────────────────────────────
  const remember = useCallback((item: RecentItem) => {
    setRecent((prev) => {
      const next = [
        item,
        ...prev.filter((r) => !(r.kind === item.kind && r.key === item.key)),
      ].slice(0, 5)
      writeStorage(RECENT_KEY, next)

      return next
    })
  }, [])

  const selectLibrary = useCallback(
    (lib: AtlasLibrary, fly = true) => {
      pushAnalyticsEvent("select_content", {
        interaction_source: "atlas_search",
        content_type: "library",
        library_document_id: lib.id,
      })
      setSelectedId(lib.id)
      setSelectedStop(null)
      setList(false)
      if (fly && lib.mapped !== false)
        mapRef.current?.flyTo(lib.lat, lib.lng, 14)
      remember({
        kind: "library",
        key: lib.id,
        label: lib.name,
        sub:
          lib.type === "Mobile"
            ? "Mobile library"
            : [lib.city, lib.region, lib.country].filter(Boolean).join(", "),
      })
      if (isMobile) setSheet("half")
    },
    [remember, isMobile]
  )

  const pickPlace = useCallback(
    (p: Place) => {
      pushAnalyticsEvent("atlas_action", {
        interaction_source: "atlas_search",
        action_type: "filter",
      })
      if (scalable && p.scope) void fitResults(p.scope)
      else mapRef.current?.fitTo(p.libraries)
      setQuery("")
      remember({ kind: "place", key: p.key, label: p.label, sub: p.sub })
      if (isMobile) setSheet("peek")
    },
    [remember, isMobile, scalable, data.world, view]
  )

  const onMapSelect = useCallback(
    (id: string | null) => {
      if (id)
        pushAnalyticsEvent("select_content", {
          interaction_source: "atlas_map",
          content_type: "library",
          library_document_id: id,
        })
      setSelectedId(id)
      setSelectedStop(null)
      if (id && isMobile) setSheet("half")
    },
    [isMobile]
  )
  const pickStop = useCallback(
    (stop: MobileStopHit, fly = true) => {
      pushAnalyticsEvent("mobile_service_action", {
        interaction_source: fly ? "atlas_search" : "atlas_map",
        action_type: "select_stop",
        content_id: stop.id,
        library_document_id: stop.library_document_id,
      })
      setSelectedId(null)
      setSelectedStop(stop)
      setList(false)
      setFilters((current) =>
        current.types.length && !current.types.includes("mobile")
          ? { ...current, types: [...current.types, "mobile"] }
          : current
      )
      setLayers((active) =>
        active.includes("mobile") ? active : [...active, "mobile"]
      )
      remember({
        kind: "stop",
        key: stop.id,
        label: stop.name,
        sub: `${stop.where} · ${stop.library_name}`,
        stop,
      })
      if (fly && stop._geo)
        mapRef.current?.flyTo(stop._geo.lat, stop._geo.lng, 14)
      if (isMobile) setSheet("half")
    },
    [isMobile, remember]
  )
  const stopList = usableLayers.includes("mobile") ? (
    <AtlasMobileStops
      stops={mobiles.stops}
      total={mobiles.total}
      zoomIn={mobiles.zoomIn}
      onPick={pickStop}
    />
  ) : null

  const onToggleLayer = useCallback(
    (id: LayerId) => {
      const { layers: next, replaced: removed } = toggleLayer(usableLayers, id)
      pushAnalyticsEvent("atlas_action", {
        interaction_source: "atlas_layers",
        action_type: next.includes(id) ? "layer_on" : "layer_off",
        layer_name: id,
      })
      setLayers(next)
      if ((id === "perCapita" || id === "access") && next.includes(id)) {
        setAnalysisMode(id === "access" ? "accessibility" : "libraryAccess")
        setAnalysisCollapsed(false)
        setSelectedId(null)
        setSelectedStop(null)
        setList(false)
        if (isMobile) setSheet("half")
      } else if (
        (analysisMode === "accessibility" &&
          !next.includes("access") &&
          (id === "access" || removed === "access")) ||
        (analysisMode === "libraryAccess" && !next.includes("perCapita"))
      ) {
        setAnalysisMode(null)
      }
      if (layerSettings && !next.includes(layerSettings)) setLayerSettings(null)

      setReplaced(removed ? { removed, added: id, prev: usableLayers } : null)
    },
    [usableLayers, isMobile, analysisMode, layerSettings]
  )

  const signInHref = useMemo(() => {
    if (typeof window === "undefined") return "/auth/signin"

    const params = new URLSearchParams(window.location.search)
    if (analysisMode === "accessibility")
      params.set("analysis", "accessibility")

    return `/auth/signin?callbackUrl=${encodeURIComponent(`${window.location.pathname}?${params}`)}`
    // Recompute when state that shapes the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters,
    usableLayers,
    selectedId,
    view,
    hydrated,
    accessibility,
    accessibilityView,
    analysisMode,
  ])

  const signIn = useCallback(() => {
    globalThis.location.href = signInHref
  }, [signInHref])

  const dismissHint = () => {
    setHintDismissed(true)
    writeStorage(HINT_KEY, true)
  }

  // ── Pieces shared by desktop and mobile ──────────────────────────────────
  const tabContent = (
    <>
      {usableLayers.includes("mobile") ? (
        <AtlasMobileFilters
          value={mobileMode}
          onChange={setMobileMode}
          total={mobiles.total}
        />
      ) : null}
      {usableLayers.includes("mobile") && mobiles.routesUnavailable ? (
        <p role="status" className="text-sm" style={{ color: T.ink.dim }}>
          Some road routes are unavailable. Their stops are still shown.
        </p>
      ) : null}
      {mobiles.error ? (
        <p role="status" className="text-sm">
          Mobile stops are unavailable. The library map is still available.
        </p>
      ) : null}
      {tab === "search" ? (
        <AtlasSearchTab
          query={query}
          onQuery={setQuery}
          libraries={listed}
          places={places}
          filters={filters}
          now={now}
          recent={recent}
          onPickStop={pickStop}
          mobileLive={mobiles.live}
          onMobilePreset={(mode) => {
            setMobileMode(mode)
            setLayers((active) =>
              active.includes("mobile") ? active : [...active, "mobile"]
            )
            setFilters((current) => ({ ...current, types: ["mobile"] }))
            setQuery("")
            setTab("layers")
          }}
          onPickLibrary={(l) => selectLibrary(l)}
          onPickPlace={pickPlace}
          onPreset={(patch) => {
            setFilters((f) => ({ ...f, ...patch }))
            setTab("filter")
          }}
          onGoLayers={() => setTab("layers")}
          contributePrompt={contributePrompt}
          serverResults={
            scalable
              ? { libraries: data.searchLibraries, places: data.places }
              : undefined
          }
          serverPresets={scalable ? (data.counts?.presets ?? []) : undefined}
          onPickRecent={
            scalable
              ? (item) => {
                  if (item.kind === "library") {
                    pushAnalyticsEvent("select_content", {
                      interaction_source: "atlas_recent",
                      content_type: "library",
                      library_document_id: item.key,
                    })
                    recentCameraId.current = item.key
                    setSelectedId(item.key)
                    setList(false)
                  } else {
                    const split = item.key.indexOf(":")
                    const level = item.key.slice(0, split) as
                      | "country"
                      | "region"
                      | "city"
                    if (["country", "region", "city"].includes(level))
                      void fitResults({ level, id: item.key.slice(split + 1) })
                  }
                }
              : undefined
          }
        />
      ) : null}
      {tab === "filter" && scalable && !data.counts ? (
        <p role="status" className="p-6">
          Loading filter counts…
        </p>
      ) : tab === "filter" ? (
        <AtlasFiltersTab
          filters={filters}
          onChange={(next) => {
            pushAnalyticsEvent("atlas_action", {
              interaction_source: "atlas_filters",
              action_type: "filter",
            })
            setFilters(next)
            if (
              next.types.includes("mobile") ||
              next.mobileFrequency?.length ||
              next.mobileSharesLive
            )
              setLayers((active) =>
                active.includes("mobile") ? active : [...active, "mobile"]
              )
          }}
          mobileEnabled={usableLayers.includes("mobile")}
          onEnableMobile={() => {
            setLayers((active) =>
              active.includes("mobile") ? active : [...active, "mobile"]
            )
            setFilters((current) =>
              current.types.length && !current.types.includes("mobile")
                ? { ...current, types: [...current.types, "mobile"] }
                : current
            )
          }}
          mobileCount={mobiles.total}
          mobileSharesLiveCount={mobiles.sharesLiveCount ?? 0}
          libraries={libs}
          matchCount={worldCount ?? filtered.length}
          serverCounts={scalable ? data.counts : undefined}
          onFacilitySearch={scalable ? data.onFacilitySearch : undefined}
          onMoreFacilities={scalable ? data.onMoreFacilities : undefined}
          now={now}
          onShowResults={() => {
            if (scalable) {
              void fitResults()
              if (isMobile) setSheet("peek")

              return
            }
            mapRef.current?.fitTo(listed)
            if (!listed.length && mobiles.stops[0]?._geo)
              mapRef.current?.flyTo(
                mobiles.stops[0]._geo.lat,
                mobiles.stops[0]._geo.lng,
                12
              )
            if (isMobile) setSheet("peek")
          }}
        />
      ) : null}
      {tab === "layers" ? (
        <AtlasLayersTab
          tier={tier}
          active={usableLayers}
          accessibilityAnalysisOpen={
            analysisMode === "accessibility" && !selectedId && !selectedStop
          }
          onAccessibilityAnalysis={() => {
            if (
              analysisMode === "accessibility" &&
              !selectedId &&
              !selectedStop
            ) {
              setAnalysisMode(null)

              return
            }
            setAnalysisMode("accessibility")
            setAnalysisCollapsed(false)
            setSelectedId(null)
            setSelectedStop(null)
            setList(false)
            if (isMobile) setSheet("half")
          }}
          onToggle={onToggleLayer}
          onClear={() => {
            setLayers([])
            setAnalysisMode(null)
            setLayerSettings(null)
          }}
          settings={layerSettings}
          onSettings={setLayerSettings}
          onEventsFilter={() => {
            setTab("filter")
            setCollapsed(false)
          }}
          heatOpacity={heatOpacity}
          onHeatOpacity={setHeatOpacity}
          mobileRouteLines={mobileRouteLines}
          onMobileRouteLines={setMobileRouteLines}
          mobileOpacity={mobileOpacity}
          onMobileOpacity={setMobileOpacity}
          onSignIn={signIn}
          onSeePlans={() => {
            pushAnalyticsEvent("upgrade_prompt", {
              interaction_source: "upgrade_prompt",
              action_type: "open",
            })
            setPlansOpen(true)
          }}
          perCapita={{
            metric: accessMetric,
            onMetric: setAccessMetric,
            level: accessLevel,
            onLevel: (level) => {
              setAccessLevel(level)
              setSelectedCountry(null)
            },
            resolvedLevel: resolvedAccessLevel,
            opacity: perCapitaOpacity,
            onOpacity: setPerCapitaOpacity,
            types: filters.types,
            onTypes: (types) =>
              setFilters((value) => ({
                ...value,
                types: types as AtlasFilters["types"],
              })),
            onAnalysis: () => {
              setList(false)
              if (isMobile) setSheet("half")
              setAnalysisMode("libraryAccess")
              setAnalysisCollapsed(false)
              setSelectedId(null)
              setSelectedStop(null)
              if (isMobile) setSheet("half")
            },
          }}
        />
      ) : null}
    </>
  )

  const tabs = (
    <div
      role="tablist"
      aria-label={tUi("explore")}
      className="flex flex-1 gap-1"
    >
      {(
        [
          ["search", tUi("search"), "search"],
          ["filter", tUi("filters"), "filter"],
          ["layers", "Layers", "layers"],
        ] as [Tab, string, IconName][]
      ).map(([key, label, icon]) => {
        const on = tab === key
        const badge =
          key === "filter"
            ? filterCount
            : key === "layers"
              ? usableLayers.length
              : 0

        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`atlas-tab-${key}`}
            aria-selected={on}
            aria-controls="atlas-tabpanel"
            onClick={() => setTab(key)}
            className="flex h-11 flex-1 items-center justify-center gap-[7px] rounded-full text-[15px] font-semibold"
            style={
              on
                ? {
                    background: "#fff",
                    color: T.ink.base,
                    boxShadow: `inset 0 0 0 1px ${T.border.hi}`,
                  }
                : { color: T.ink.dim }
            }
          >
            <Icon name={icon} size={17} />
            {label}
            {badge > 0 ? (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[12px] text-white"
                style={{ background: T.accent.primary }}
              >
                {badge}
                <span className="sr-only"> active</span>
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )

  const legends = (
    <AtlasLegends
      groups={groupsInView}
      layers={usableLayers}
      accessibility={accessibility}
      accessibilityView={accessibilityView}
      accessMetric={accessMetric}
    />
  )
  const accessibilityCountLabel = usableLayers.includes("access")
    ? accessibilityView === "matches"
      ? "confirmed matches"
      : accessibilityView === "gaps"
        ? "unconfirmed records"
        : "library records"
    : "libraries"
  const countSub = `${accessibilityCountLabel}${view ? " in view" : ""}${usableLayers.includes("mobile") ? ` · ${mobiles.total.toLocaleString()} stops${mobiles.zoomIn ? " · Zoom in" : ""}` : ""}`
  const center = view ?? { lat: 30, lng: 10 }

  // Notices about the data, shown over the map or inside the list.
  const hasDataNotice =
    !online ||
    loadError ||
    Boolean(data.error) ||
    mapError === "webgl" ||
    Boolean(perCapitaError)
  const dataNotices = hasDataNotice ? (
    <>
      {!online ? (
        <AtlasBanner
          tone="danger"
          title={tUi("youre_offline")}
          body={
            all
              ? `Showing ${(resultCount ?? listed.length).toLocaleString()} libraries loaded earlier. The basemap and new data need a connection.`
              : "The atlas needs a connection to load."
          }
        />
      ) : null}
      {loadError || data.error ? (
        <AtlasBanner
          tone="danger"
          title={tUi("we_couldnt_load_the_libraries")}
          body={data.error ?? "The map will fill in once they arrive."}
          action={{
            label: tUi("try_again"),
            onClick: scalable ? data.retry : load,
          }}
        />
      ) : null}
      {mapError === "webgl" ? (
        <AtlasBanner
          tone="info"
          title={tUi("this_browser_cant_draw_the_map")}
          body="It needs WebGL, which is turned off or unavailable here. Every library is still in the list."
        />
      ) : null}
      {perCapitaError ? (
        <AtlasBanner
          tone="danger"
          title={tUi("library_access_couldnt_load")}
          body={perCapitaError}
          action={{ label: tUi("try_again"), onClick: retryPerCapita }}
        />
      ) : null}
    </>
  ) : null

  // Over the map only: the list view shows dataNotices inline instead.
  const overlays = (
    <>
      {dataNotices}
      {!mapReady && !mapError ? (
        <AtlasLoading
          listReady={Boolean(all)}
          onOpenList={() => {
            pushAnalyticsEvent("atlas_action", {
              interaction_source: "atlas_toolbar",
              action_type: "view",
              view_mode: "list",
            })
            setList(true)
          }}
        />
      ) : null}
      {usableLayers.includes("access") &&
      accessibilityView === "matches" &&
      accessibilityCoverage &&
      accessibilityCoverage.total > 0 &&
      accessibilityCoverage.matches === 0 ? (
        <AtlasBanner
          tone="info"
          title={tUi("no_confirmed_matches_in_this_map_area")}
          body="Other libraries may offer these features; their records do not confirm them yet. Change the selection or compare the records."
          action={{
            label: "Compare records",
            onClick: () => setAccessibilityView("compare"),
          }}
        />
      ) : null}
      {mapError === "style" ? (
        <AtlasBanner
          tone="info"
          title="The basemap didn’t load."
          body="Library data is still available in the list view."
          action={{ label: "Open list", onClick: () => setList(true) }}
        />
      ) : null}
      {replaced ? (
        <AtlasToast
          onDismiss={() => setReplaced(null)}
          action={{
            label: tUi("undo"),
            onClick: () => {
              setLayers(replaced.prev)
              setReplaced(null)
            },
          }}
        >
          <Icon name="layers" size={16} color={T.accent.primary} />
          {layerDef(replaced.added).name} replaced{" "}
          {layerDef(replaced.removed).name}
        </AtlasToast>
      ) : null}
      {!hintDismissed && mapReady && projection === "globe" && !isMobile ? (
        <AtlasToast onDismiss={dismissHint}>
          <Icon name="globe" size={16} color={T.accent.primary} />
          Zoomed out, the map is a globe. It flattens as you zoom in.
        </AtlasToast>
      ) : null}
    </>
  )

  const map = hydrated ? (
    <AtlasMap
      ref={mapRef}
      className="absolute inset-0"
      libraries={listed}
      generation={scalable ? data.generation : undefined}
      onGeometryError={scalable ? data.onGeometryError : undefined}
      closures={closures}
      layers={usableLayers}
      accessibility={accessibility}
      accessibilityView={accessibilityView}
      heatOpacity={heatOpacity}
      perCapita={perCapitaGeometryError ? null : perCapita.value}
      perCapitaOpacity={perCapitaOpacity}
      selectedCountry={selectedCountry}
      onCountrySelect={(id) => {
        selectCountry(id)
        setLibraryAccessTab("explore")
      }}
      onPerCapitaGeometryError={() => setPerCapitaGeometryError(true)}
      selected={selected}
      hovered={hovered}
      projection={projection}
      initialView={initialView}
      mobileStops={mobiles.stops}
      mobileClusters={mobiles.clusters}
      mobileRoutes={mobiles.routes}
      mobileLive={mobiles.live}
      mobileZoomIn={mobiles.zoomIn}
      mobileRouteLines={mobileRouteLines}
      mobileOpacity={mobileOpacity}
      now={now}
      onStopSelect={(id) => {
        const stop = mobiles.stops.find((row) => row.id === id)
        if (stop) pickStop(stop, false)
      }}
      padding={{
        left: isMobile || collapsed ? 0 : LEFT_W + GAP,
        right: !isMobile && (selected || selectedStop) ? RIGHT_W + GAP : 0,
        bottom: isMobile ? 200 : 90,
      }}
      onSelect={onMapSelect}
      onView={setView}
      onReady={() => setMapReady(true)}
      onError={(reason) => {
        setMapError(reason)
        if (reason === "webgl") setList(true)
      }}
    />
  ) : null

  const noMatch =
    all &&
    (scalable ? worldCount === 0 : filtered.length === 0) &&
    mobiles.total === 0 &&
    filterCount > 0 ? (
      <AtlasNoMatch
        filterCount={filterCount}
        suggestions={suggestions}
        onApply={(s) => setFilters((f) => ({ ...f, ...s.patch }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />
    ) : null

  const showingAnalysis =
    (analysisMode === "accessibility" ||
      (analysisMode === "libraryAccess" &&
        usableLayers.includes("perCapita"))) &&
    !selected &&
    !selectedStop
  const analysis =
    analysisMode === "accessibility" ? (
      <AtlasAccessibilityAnalysis
        tier={tier}
        enabled={usableLayers.includes("access")}
        libraries={filtered}
        selected={accessibility}
        view={accessibilityView}
        coverage={accessibilityCoverage}
        scope={view ? "Records in view" : "Loaded records"}
        serverOptions={
          scalable ? (data.counts?.accessibility ?? []) : undefined
        }
        onSelected={setAccessibility}
        onView={setAccessibilityView}
        onEnable={() => onToggleLayer("access")}
        onSignIn={signIn}
        onList={() => {
          setList(true)
          if (isMobile) setSheet("full")
        }}
        onSeePlans={() => {
          pushAnalyticsEvent("upgrade_prompt", {
            interaction_source: "upgrade_prompt",
            action_type: "open",
          })
          setPlansOpen(true)
        }}
        optionsLoading={scalable && !data.counts}
        exportRequest={
          scalable
            ? {
                schemaVersion: 1,
                scope: {
                  ...data.scope,
                  accessibility: {
                    enabled: true,
                    selected: accessibility,
                    view: accessibilityView,
                  },
                },
                sort: "name",
                centre: center,
              }
            : undefined
        }
        exportLibraries={
          scalable
            ? []
            : accessibilityLibraries(
                view
                  ? filtered.filter((library) => inBounds(library, view.bounds))
                  : filtered,
                accessibility,
                accessibilityView
              )
        }
        collapsed={analysisCollapsed}
        onCollapse={() => setAnalysisCollapsed(!analysisCollapsed)}
        onClose={() => setAnalysisMode(null)}
      />
    ) : (
      <AtlasAccessAnalysis
        tab={libraryAccessTab}
        onTab={setLibraryAccessTab}
        viewBounds={view?.bounds}
        response={perCapita.value}
        metric={accessMetric}
        selected={selectedCountry}
        onSelect={selectCountry}
        onFit={(id) => {
          const bounds = perCapita.value?.areas.find(
            (area) => area.id === id
          )?.bounds
          if (bounds) mapRef.current?.fitBounds(bounds)
        }}
        onClose={() => setAnalysisMode(null)}
        onSettings={() => {
          setLayerSettings("perCapita")
          setTab("layers")
          setCollapsed(false)
          if (isMobile) {
            setAnalysisMode(null)
            setSheet("full")
          }
          requestAnimationFrame(() => {
            document
              .getElementById("atlas-layer-settings")
              ?.scrollIntoView({ block: "nearest" })
          })
        }}
        collapsed={analysisCollapsed}
        onCollapse={() => setAnalysisCollapsed(!analysisCollapsed)}
        error={perCapitaError}
        onRetry={retryPerCapita}
      />
    )

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    const heights: Record<SheetSize, string> = {
      peek: usableLayers.includes("access") ? "260px" : "188px",
      half: "52%",
      full: "calc(100% - 12px)",
    }
    const nextSize: Record<SheetSize, SheetSize> = {
      peek: "half",
      half: "full",
      full: "peek",
    }
    // A selected library needs more than the peek height.
    const size: SheetSize = list
      ? "full"
      : (selected || selectedStop || showingAnalysis) && sheet === "peek"
        ? "half"
        : sheet

    return (
      <div
        className="absolute inset-0 overflow-hidden"
        data-hide-footer="true"
        style={{ background: T.bg.void }}
      >
        {map}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2.5">
          <MapButtons
            onZoomIn={() => mapRef.current?.zoomBy(1)}
            onLocate={() => mapRef.current?.locate()}
          />
        </div>
        {list ? null : (
          <div className="pointer-events-none absolute inset-x-3 top-3 right-16 z-20 flex flex-col gap-2 [&>*]:pointer-events-auto">
            {overlays}
          </div>
        )}
        {noMatch && size === "peek" ? (
          <div className="absolute inset-x-3 top-1/4 z-20 flex justify-center">
            {noMatch}
          </div>
        ) : null}
        <section
          aria-label={tUi("explore_panel")}
          className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border-t bg-white transition-[height] motion-reduce:transition-none"
          style={{ height: heights[size], borderColor: T.border.hi }}
        >
          <button
            type="button"
            aria-label={`Panel size: ${size}. Change size`}
            onClick={() => setSheet(nextSize[sheet])}
            className="flex h-6 shrink-0 items-center justify-center"
          >
            <span
              className="h-[5px] w-10 rounded-full"
              style={{ background: "#BDB6AA" }}
            />
          </button>
          <div
            className={`min-h-0 flex-1 ${showingAnalysis && !list ? "flex flex-col overflow-hidden" : "overflow-auto"}`}
          >
            {list ? (
              <AtlasListView
                key={scalable ? JSON.stringify(data.scope) : "legacy"}
                remoteScope={scalable ? data.scope : undefined}
                compact
                notice={
                  <>
                    {dataNotices}
                    {stopList}
                    {usableLayers.includes("access") ? legends : null}
                  </>
                }
                libraries={inView}
                accessibility={
                  usableLayers.includes("access") ? accessibility : undefined
                }
                center={center}
                now={now}
                onHover={setHovered}
                onShowMap={() => {
                  pushAnalyticsEvent("atlas_action", {
                    interaction_source: "atlas_toolbar",
                    action_type: "view",
                    view_mode: "map",
                  })
                  setList(false)
                }}
                onSeePlans={() => {
                  pushAnalyticsEvent("upgrade_prompt", {
                    interaction_source: "upgrade_prompt",
                    action_type: "open",
                  })
                  setPlansOpen(true)
                }}
              />
            ) : selectedStop ? (
              <AtlasStopPanel
                key={selectedStop.id}
                stop={selectedStop}
                live={mobiles.live[selectedStop.library_document_id]}
                now={now}
                onClose={() => setSelectedStop(null)}
              />
            ) : selected ? (
              <AtlasLibraryPanel
                key={selected.id}
                compact
                library={selected}
                onClose={() => setSelectedId(null)}
              />
            ) : showingAnalysis ? (
              <div
                id="atlas-analysis-panel"
                className="flex min-h-0 flex-1 flex-col"
              >
                {analysis}
              </div>
            ) : size === "peek" ? (
              <div className="flex flex-col gap-3 px-4 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTab("search")
                    setSheet("half")
                  }}
                  className="flex h-12 items-center gap-2.5 rounded-[14px] border px-3.5 text-left text-[16px]"
                  style={{ borderColor: T.border.hi, color: T.ink.dim }}
                >
                  <Icon name="search" size={20} color={T.ink.base} />
                  {tUi("library_stop_or_place")}
                </button>
                <div className="flex items-center justify-between">
                  <AtlasCount
                    count={resultCount ?? inView.length}
                    sub={countSub}
                  />
                  <ViewToggle
                    list={list}
                    onChange={(next) => {
                      if (next !== list)
                        pushAnalyticsEvent("atlas_action", {
                          interaction_source: "atlas_toolbar",
                          action_type: "view",
                          view_mode: next ? "list" : "map",
                        })
                      setList(next)
                    }}
                  />
                </div>
                {usableLayers.includes("access") ? <div>{legends}</div> : null}
              </div>
            ) : (
              <>
                <div className="px-3 pb-2">{tabs}</div>
                <div
                  id="atlas-tabpanel"
                  role="tabpanel"
                  aria-labelledby={`atlas-tab-${tab}`}
                  className="px-4 pb-6"
                >
                  {tabContent}
                </div>
              </>
            )}
          </div>
          {feedbackPrompt ? (
            <div
              className="flex shrink-0 items-center justify-end border-t px-3"
              style={{ borderColor: T.border.divider }}
            >
              {feedbackPrompt}
            </div>
          ) : null}
        </section>
        {plansOpen ? (
          <AtlasPlansSheet
            tier={tier}
            signInHref={signInHref}
            onClose={() => setPlansOpen(false)}
          />
        ) : null}
      </div>
    )
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  const leftEdge = collapsed ? 72 + GAP * 2 : LEFT_W + GAP * 2
  const rightEdge =
    (selected || selectedStop || showingAnalysis) && !list
      ? RIGHT_W + GAP * 2
      : GAP

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-hide-footer="true"
      style={{ background: T.bg.void }}
    >
      {map}

      {collapsed ? (
        <nav
          aria-label={tUi("explore_panel")}
          className="absolute top-4 bottom-4 left-4 z-20 flex w-[72px] flex-col items-center gap-1.5 rounded-[22px] pt-3.5"
          style={PANEL_STYLE}
        >
          {(
            [
              ["search", tUi("search")],
              ["filter", tUi("filters")],
              ["layers", "Layers"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-label={`Open ${label}`}
              onClick={() => {
                setTab(key)
                setCollapsed(false)
              }}
              className="flex size-12 items-center justify-center rounded-[14px]"
              style={
                tab === key
                  ? { background: T.accent.chip, color: "#3730A3" }
                  : { color: T.ink.dim }
              }
            >
              <Icon name={key === "filter" ? "filter" : key} size={20} />
            </button>
          ))}
        </nav>
      ) : (
        <section
          aria-label={tUi("explore_panel")}
          className="absolute top-4 bottom-4 left-4 z-20 flex flex-col overflow-hidden rounded-[22px]"
          style={{ ...PANEL_STYLE, width: LEFT_W }}
        >
          <div
            className="flex items-center gap-1 border-b p-2.5"
            style={{ borderColor: T.border.divider, background: "#fff" }}
          >
            {tabs}
            <button
              type="button"
              aria-label={tUi("collapse_panel")}
              onClick={() => setCollapsed(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border"
              style={{ color: T.ink.base, borderColor: T.border.hi }}
            >
              <Icon name="chev" className="rotate-180" size={18} />
            </button>
          </div>
          <div
            id="atlas-tabpanel"
            role="tabpanel"
            aria-labelledby={`atlas-tab-${tab}`}
            className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pt-[18px] pb-4"
          >
            {tabContent}
          </div>
        </section>
      )}

      {showingAnalysis && !list ? (
        <aside
          id="atlas-analysis-panel"
          aria-label={
            analysisMode === "accessibility"
              ? "Accessibility analysis"
              : "Library access analysis"
          }
          className={`absolute top-4 right-4 z-20 flex flex-col overflow-hidden rounded-[22px] ${analysisCollapsed ? "" : "bottom-4"}`}
          style={{ ...PANEL_STYLE, width: RIGHT_W }}
        >
          {analysis}
        </aside>
      ) : null}
      {selectedStop && !list ? (
        <aside
          aria-label={tUi("selected_mobile_stop")}
          className="absolute top-4 right-4 bottom-4 z-20 overflow-auto rounded-[22px]"
          style={{ ...PANEL_STYLE, width: RIGHT_W }}
        >
          <AtlasStopPanel
            key={selectedStop.id}
            stop={selectedStop}
            live={mobiles.live[selectedStop.library_document_id]}
            now={now}
            onClose={() => setSelectedStop(null)}
          />
        </aside>
      ) : null}
      {selected && !list ? (
        <aside
          aria-label={tUi("selected_library")}
          className="absolute top-4 right-4 bottom-4 z-20 flex flex-col overflow-auto rounded-[22px]"
          style={{ ...PANEL_STYLE, width: RIGHT_W }}
        >
          <AtlasLibraryPanel
            key={selected.id}
            library={selected}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      ) : null}

      {!list ? (
        <div
          className="absolute top-4 z-20 flex flex-col items-end gap-2.5"
          style={{ right: rightEdge }}
        >
          <MapButtons
            onZoomIn={() => mapRef.current?.zoomBy(1)}
            onZoomOut={() => mapRef.current?.zoomBy(-1)}
            onLocate={() => mapRef.current?.locate()}
          />
          <div
            role="radiogroup"
            aria-label={tUi("projection")}
            className="flex flex-col gap-0.5 rounded-[14px] p-[3px]"
            style={PANEL_STYLE}
          >
            {(
              [
                ["flat", "2D"],
                ["globe", "Globe"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={projection === v}
                onClick={() => {
                  if (projection !== v)
                    pushAnalyticsEvent("atlas_action", {
                      interaction_source: "atlas_toolbar",
                      action_type: "projection",
                      view_mode: v,
                    })
                  setProjection(v)
                }}
                className="flex h-9 w-[62px] items-center justify-center rounded-[10px] text-[13px] font-bold"
                style={
                  projection === v
                    ? { background: T.accent.chip, color: "#3730A3" }
                    : { color: T.ink.dim }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {list ? null : (
        <div
          className="pointer-events-none absolute top-4 z-20 flex max-w-[560px] flex-col items-start gap-2 [&>*]:pointer-events-auto"
          style={{ left: leftEdge, right: rightEdge + 90 }}
        >
          {overlays}
        </div>
      )}

      {noMatch && !list ? (
        <div
          className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `calc(${leftEdge}px + (100% - ${leftEdge + rightEdge}px) / 2)`,
          }}
        >
          {noMatch}
        </div>
      ) : null}

      {list ? (
        <div
          className="absolute top-4 bottom-4 z-20 flex flex-col overflow-hidden rounded-[22px]"
          style={{ ...PANEL_STYLE, left: leftEdge, right: GAP }}
        >
          <div className="min-h-0 flex-1">
            <AtlasListView
              key={scalable ? JSON.stringify(data.scope) : "legacy"}
              remoteScope={scalable ? data.scope : undefined}
              notice={
                <>
                  {dataNotices}
                  {stopList}
                  {usableLayers.includes("access") ? legends : null}
                </>
              }
              libraries={inView}
              accessibility={
                usableLayers.includes("access") ? accessibility : undefined
              }
              center={center}
              now={now}
              onHover={setHovered}
              onShowMap={() => {
                pushAnalyticsEvent("atlas_action", {
                  interaction_source: "atlas_toolbar",
                  action_type: "view",
                  view_mode: "map",
                })
                setList(false)
              }}
              onSeePlans={() => {
                pushAnalyticsEvent("upgrade_prompt", {
                  interaction_source: "upgrade_prompt",
                  action_type: "open",
                })
                setPlansOpen(true)
              }}
            />
          </div>
          {feedbackPrompt ? (
            <div
              className="flex shrink-0 items-center justify-end border-t px-3 py-2"
              style={{ borderColor: T.border.divider }}
            >
              {feedbackPrompt}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="absolute bottom-4 z-20 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] py-2.5 pr-3 pl-[18px]"
          style={{ ...PANEL_STYLE, left: leftEdge, right: rightEdge }}
        >
          <AtlasMapLegend
            layers={usableLayers}
            metric={accessMetric}
            accessibilityView={accessibilityView}
          >
            {legends}
          </AtlasMapLegend>
          <span
            className="w-px self-stretch"
            style={{ background: T.border.divider }}
          />
          <AtlasCount count={resultCount ?? inView.length} sub={countSub} />
          <span className="flex-1" />
          {feedbackPrompt}
          <ViewToggle
            list={list}
            onChange={(next) => {
              if (next !== list)
                pushAnalyticsEvent("atlas_action", {
                  interaction_source: "atlas_toolbar",
                  action_type: "view",
                  view_mode: next ? "list" : "map",
                })
              setList(next)
            }}
          />
        </div>
      )}

      {plansOpen ? (
        <AtlasPlansSheet
          tier={tier}
          signInHref={signInHref}
          onClose={() => setPlansOpen(false)}
        />
      ) : null}
    </div>
  )
}

function MapButtons({
  onZoomIn,
  onZoomOut,
  onLocate,
}: {
  readonly onZoomIn: () => void
  readonly onZoomOut?: () => void
  readonly onLocate: () => void
}) {
  const tUi = useUiTranslations("ui")

  const btn = "flex size-11 items-center justify-center bg-white"

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[14px]"
      style={PANEL_STYLE}
    >
      <button
        type="button"
        aria-label={tUi("zoom_in")}
        onClick={onZoomIn}
        className={btn}
      >
        <Icon name="plus" size={20} />
      </button>
      {onZoomOut ? (
        <button
          type="button"
          aria-label={tUi("zoom_out")}
          onClick={onZoomOut}
          className={cn(btn, "border-t")}
          style={{ borderColor: T.border.divider }}
        >
          <Icon name="minus" size={20} />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={tUi("show_my_location")}
        onClick={onLocate}
        className={cn(btn, "border-t")}
        style={{ borderColor: T.border.divider }}
      >
        <Icon name="locate" size={20} />
      </button>
    </div>
  )
}

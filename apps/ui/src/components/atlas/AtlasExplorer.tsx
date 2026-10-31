"use client"

import {
  atlasLocalGeography,
  atlasDensityFromPoints,
  parseAtlasDensitySettings,
  DEFAULT_ATLAS_DENSITY,
  ATLAS_DENSITY_COLORS,
  ATLAS_LIST_SORTS,
  type AtlasSort,
  type AtlasDensitySettings,
  type AtlasDensitySelection,
  atlasNetworkReachLimit,
  atlasNetworkReachMode,
  type AtlasReachCapacity,
  type AtlasReachMinutes,
  atlasReachViewLimit,
  ATLAS_REACH_MIN_ZOOM,
  type AtlasAccessMetric,
  type AtlasAccessLevel,
  type AtlasLibraryAccessResponse,
  type AtlasQueryRequest,
  type AtlasPopulationLevel,
  type AtlasReachMode,
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
import { DashboardContextTransition } from "@/components/dashboard/DashboardRouteTransition"
import { SelectField } from "@/components/ds/SelectField"
import { useRouteUrlSyncGuard } from "@/hooks/useRouteUrlSyncGuard"
import { useEntitlements } from "@/lib/access-client"
import { pushAnalyticsEvent } from "@/lib/analytics-events"
import { DASHBOARD_SIDEBAR_WIDTH } from "@/lib/dashboard-layout"
import { T } from "@/lib/design-tokens"
import type { MobileStopHit, MobileVisitFilter } from "@/lib/mobile-stop-search"
import { cn } from "@/lib/styles"

import "./atlas-motion.css"

import {
  atlasAnalysisDrawers,
  type AtlasAnalysisMode as AnalysisMode,
} from "./atlas-analysis-panels"
import { atlasBuildingFilters, atlasViewportCamera } from "./atlas-query-input"
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
  AtlasContextAnalysis,
  useAtlasContextCatalogue,
  useAtlasContextPoint,
} from "./AtlasContext"
import {
  AtlasBanner,
  AtlasLoading,
  AtlasNoMatch,
  AtlasToast,
} from "./AtlasEdgeStates"
import { AtlasFiltersTab } from "./AtlasFiltersTab"
import {
  AtlasInspect,
  AtlasInspectTools,
  type AtlasInspectEntry,
} from "./AtlasInspect"
import { AtlasLayersTab, ABOUT } from "./AtlasLayersTab"
import { AtlasLibraryDensity } from "./AtlasLibraryDensity"
import { AtlasLibraryPanel } from "./AtlasLibraryPanel"
import { AtlasListView } from "./AtlasListView"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"
import { AtlasMap, type AtlasMapHandle, type AtlasView } from "./AtlasMap"
import { AtlasMobileFilters, AtlasMobileStops } from "./AtlasMobileStops"
import { useAtlasNetworkSelection } from "./AtlasNetworkPicker"
import { AtlasNetworkReach, useNetworkReach } from "./AtlasNetworkReach"
import { AtlasPerCapitaControls } from "./AtlasPerCapita"
import { AtlasPlansSheet } from "./AtlasPlansSheet"
import {
  AtlasPopulationDensityAnalysis,
  usePopulationDensity,
  type AtlasPopulationDetail,
} from "./AtlasPopulationDensity"
import { AtlasReachAnalysis, useAtlasReach } from "./AtlasReach"
import {
  AtlasSearchTab,
  buildPlaces,
  type Place,
  type RecentItem,
} from "./AtlasSearchTab"
import { AtlasStopPanel } from "./AtlasStopPanel"
import { useAtlasData, useAtlasRequest } from "./useAtlasData"
import { useAtlasDrawerSummaries } from "./useAtlasDrawerSummaries"
import { useAtlasMotion } from "./useAtlasMotion"
import { useMobileAtlas } from "./useMobileAtlas"

import panelStyles from "./AtlasAnalysisStack.module.css"

type Tab = "search" | "filter" | "layers"
type SheetSize = "peek" | "half" | "full"

const LEFT_W = DASHBOARD_SIDEBAR_WIDTH

function populationCoverageBounds(level: AtlasPopulationLevel) {
  if (level === "countries") return null
  const areas = atlasLocalGeography.areas.filter(
    (area) => level === "local" || area.code.startsWith("E")
  )
  if (!areas.length) return null

  return areas.reduce(
    (bounds, area) => ({
      west: Math.min(bounds.west, area.bounds.west),
      east: Math.max(bounds.east, area.bounds.east),
      south: Math.min(bounds.south, area.bounds.south),
      north: Math.max(bounds.north, area.bounds.north),
    }),
    { west: 180, east: -180, south: 90, north: -90 }
  )
}
const RIGHT_W = 360
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

function useIsMobile(
  root: { current: HTMLDivElement | null },
  maxWidth = 1023
): boolean {
  const query = `(max-width: ${maxWidth}px)`
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () =>
      setMobile(
        root.current?.clientWidth
          ? root.current.clientWidth <= maxWidth
          : mq.matches
      )
    update()
    mq.addEventListener("change", update)
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
    if (root.current) observer?.observe(root.current)

    return () => {
      mq.removeEventListener("change", update)
      observer?.disconnect()
    }
  }, [query, root, maxWidth])

  return mobile
}

function useTier(): {
  tier: Tier
  ready: boolean
  capacity: AtlasReachCapacity
  plan: ReturnType<typeof useEntitlements>["plan"]
} {
  const { plan, ready, analysisAreaMultiplier } = useEntitlements()

  return {
    tier: tierForPlan(plan),
    ready,
    capacity: analysisAreaMultiplier,
    plan,
  }
}

function setAnalysisUrlParams(
  params: URLSearchParams,
  layers: LayerId[],
  population: {
    level: AtlasPopulationDetail
    opacity: number
    country: string
  },
  reach: { mode: AtlasReachMode; minutes: number }
) {
  if (layers.includes("population") && population.level !== "auto")
    params.set("populationAreas", population.level)
  if (layers.includes("population") && population.opacity !== 0.7)
    params.set("populationOpacity", String(population.opacity))
  if (layers.includes("population") && population.country !== "GB")
    params.set("populationCountry", population.country)
  if (layers.includes("reach")) {
    params.set("reachMode", reach.mode)
    params.set("reachMinutes", String(reach.minutes))
  }
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
  const tContext = useUiTranslations("atlasContext")
  const tNetwork = useUiTranslations("atlasNetwork")
  const tDrawers = useUiTranslations("atlasDrawers")
  const tInspect = useUiTranslations("atlasInspect")
  const tList = useUiTranslations("atlasList")

  const mapRef = useRef<AtlasMapHandle>(null)
  const recentCameraId = useRef<string | null>(null)
  const analysisRoot = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile(analysisRoot)
  const narrow = useIsMobile(analysisRoot, 1439)
  const animateAtlas = useAtlasMotion()
  const { tier, ready: entitlementsReady, capacity, plan } = useTier()

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
  const [listSort, setListSort] = useState<AtlasSort>("name")
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
  const [userCollapsed, setUserCollapsed] = useState(false)
  const [query, setQuery] = useState("")
  const [hovered, setHovered] = useState<AtlasLibrary | null>(null)
  const [heatOpacity, setHeatOpacity] = useState(0.7)
  const [densitySettings, setDensitySettings] = useState<AtlasDensitySettings>(
    DEFAULT_ATLAS_DENSITY
  )
  const [densitySelection, setDensitySelection] = useState<{
    cell: AtlasDensitySelection
    data: string
  } | null>(null)
  const tDensity = useUiTranslations("atlasDensity")
  const [perCapitaOpacity, setPerCapitaOpacity] = useState(0.85)
  const [populationLevel, setPopulationLevel] =
    useState<AtlasPopulationDetail>("auto")
  const [populationCountry, setPopulationCountry] = useState("GB")
  const [contextReleaseId, setContextReleaseId] = useState("")
  const [contextOpacity, setContextOpacity] = useState(0.7)
  const [contextFailure, setContextFailure] = useState<string | null>(null)
  const contextFocus = useRef(false)
  const [contextLocation, setContextLocation] = useState<{
    lng: number
    lat: number
  } | null>(null)
  const [populationOpacity, setPopulationOpacity] = useState(0.7)
  const networkSelection = useAtlasNetworkSelection(filters.networks?.[0] ?? "")
  const [reachScope, setReachScope] = useState<"library" | "network">("library")
  const [networkGaps, setNetworkGaps] = useState(false)
  const [reachMode, setReachMode] = useState<AtlasReachMode>("walking")
  const [reachMinutes, setReachMinutes] = useState(15)
  const [reachOpacity, setReachOpacity] = useState(0.7)
  const [accessMetric, setAccessMetric] = useState<AtlasAccessMetric>("per100k")
  const [accessLevel, setAccessLevel] = useState<AtlasAccessLevel>("auto")
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null)
  const [inspectTarget, setInspectTarget] = useState<
    "library" | "stop" | "mobile" | "density" | "events" | null
  >(null)
  const [inspectMinimised, setInspectMinimised] = useState(false)
  const [mobileSurface, setMobileSurface] = useState<"explore" | "inspect">(
    "explore"
  )
  const listLibraryOpen =
    list &&
    Boolean(selectedId) &&
    inspectTarget === "library" &&
    !inspectMinimised
  const listReturnFocus = useRef<HTMLButtonElement | null>(null)
  const [leftPinned, setLeftPinned] = useState(false)
  const [undoLayers, setUndoLayers] = useState<{
    layers: LayerId[]
    mode: AnalysisMode | null
    target: typeof inspectTarget
    message: string
  } | null>(null)
  const [locateFailed, setLocateFailed] = useState(false)
  const [askReachScope, setAskReachScope] = useState(false)
  const collapsed =
    userCollapsed ||
    ((narrow || listLibraryOpen) &&
      !leftPinned &&
      !inspectMinimised &&
      (!list || listLibraryOpen) &&
      Boolean(analysisMode || inspectTarget || selectedId || selectedStop))
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
    setDensitySettings(parseAtlasDensitySettings(params))
    setInitialView(s.view)
    setFilters(s.filters)
    setLayers(s.layers)
    setAccessibility(s.accessibility ?? [])
    setAccessibilityView(s.accessibilityView ?? "matches")
    const mode = params.get("visits")
    if (["today", "week", "live"].includes(mode ?? ""))
      setMobileMode(mode as MobileVisitFilter)
    setSelectedId(s.library)
    const inspect = params.get("inspect")
    if (["library", "mobile", "density", "events"].includes(inspect ?? ""))
      setInspectTarget(inspect as "library" | "mobile" | "density" | "events")
    else if (s.library && !params.get("analysis")) setInspectTarget("library")
    setInspectMinimised(params.get("inspectMin") === "1")
    if (
      s.library ||
      s.layers.some((layer) =>
        [
          "reach",
          "perCapita",
          "population",
          "deprivation",
          "carAccess",
          "access",
          "mobile",
          "density",
          "events",
        ].includes(layer)
      )
    )
      setMobileSurface("inspect")
    if (!s.view) recentCameraId.current = s.library
    const populationArea = params.get("populationArea")
    if (
      s.layers.includes("population") &&
      populationArea &&
      isPopulationArea(populationArea)
    )
      setSelectedCountry(populationArea)
    if (
      /^(?:[A-Z]{3}|[EWSN]\d{8})$/.test(
        params.get("accessArea") ?? params.get("countryComparison") ?? ""
      )
    )
      setSelectedCountry(
        params.get("accessArea") ?? params.get("countryComparison")
      )
    const settings = analysisUrlSettings(params)
    setAccessMetric(settings.accessMetric)
    setAccessLevel(settings.accessLevel)
    setReachScope(settings.reachScope)
    setReachMode(settings.reachMode)
    setReachMinutes(settings.reachMinutes)
    setPopulationLevel(settings.populationLevel)
    setPopulationCountry(settings.populationCountry)
    setContextReleaseId(settings.contextRelease)
    setPopulationOpacity(settings.populationOpacity)
    const initialDrawers = atlasAnalysisDrawers(
      s.layers.reduce<LayerId[]>(
        (active, id) => toggleLayer(active, id).layers,
        []
      ),
      params.get("analysis") === "accessibility" ? "accessibility" : null
    )
    setAnalysisMode(
      initialAnalysisSelection(
        initialDrawers,
        params.get("analysis"),
        s.library,
        s.layers.includes("reach")
      )
    )
    const shadingOpacity = Number(
      params.get("accessOpacity") ?? params.get("perCapitaOpacity") ?? "0.85"
    )
    if (Number.isFinite(shadingOpacity))
      setPerCapitaOpacity(Math.max(0.1, Math.min(0.9, shadingOpacity)))
    setList(s.list)
    const listOrder = params.get("listSort") as AtlasSort
    if (ATLAS_LIST_SORTS.includes(listOrder)) setListSort(listOrder)
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
        layers
          .filter((id) => layerAccess(layerDef(id), tier) === "available")
          .reduce<
            LayerId[]
          >((active, id) => (active.includes(id) ? active : toggleLayer(active, id).layers), [])
      ),
    [layers, tier]
  )
  const accessView = view ?? initialView
  const context = useAtlasContextCatalogue(
    hydrated &&
      usableLayers.some((id) =>
        ["population", "deprivation", "carAccess"].includes(id)
      )
  )
  const populationGrid =
    context.releases.find(
      (r) => r.theme === "population" && r.country === populationCountry
    ) ?? null
  const insidePopulation =
    accessView &&
    (populationCountry === "GB"
      ? accessView.lng >= -9 &&
        accessView.lng <= 3 &&
        accessView.lat >= 49 &&
        accessView.lat <= 61
      : context.releases.some(
          (r) =>
            r.theme === "administrative" &&
            r.country === populationCountry &&
            accessView.lng >= r.bounds.west &&
            accessView.lng <= r.bounds.east &&
            accessView.lat >= r.bounds.south &&
            accessView.lat <= r.bounds.north
        ))
  const resolvedPopulationLevel =
    populationLevel === "auto"
      ? insidePopulation && (accessView?.zoom ?? 0) >= 9 && populationGrid
        ? "grid"
        : insidePopulation && (accessView?.zoom ?? 0) >= 6
          ? "local"
          : "countries"
      : populationLevel
  const contextTheme = usableLayers.includes("deprivation")
    ? "deprivation"
    : usableLayers.includes("carAccess")
      ? "carAccess"
      : usableLayers.includes("population") &&
          resolvedPopulationLevel === "grid"
        ? "population"
        : null
  const contextChoices = context.releases.filter(
    (r) => r.theme === contextTheme
  )
  const previousContextCountry = context.releases.find(
    (r) => r.id === contextReleaseId
  )?.country
  const contextRelease =
    contextTheme === "population"
      ? populationGrid
      : (contextChoices.find((r) => r.id === contextReleaseId) ??
        contextChoices.find((r) => r.country === previousContextCountry) ??
        contextChoices[0] ??
        null)
  const contextPoint = useAtlasContextPoint(contextRelease, contextLocation)
  useEffect(() => {
    if (
      contextFocus.current &&
      mapReady &&
      contextRelease &&
      contextTheme !== "population"
    ) {
      contextFocus.current = false
      mapRef.current?.fitBounds(contextRelease.bounds)
    }
  }, [contextRelease, mapReady, contextTheme])
  const contextFailed = Boolean(
    contextFailure && contextFailure === contextRelease?.id
  )
  const retryContext = () => {
    setContextFailure(null)
    context.retry()
  }
  const population = usePopulationDensity(
    hydrated &&
      usableLayers.includes("population") &&
      resolvedPopulationLevel !== "grid",
    resolvedPopulationLevel === "grid" ? "local" : resolvedPopulationLevel,
    populationCountry
  )
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
    setInspectTarget(null)
    setInspectMinimised(false)
    setMobileSurface("inspect")
    setAnalysisMode(
      usableLayers.includes("population") ? "population" : "libraryAccess"
    )

    if (isMobile) setSheet((current) => (current === "peek" ? "half" : current))
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
    now,
    densitySettings
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
  const canSyncUrl = useRouteUrlSyncGuard()
  useEffect(() => {
    if (!hydrated || !entitlementsReady) return
    const t = setTimeout(() => {
      if (!canSyncUrl()) return
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
      setUrlValue(
        params,
        "densityView",
        densitySettings.view,
        DEFAULT_ATLAS_DENSITY.view
      )
      setUrlValue(params, "densityDetail", densitySettings.detail, "auto")
      setUrlValue(params, "listSort", listSort, "name")
      setUrlValue(params, "densityScale", densitySettings.scale, "fixed")
      setUrlValue(
        params,
        "densityOpacity",
        densitySettings.opacity,
        DEFAULT_ATLAS_DENSITY.opacity
      )
      setUrlValue(
        params,
        "densitySmoothing",
        densitySettings.smoothing,
        DEFAULT_ATLAS_DENSITY.smoothing
      )
      if (query) params.set("q", query)
      if (mobileMode !== "any") params.set("visits", mobileMode)
      setUrlValue(params, "routeLines", mobileRouteLines ? "1" : "0", "1")
      setUrlValue(params, "mobileOpacity", mobileOpacity, 1)
      if (selectedCountry)
        params.set(
          usableLayers.includes("population") ? "populationArea" : "accessArea",
          selectedCountry
        )
      setUrlValue(params, "accessOpacity", perCapitaOpacity, 0.85)
      setUrlValue(params, "accessMetric", accessMetric, "per100k")
      setUrlValue(params, "accessAreas", accessLevel, "auto")
      setAnalysisUrlParams(
        params,
        usableLayers,
        {
          level: populationLevel,
          opacity: populationOpacity,
          country: populationCountry,
        },
        { mode: reachMode, minutes: reachMinutes }
      )
      if (reachScope === "network") params.set("reachScope", "network")
      if (contextReleaseId) params.set("contextRelease", contextReleaseId)
      if (analysisMode) params.set("analysis", analysisMode)
      if (inspectTarget) params.set("inspect", inspectTarget)
      if (inspectMinimised) params.set("inspectMin", "1")
      const mobileQs = params.toString()
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${mobileQs ? `?${mobileQs}` : ""}`
      )
    }, 400)

    return () => clearTimeout(t)
  }, [
    canSyncUrl,
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
    densitySettings,
    listSort,
    selectedCountry,
    perCapitaOpacity,
    accessMetric,
    accessLevel,
    populationLevel,
    populationOpacity,
    populationCountry,
    contextReleaseId,
    reachMode,
    reachMinutes,
    reachScope,
    analysisMode,
    inspectTarget,
    inspectMinimised,
  ])

  // ── Derived data ──────────────────────────────────────────────────────────
  const libs = useMemo(() => all ?? [], [all])
  const networkLibraries = useMemo(
    () =>
      filters.networks?.length
        ? libs.filter((library) =>
            filters.networks!.some((id) => library.networkIds?.includes(id))
          )
        : libs,
    [libs, filters.networks]
  )
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
  const densityData = useMemo(() => {
    if (!usableLayers.includes("density")) return null
    if (scalable) return data.generation?.viewport.libraryDensity ?? null
    if (!all) return null
    const camera = atlasViewportCamera(view)

    return atlasDensityFromPoints(
      listed
        .filter((library) => library.mapped !== false)
        .map((library) => ({ lat: library.lat, lng: library.lng })),
      camera.bbox,
      camera.zoom,
      densitySettings.detail
    )
  }, [
    usableLayers,
    scalable,
    data.generation,
    all,
    listed,
    view,
    densitySettings.detail,
  ])
  const densitySelectionKey = scalable
    ? `${data.generation?.viewport.fingerprint}:${data.generation?.viewport.indexedThrough}:${densityData?.resolution}`
    : JSON.stringify([
        filters,
        accessibility,
        accessibilityView,
        view,
        densityData?.resolution,
      ])
  const selectedDensityCell =
    densitySelection?.data === densitySelectionKey
      ? densitySelection.cell
      : null

  const closures = useMemo(
    () =>
      scalable
        ? data.closures
        : usableLayers.includes("closures")
          ? networkLibraries.filter((l) => l.status === "permanently_closed")
          : [],
    [networkLibraries, usableLayers, scalable, data.closures]
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
    () =>
      buildPlaces(
        networkLibraries.filter((l) => l.status !== "permanently_closed")
      ),
    [networkLibraries]
  )
  const selected = useMemo(
    () =>
      scalable
        ? data.selected
        : (libs.find((l) => l.id === selectedId) ?? null),
    [libs, selectedId, scalable, data.selected]
  )
  const reachViewLimit = atlasReachViewLimit(
    view?.zoom,
    scalable
      ? (data.generation?.viewport.populations.listed?.exactTotal ?? null)
      : inView.length
  )
  const serviceReachLimit = networkSelection.selected?.available
    ? atlasNetworkReachLimit(networkSelection.selected, capacity)
    : null
  const networkReachLimit = serviceReachLimit
  const networkSingleTime = networkSelection.selected?.available
    ? atlasNetworkReachMode(networkSelection.selected, capacity) === "single"
    : false
  const zoomToLocalReach = () => {
    const bounds =
      reachScope === "network" ? networkSelection.selected?.bounds : null
    mapRef.current?.flyTo(
      bounds
        ? (bounds.south + bounds.north) / 2
        : (selected?.lat ?? view?.lat ?? 0),
      bounds
        ? (bounds.west + bounds.east) / 2
        : (selected?.lng ?? view?.lng ?? 0),
      Math.max(ATLAS_REACH_MIN_ZOOM, (view?.zoom ?? 0) + 1)
    )
  }
  const libraryReach = useAtlasReach(
    hydrated &&
      usableLayers.includes("reach") &&
      reachScope === "library" &&
      !reachViewLimit,
    selected?.id ?? null,
    reachMode,
    JSON.stringify([
      selected?.lat,
      selected?.lng,
      selected?.status,
      selected?.type,
    ])
  )
  useEffect(() => {
    if (mapReady && networkSelection.selected?.bounds)
      mapRef.current?.fitBounds(networkSelection.selected.bounds)
  }, [mapReady, networkSelection.selected])
  const networkDraft = useMemo(
    () =>
      filters.networks?.[0] && networkSelection.selected?.available
        ? {
            schemaVersion: 1 as const,
            networkId: filters.networks[0],
            ...(networkSelection.selected.areaCodes.length === 1
              ? { areaCode: networkSelection.selected.areaCodes[0] }
              : {}),
            mode: reachMode,
            ...(networkSingleTime
              ? { minutes: reachMinutes as AtlasReachMinutes }
              : {}),
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
      filters,
      networkSelection.selected,
      networkSingleTime,
      reachMinutes,
      reachMode,
      usableLayers,
      accessibility,
      accessibilityView,
    ]
  )
  const networkReach = useNetworkReach(
    networkDraft,
    hydrated &&
      networkDraft !== null &&
      usableLayers.includes("reach") &&
      reachScope === "network" &&
      !networkReachLimit
  )
  const networkDisplayResult = useMemo(
    () =>
      networkReach.result?.state === "ready" && networkGaps
        ? {
            ...networkReach.result,
            displayGaps: true,
            contours: networkReach.result.contours.map((band) => ({
              ...band,
              empty: !band.gapGeometry,
              geometry: band.gapGeometry ?? band.geometry,
            })),
          }
        : networkReach.result,
    [networkReach.result, networkGaps]
  )
  const reach =
    reachScope === "network"
      ? { ...libraryReach, result: networkDisplayResult }
      : libraryReach
  const reachEnabled = usableLayers.includes("reach")
  useEffect(() => {
    if (!reachEnabled) return
    const nations: Record<string, string> = {
      E: "GB-ENG",
      W: "GB-WLS",
      S: "GB-SCT",
      N: "GB-NIR",
      England: "GB-ENG",
      Wales: "GB-WLS",
      Scotland: "GB-SCT",
      "Northern Ireland": "GB-NIR",
    }
    const prefixes = new Set(
      networkSelection.selected?.areaCodes.map((code) => code[0])
    )
    const nation =
      reachScope === "network"
        ? prefixes.size === 1
          ? nations[[...prefixes][0]!]
          : null
        : nations[selected?.country ?? ""]
    if (!nation) return
    const matching = context.releases.find(
      (r) => r.theme === contextTheme && r.country === nation
    )
    if (matching) {
      setContextReleaseId(matching.id)
      setContextLocation(null)
    }
    if (usableLayers.includes("population")) setPopulationCountry("GB")
    // Match the background when the service changes. A later explicit nation
    // choice remains available for comparing neighbouring areas.
  }, [
    reachEnabled,
    reachScope,
    networkSelection.selected,
    selected?.id,
    selected?.country,
    contextTheme,
    context.releases,
    usableLayers,
  ])
  useEffect(() => {
    if (!mapReady || reachScope === "network") return
    const geometry = reach.result?.contours.find(
      (contour) => contour.minutes === reachMinutes
    )?.geometry
    if (!geometry) return
    const positions =
      geometry.type === "Polygon"
        ? geometry.coordinates.flat()
        : geometry.coordinates.flatMap((polygon) => polygon.flat())
    const bounds = { west: 180, east: -180, south: 90, north: -90 }
    for (const [lng, lat] of positions) {
      bounds.west = Math.min(bounds.west, lng)
      bounds.east = Math.max(bounds.east, lng)
      bounds.south = Math.min(bounds.south, lat)
      bounds.north = Math.max(bounds.north, lat)
    }
    mapRef.current?.fitBounds(bounds, ATLAS_REACH_MIN_ZOOM)
  }, [reach.result, reachMinutes, mapReady, isMobile, reachScope])
  useEffect(() => {
    if (mapReady && selected && recentCameraId.current === selected.id) {
      if (
        selected.mapped !== false &&
        !(usableLayers.includes("reach") && reach.result)
      )
        mapRef.current?.flyTo(selected.lat, selected.lng, 14)
      recentCameraId.current = null
    }
  }, [selected, mapReady, usableLayers, reach.result])
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
      setAskReachScope(false)
      setInspectTarget("library")
      setInspectMinimised(false)
      setMobileSurface("inspect")

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
      if (isMobile)
        setSheet((current) => (current === "peek" ? "half" : current))
    },
    [remember, isMobile]
  )

  const restoreListFocus = () =>
    requestAnimationFrame(() => {
      const trigger = listReturnFocus.current
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      else
        analysisRoot.current
          ?.querySelector<HTMLButtonElement>("[data-atlas-list-library]")
          ?.focus({ preventScroll: true })
    })
  const selectListLibrary = (
    library: AtlasLibrary,
    trigger: HTMLButtonElement | null
  ) => {
    listReturnFocus.current = trigger
    pushAnalyticsEvent("select_content", {
      interaction_source: "atlas_list",
      content_type: "library",
      library_document_id: library.id,
    })
    setSelectedId(library.id)
    setSelectedStop(null)
    setAskReachScope(false)
    setInspectTarget("library")
    setInspectMinimised(false)
    setMobileSurface("inspect")
    setLeftPinned(false)
  }
  const closeLibrary = () => {
    setSelectedId(null)
    setAskReachScope(false)
    if (inspectTarget === "library") setInspectTarget(null)
    if (list) {
      setMobileSurface("explore")
      restoreListFocus()
    }
  }

  useEffect(() => {
    if (!listLibraryOpen) return
    const frame = requestAnimationFrame(() =>
      analysisRoot.current
        ?.querySelector<HTMLHeadingElement>("#atlas-analysis-panel h2")
        ?.focus({ preventScroll: true })
    )

    return () => cancelAnimationFrame(frame)
  }, [listLibraryOpen, selectedId, selected?.id])

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
      setAskReachScope(false)
      if (id) {
        setInspectTarget("library")
        setInspectMinimised(false)
        setMobileSurface("inspect")
      }
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
      setAskReachScope(false)
      setInspectTarget("stop")
      setInspectMinimised(false)
      setMobileSurface("inspect")
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
      if (isMobile)
        setSheet((current) => (current === "peek" ? "half" : current))
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
      if (
        (id === "deprivation" || id === "carAccess") &&
        next.includes(id) &&
        !next.includes("reach")
      )
        contextFocus.current = true
      pushAnalyticsEvent("atlas_action", {
        interaction_source: "atlas_layers",
        action_type: next.includes(id) ? "layer_on" : "layer_off",
        layer_name: id,
      })
      setLayers(next)
      const descriptor = atlasAnalysisDrawers(next).find(
        (drawer) => drawer.layer === id
      )
      if (
        next.includes(id) &&
        (descriptor || ["mobile", "density", "events"].includes(id))
      ) {
        if (descriptor) {
          setAnalysisMode(descriptor.mode)
          setInspectTarget(null)
        } else setInspectTarget(id as "mobile" | "density" | "events")
        setInspectMinimised(false)
        setMobileSurface("inspect")
        setLeftPinned(false)
        setList(false)
        if (isMobile)
          setSheet((current) => (current === "peek" ? "half" : current))
      } else if (
        !atlasAnalysisDrawers(next).some(({ mode }) => mode === analysisMode)
      ) {
        setAnalysisMode(atlasAnalysisDrawers(next)[0]?.mode ?? null)
      }
      if (layerSettings && !next.includes(layerSettings)) setLayerSettings(null)

      setReplaced(removed ? { removed, added: id, prev: usableLayers } : null)
    },
    [usableLayers, isMobile, analysisMode, layerSettings]
  )

  const closeAnalysis = () => {
    setInspectMinimised(true)
    setMobileSurface("explore")

    requestAnimationFrame(() =>
      analysisRoot.current?.focus({ preventScroll: true })
    )
  }

  const openReach = () => {
    if (reachScope === "network" && usableLayers.includes("reach")) {
      setAskReachScope(true)

      return
    }
    setAskReachScope(false)
    setInspectTarget(null)
    setInspectMinimised(false)
    setMobileSurface("inspect")
    setReachScope("library")
    if (layerAccess(layerDef("reach"), tier) !== "available") {
      setPlansOpen(true)

      return
    }
    if (!usableLayers.includes("reach")) onToggleLayer("reach")
    setAnalysisMode("reach")
    setInspectTarget(null)
    setInspectMinimised(false)
    setMobileSurface("inspect")

    setList(false)
    if (isMobile) setSheet((current) => (current === "peek" ? "half" : current))
  }
  const populationCountries = [
    { value: "GB", label: tUi("atlas_population_uk") },
    ...context.releases
      .filter((r) => r.theme === "administrative" && r.level === "local")
      .map((r) => ({ value: r.country, label: r.name })),
  ]
  const changePopulationCountry = (country: string) => {
    setPopulationCountry(country)
    setSelectedCountry(null)
    setContextLocation(null)
    if (populationLevel === "grid" && country !== "GB")
      setPopulationLevel("local")
    const bounds =
      country === "GB"
        ? populationCoverageBounds("local")
        : context.releases.find(
            (r) => r.theme === "administrative" && r.country === country
          )?.bounds
    if (bounds) mapRef.current?.fitBounds(bounds)
  }
  const changePopulationDetail = (level: AtlasPopulationDetail) => {
    setPopulationLevel(level)
    setSelectedCountry(null)
    setContextLocation(null)
    const bounds =
      level === "grid"
        ? populationGrid?.bounds
        : level === "local" || level === "regions"
          ? populationCountry === "GB"
            ? populationCoverageBounds(level)
            : context.releases.find(
                (r) =>
                  r.theme === "administrative" &&
                  r.country === populationCountry
              )?.bounds
          : null
    if (bounds) mapRef.current?.fitBounds(bounds)
  }
  const openContextReach = () => {
    if (layerAccess(layerDef("reach"), tier) !== "available") {
      setPlansOpen(true)

      return
    }
    if (!usableLayers.includes("reach")) onToggleLayer("reach")
    setAnalysisMode("reach")
    setInspectTarget(null)
    setInspectMinimised(false)
    setMobileSurface("inspect")

    setList(false)
    if (isMobile) setSheet((current) => (current === "peek" ? "half" : current))
  }
  const reachAnalysis = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {reachScope === "network" ? (
        <AtlasNetworkReach
          calculationLimit={networkReachLimit}
          singleTime={networkSingleTime}
          capacity={capacity}
          onZoomLocal={zoomToLocalReach}
          onSingleLibrary={() => setReachScope("library")}
          scopeControl={
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-(--t-ink-dim)">
                {tNetwork("reachScope")}
              </span>
              <SelectField
                label={tNetwork("reachScope")}
                value={reachScope}
                onValueChange={(value) =>
                  setReachScope(value as "library" | "network")
                }
                options={[
                  { value: "library", label: tNetwork("singleLibrary") },
                  { value: "network", label: tNetwork("networkScope") },
                ]}
              />
            </div>
          }
          opacity={reachOpacity}
          onOpacity={setReachOpacity}
          selection={networkSelection.selected}
          selectionLoading={networkSelection.loading}
          selectionError={networkSelection.error}
          retrySelection={networkSelection.retry}
          filterCount={
            Math.max(
              0,
              activeFilterCount(filters) - (filters.networks?.length ? 1 : 0)
            ) +
            (usableLayers.includes("access") && accessibilityView !== "compare"
              ? Math.max(1, accessibility.length)
              : 0)
          }
          onClearFilters={() => {
            setFilters((current) => ({
              ...EMPTY_FILTERS,
              networks: current.networks,
            }))
            setAccessibility([])
            setAccessibilityView("compare")
            networkReach.clear()
          }}
          networkId={filters.networks?.[0] ?? ""}
          onNetwork={(id) =>
            setFilters((current) => ({ ...current, networks: id ? [id] : [] }))
          }
          minutes={reachMinutes}
          onMinutes={setReachMinutes}
          mode={reachMode}
          onMode={setReachMode}
          gaps={networkGaps}
          onGaps={setNetworkGaps}
          response={networkReach.response}
          stale={networkReach.stale}
          calculate={networkReach.calculate}
          canExport={tier === "pro"}
        />
      ) : (
        <AtlasReachAnalysis
          calculationLimit={reachViewLimit}
          onZoomLocal={zoomToLocalReach}
          scopeControl={
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-(--t-ink-dim)">
                {tNetwork("reachScope")}
              </span>
              <SelectField
                label={tNetwork("reachScope")}
                value={reachScope}
                onValueChange={(value) =>
                  setReachScope(value as "library" | "network")
                }
                options={[
                  { value: "library", label: tNetwork("singleLibrary") },
                  { value: "network", label: tNetwork("networkScope") },
                ]}
              />
            </div>
          }
          library={selected}
          response={reach.response}
          error={reach.error}
          retry={reach.retry}
          mode={reachMode}
          onMode={setReachMode}
          minutes={reachMinutes}
          onMinutes={setReachMinutes}
          opacity={reachOpacity}
          onOpacity={setReachOpacity}
          canExport={tier === "pro"}
          collapsed={false}
          onCollapse={closeAnalysis}
          onClose={closeAnalysis}
        />
      )}
    </div>
  )

  const signInHref = useMemo(() => {
    if (typeof window === "undefined") return "/auth/signin"

    const params = new URLSearchParams(window.location.search)
    if (analysisMode) params.set("analysis", analysisMode)

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
  const drawerSummaries = useAtlasDrawerSummaries({
    reach: {
      scope: reachScope,
      libraryName: selected?.name,
      mode: reachMode,
      minutes: reachMinutes,
      result: libraryReach.result,
      state:
        reachScope === "network"
          ? networkReach.response?.state
          : libraryReach.response?.state,
      stale: reachScope === "network" && networkReach.stale,
    },
    network: {
      selection: networkSelection.selected,
      result: networkReach.result,
    },
    population: {
      grid: resolvedPopulationLevel === "grid" ? populationGrid : null,
      area: population.data?.areas.find(({ id }) => id === selectedCountry),
      level: resolvedPopulationLevel,
      country: populationCountry,
    },
    context: { release: contextRelease, point: contextPoint.value },
    accessibility: {
      selected: accessibility,
      coverage: accessibilityCoverage,
      inView: Boolean(view),
    },
    libraryAccess: {
      response: perCapita.value ?? null,
      selected: selectedCountry,
      metric: accessMetric,
    },
  })
  const openInspectLayer = (layer: LayerId) => {
    const drawer = atlasAnalysisDrawers([layer]).find(
      (entry) => entry.layer === layer
    )
    if (drawer) {
      setAnalysisMode(drawer.mode)
      setInspectTarget(null)
    } else if (["mobile", "density", "events"].includes(layer))
      setInspectTarget(layer as "mobile" | "density" | "events")
    setInspectMinimised(false)
    setMobileSurface("inspect")
    setLeftPinned(false)
    setList(false)
    if (isMobile) setSheet((current) => (current === "peek" ? "half" : current))
  }
  const layerSummaries: Partial<Record<LayerId, string>> = Object.fromEntries(
    atlasAnalysisDrawers(usableLayers).map(({ layer, mode }) => [
      layer,
      drawerSummaries[mode].detail,
    ])
  )

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
          onPickLibrary={(l) => animateAtlas(() => selectLibrary(l))}
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
          onAccessibility={() => {
            if (!usableLayers.includes("access")) onToggleLayer("access")
            openInspectLayer("access")
          }}
          networkSelection={networkSelection.selected}
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
          onInspect={(id) => openInspectLayer(id)}
          summaries={layerSummaries}
          accessibilityAnalysisOpen={
            analysisMode === "accessibility" && !selectedStop
          }
          onAccessibilityAnalysis={() => {
            if (analysisMode === "accessibility" && !selectedStop) {
              setAnalysisMode(null)

              return
            }
            setAnalysisMode("accessibility")
            setInspectTarget(null)
            setInspectMinimised(false)
            setMobileSurface("inspect")

            setList(false)
            if (isMobile)
              setSheet((current) => (current === "peek" ? "half" : current))
          }}
          onToggle={onToggleLayer}
          onClear={() => {
            setUndoLayers({
              layers: usableLayers,
              mode: analysisMode,
              target: inspectTarget,
              message: "All layers turned off",
            })
            setLayers([])
            setAnalysisMode(null)
            setLayerSettings(null)
          }}
          settings={layerSettings}
          onSettings={(id) => id && openInspectLayer(id)}
          onEventsFilter={() => {
            setTab("filter")
            setUserCollapsed(false)
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
              if (isMobile)
                setSheet((current) => (current === "peek" ? "half" : current))
              setAnalysisMode("libraryAccess")

              if (isMobile)
                setSheet((current) => (current === "peek" ? "half" : current))
            },
          }}
          population={{
            level: populationLevel,
            onLevel: (level) => {
              setPopulationLevel(level)
              setSelectedCountry(null)
              const bounds =
                level === "grid"
                  ? populationGrid?.bounds
                  : level === "auto"
                    ? null
                    : populationCountry === "GB"
                      ? populationCoverageBounds(level)
                      : context.releases.find(
                          (r) =>
                            r.country === populationCountry &&
                            r.theme === "administrative"
                        )?.bounds
              if (bounds) mapRef.current?.fitBounds(bounds)
            },
            country: populationCountry,
            countries: populationCountries,
            onCountry: changePopulationCountry,
            gridAvailable: Boolean(populationGrid),
            opacity: populationOpacity,
            onOpacity: setPopulationOpacity,
            onAnalysis: () => {
              setAnalysisMode("population")
              setInspectTarget(null)
              setInspectMinimised(false)
              setMobileSurface("inspect")

              setList(false)
              if (isMobile)
                setSheet((current) => (current === "peek" ? "half" : current))
            },
          }}
          onContextAnalysis={(id) => {
            setAnalysisMode(id)
            setInspectTarget(null)
            setInspectMinimised(false)
            setMobileSurface("inspect")

            setList(false)
            if (isMobile)
              setSheet((current) => (current === "peek" ? "half" : current))
          }}
        />
      ) : null}
    </>
  )

  const tabs = (
    <div
      role="tablist"
      aria-label={tUi("explore")}
      className="atlas-explore-tabs flex min-w-0 flex-1 gap-1 overflow-x-auto"
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
            onClick={() => animateAtlas(() => setTab(key))}
            className="flex min-h-11 flex-[1_0_auto] items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold whitespace-nowrap max-[350px]:gap-1 max-[350px]:px-1.5 max-[350px]:text-sm"
            style={
              on
                ? {
                    background: "var(--t-bg-deep)",
                    color: T.accent.primary,
                    boxShadow: `inset 0 0 0 1px ${T.border.hi}`,
                  }
                : { color: T.ink.dim }
            }
          >
            <Icon name={icon} size={16} />
            {label}
            {badge > 0 ? (
              <span
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs text-white tabular-nums"
                style={{ background: T.action.primary }}
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
      density={{ data: densityData, settings: densitySettings }}
      context={contextRelease}
      reach={{
        mode: reachMode,
        minutes: reachMinutes,
        gaps: networkGaps,
        state:
          reachScope === "network"
            ? networkReach.response?.state
            : libraryReach.response?.state,
        year:
          reachScope === "network"
            ? networkReach.result?.population.year
            : libraryReach.result?.population.year,
      }}
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
  const center = atlasViewportCamera(view).centre

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
              if (analysisMode) {
                const restoredDrawers = atlasAnalysisDrawers(replaced.prev)
                if (
                  !restoredDrawers.some(({ mode }) => mode === analysisMode)
                ) {
                  setAnalysisMode(restoredDrawers[0]?.mode ?? null)
                }
              }
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

  const analysisDrawers = atlasAnalysisDrawers(usableLayers, analysisMode)
  const showingAnalysis =
    !inspectTarget && analysisDrawers.some(({ mode }) => mode === analysisMode)
  const activeDrawer = showingAnalysis ? (analysisMode ?? "") : ""
  const hasDrawerNavigation =
    Boolean(
      analysisDrawers.length ||
      selectedId ||
      selectedStop ||
      usableLayers.some((id) => ["mobile", "density", "events"].includes(id))
    ) && !list
  const drawerOpen = hasDrawerNavigation && !inspectMinimised
  const mapRightEdge = drawerOpen
    ? RIGHT_W + GAP
    : hasDrawerNavigation
      ? 64 + GAP
      : GAP
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
      libraryDensity={densityData}
      densitySettings={densitySettings}
      densitySelection={selectedDensityCell}
      onDensitySelect={(cell) => {
        setDensitySelection({ cell, data: densitySelectionKey })
        setInspectTarget("density")
        setInspectMinimised(false)
        setMobileSurface("inspect")
        if (isMobile)
          setSheet((current) => (current === "peek" ? "half" : current))
      }}
      perCapita={perCapitaGeometryError ? null : perCapita.value}
      populationDensity={population.data}
      contextRelease={contextRelease}
      contextOpacity={
        contextTheme === "population" ? populationOpacity : contextOpacity
      }
      onContextError={() => setContextFailure(contextRelease?.id ?? null)}
      onContextPoint={(location) => {
        setContextLocation(location)
        setInspectTarget(null)
        setInspectMinimised(false)
        setMobileSurface("inspect")
        setAnalysisMode(
          contextTheme === "population" ? "population" : contextTheme
        )

        if (isMobile)
          setSheet((current) => (current === "peek" ? "half" : current))
      }}
      reach={reach.result}
      reachMinutes={reachMinutes}
      reachOpacity={reachOpacity}
      populationOpacity={populationOpacity}
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
        left: isMobile ? 0 : collapsed ? 72 : LEFT_W,
        right: isMobile
          ? 0
          : drawerOpen
            ? RIGHT_W
            : hasDrawerNavigation
              ? 64
              : 0,
        bottom: isMobile ? 200 : 90,
        bottomFraction:
          isMobile && (selected || selectedStop || showingAnalysis) ? 0.52 : 0,
      }}
      onSelect={(id) => animateAtlas(() => onMapSelect(id))}
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

  const renderAnalysis = (mode: AnalysisMode) => {
    switch (mode) {
      case "reach":
        return reachAnalysis
      case "deprivation":
      case "carAccess":
        return (
          <AtlasContextAnalysis
            key={`${mode}:${contextRelease?.id}`}
            theme={mode}
            releases={contextChoices}
            release={contextRelease}
            onRelease={(id) => {
              setContextReleaseId(id)
              setContextLocation(null)
              const release = contextChoices.find((r) => r.id === id)
              if (release) mapRef.current?.fitBounds(release.bounds)
            }}
            point={contextPoint.value}
            loading={context.loading || contextPoint.loading}
            error={Boolean(
              context.error || contextPoint.error || contextFailed
            )}
            retry={retryContext}
            onArea={(bounds) => {
              setContextLocation(null)
              mapRef.current?.fitBounds(bounds)
            }}
            opacity={contextOpacity}
            onOpacity={setContextOpacity}
            onClose={closeAnalysis}
            collapsed={false}
            onCollapse={closeAnalysis}
            reachActive={usableLayers.includes("reach")}
            onReach={openContextReach}
          />
        )
      case "population":
        return (
          <AtlasPopulationDensityAnalysis
            response={population.data}
            selected={selectedCountry}
            onSelect={(id) => {
              selectCountry(id)
              const bounds = population.data?.areas.find(
                (area) => area.id === id
              )?.bounds
              if (bounds) mapRef.current?.fitBounds(bounds)
            }}
            controls={{
              level: populationLevel,
              onLevel: changePopulationDetail,
              country: populationCountry,
              countries: populationCountries,
              onCountry: changePopulationCountry,
              gridAvailable: Boolean(populationGrid),
              opacity: populationOpacity,
              onOpacity: setPopulationOpacity,
              resolvedLabel:
                populationLevel === "auto"
                  ? tContext(automaticPopulationLabel(resolvedPopulationLevel))
                  : undefined,
            }}
            gridRelease={
              resolvedPopulationLevel === "grid" ? populationGrid : null
            }
            gridPoint={contextPoint.value}
            loading={
              resolvedPopulationLevel === "grid" &&
              (context.loading || contextPoint.loading)
            }
            error={populationAnalysisError({
              grid: resolvedPopulationLevel === "grid",
              contextError: Boolean(context.error || contextFailed),
              loading: context.loading,
              hasGrid: Boolean(populationGrid),
              error: population.error,
            })}
            retry={
              resolvedPopulationLevel === "grid"
                ? retryContext
                : population.retry
            }
            onReach={openContextReach}
            reachActive={usableLayers.includes("reach")}
            onClose={closeAnalysis}
            collapsed={false}
            onCollapse={closeAnalysis}
          />
        )
      case "accessibility":
        return (
          <AtlasAccessibilityAnalysis
            tier={tier}
            enabled={usableLayers.includes("access")}
            libraries={filtered}
            selected={accessibility}
            view={accessibilityView}
            coverage={accessibilityCoverage}
            scope={recordScopeLabel(Boolean(view))}
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
            exportLibraries={accessibilityExportLibraries(
              scalable,
              filtered,
              view,
              accessibility,
              accessibilityView
            )}
            collapsed={false}
            onCollapse={closeAnalysis}
            onClose={closeAnalysis}
          />
        )

      default:
        return (
          <AtlasAccessAnalysis
            tab={libraryAccessTab}
            onTab={setLibraryAccessTab}
            viewBounds={view?.bounds}
            response={perCapita.value}
            settings={
              <AtlasPerCapitaControls
                metric={accessMetric}
                onMetric={setAccessMetric}
                level={accessLevel}
                onLevel={(value) => {
                  setAccessLevel(value)
                  setSelectedCountry(null)
                }}
                resolvedLevel={resolvedAccessLevel}
                opacity={perCapitaOpacity}
                onOpacity={setPerCapitaOpacity}
                types={filters.types}
                onTypes={(types) =>
                  setFilters((value) => ({
                    ...value,
                    types: types as AtlasFilters["types"],
                  }))
                }
                onAnalysis={() => {}}
                showAnalysisLink={false}
                showOpacity={false}
              />
            }
            opacity={perCapitaOpacity}
            onOpacity={setPerCapitaOpacity}
            metric={accessMetric}
            selected={selectedCountry}
            onSelect={selectCountry}
            onFit={(id) => {
              const bounds = perCapita.value?.areas.find(
                (area) => area.id === id
              )?.bounds
              if (bounds) mapRef.current?.fitBounds(bounds)
            }}
            onClose={closeAnalysis}
            collapsed={false}
            onCollapse={closeAnalysis}
            error={perCapitaError}
            onRetry={retryPerCapita}
          />
        )
    }
  }

  const backToList = listLibraryOpen ? (
    <button
      type="button"
      onClick={closeLibrary}
      className="flex min-h-[40px] shrink-0 items-center gap-2 border-b border-(--t-border-line) px-5 py-2 text-left text-sm font-semibold text-(--t-accent-primary)"
    >
      <Icon name="chev" className="rotate-180" size={15} />
      {tList("backToList")}
    </button>
  ) : null
  const inspectEntries: AtlasInspectEntry[] = [
    ...(scalable && selectedId && !selected
      ? [
          {
            id: "library",
            label: "Library",
            title: "Selected library",
            detail: data.selectionLoading
              ? "Loading record…"
              : "Record unavailable",
            content: (
              <div className="flex min-h-0 flex-1 flex-col">
                {backToList}
                <div className="p-5">
                  {data.selectionLoading ? (
                    <AtlasLoadingSkeleton
                      label={tUi("loading_library_details")}
                      compact
                    />
                  ) : (
                    <div role="alert">
                      <p>
                        {data.selectionError ??
                          "The selected library is unavailable."}
                      </p>
                      <button
                        type="button"
                        className="min-h-11 font-semibold underline"
                        onClick={() => data.retry()}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]
      : []),

    ...(selected
      ? [
          {
            id: "library",
            label: selected.name.split(" ").slice(0, 2).join(" "),
            title: selected.name,
            detail: `${selected.type} library · ${[selected.city, selected.country].filter(Boolean).join(" · ")}`,
            content: (
              <div className="flex min-h-0 flex-1 flex-col">
                {backToList}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <AtlasLibraryPanel
                    key={selected.id}
                    library={selected}
                    compact={false}
                    onReach={openReach}
                    reachPrompt={
                      askReachScope ? (
                        <div
                          role="status"
                          className="mx-5 mb-5 space-y-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-sm"
                        >
                          <p className="m-0">
                            Reach is set to{" "}
                            {networkSelection.selected?.name ??
                              "a library service"}
                            . Switch to this library?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAskReachScope(false)
                                setReachScope("library")
                                openInspectLayer("reach")
                              }}
                              className="min-h-11 rounded-full bg-(--t-action-primary) px-4 font-semibold text-white"
                            >
                              Switch to this library
                            </button>
                            <button
                              type="button"
                              onClick={() => setAskReachScope(false)}
                              className="min-h-11 px-3 font-semibold"
                            >
                              Keep service
                            </button>
                          </div>
                        </div>
                      ) : null
                    }
                    onClose={closeLibrary}
                  />
                </div>
              </div>
            ),
          },
        ]
      : []),
    ...(selectedStop
      ? [
          {
            id: "stop",
            label: "Stop",
            title: selectedStop.name,
            detail: `Mobile library · ${selectedStop.library_name}`,
            content: (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <AtlasStopPanel
                  key={selectedStop.id}
                  stop={selectedStop}
                  live={mobiles.live[selectedStop.library_document_id]}
                  now={now}
                  onClose={() => setSelectedStop(null)}
                />
              </div>
            ),
          },
        ]
      : []),
    ...analysisDrawers.map(({ mode, layer }) => ({
      id: mode,
      layer: usableLayers.includes(layer) ? layer : undefined,
      label: tDrawers(mode),
      title: drawerSummaries[mode].heading ?? tDrawers(`${mode}Label`),
      ...drawerSummaries[mode],
      status:
        mode === "reach" &&
        (networkReach.stale || networkReach.response?.state === "pending")
          ? networkReach.stale
            ? "Update needed"
            : "Calculating"
          : undefined,
      content: renderAnalysis(mode),
    })),
    ...(usableLayers.includes("density")
      ? [
          {
            id: "density",
            layer: "density" as const,
            label: tDensity("label"),
            title: tDensity("title"),
            detail: tDensity("description"),
            metric: densityData?.exactTotal.toLocaleString(),
            content: (
              <AtlasLibraryDensity
                data={densityData}
                settings={densitySettings}
                onSettings={setDensitySettings}
                selected={selectedDensityCell}
                pins={usableLayers.includes("pins")}
                onPins={() => onToggleLayer("pins")}
                onResults={(cell) => {
                  mapRef.current?.fitBounds(cell.bounds)
                }}
                centre={{ lat: view?.lat ?? 30, lng: view?.lng ?? 10 }}
                evaluatedAt={data.generation?.viewport.evaluatedAt}
                loading={!densityData || (scalable && data.loading)}
                error={data.error}
                retry={scalable ? data.retry : load}
              />
            ),
          },
        ]
      : []),
    ...(["mobile", "events"] as const)
      .filter((id) => usableLayers.includes(id))
      .map((id) => ({
        id,
        layer: id,
        label: id === "mobile" ? "Routes" : "Events",
        title: layerDef(id).name,
        detail:
          id === "mobile"
            ? `In map view · ${mobiles.total.toLocaleString()} stops`
            : "Relative concentration · recorded libraries",
        metric: id === "mobile" ? mobiles.total.toLocaleString() : undefined,
        content: (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
              {id === "mobile" ? (
                <>
                  <p className="m-0 text-[36px] font-semibold text-(--t-accent-primary)">
                    {mobiles.total.toLocaleString()}{" "}
                    <span className="text-sm text-(--t-ink-dim)">stops</span>
                  </p>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mobileRouteLines}
                      onChange={(event) =>
                        setMobileRouteLines(event.target.checked)
                      }
                    />
                    Show route lines
                  </label>
                  {stopList}
                </>
              ) : (
                <>
                  <div
                    className="h-4 rounded-full"
                    style={{
                      background: `linear-gradient(90deg,${ATLAS_DENSITY_COLORS.join(",")})`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-(--t-ink-dim)">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                  <p>{ABOUT[id]}</p>
                </>
              )}
            </div>
            <AtlasInspectTools
              shading={id === "mobile" ? mobileOpacity : heatOpacity}
              onShading={id === "mobile" ? setMobileOpacity : setHeatOpacity}
              about={<p>{ABOUT[id]}</p>}
            />
          </>
        ),
      })),
  ]
  const inspectActive =
    inspectEntries.find((entry) => entry.id === inspectTarget)?.id ??
    inspectEntries.find((entry) => entry.id === activeDrawer)?.id ??
    inspectEntries[0]?.id ??
    ""
  const selectInspect = (id: string) => {
    const descriptor = analysisDrawers.find(({ mode }) => mode === id)
    if (descriptor) {
      setAnalysisMode(descriptor.mode)
      setInspectTarget(null)
    } else setInspectTarget(id as typeof inspectTarget)
    setInspectMinimised(false)
    setMobileSurface("inspect")
    setLeftPinned(false)
    if (!(list && id === "library")) setList(false)
    if (isMobile) setSheet((current) => (current === "peek" ? "half" : current))
  }
  const removeInspect = (entry: AtlasInspectEntry) => {
    if (entry.layer) {
      setUndoLayers({
        layers: usableLayers,
        mode: analysisMode,
        target: inspectTarget,
        message: `${entry.label} turned off`,
      })
      onToggleLayer(entry.layer)
    } else if (entry.id === "library") {
      closeLibrary()
      if (list) return
    } else if (entry.id === "stop") setSelectedStop(null)
    else {
      setAnalysisMode(null)
      setInspectTarget(null)
    }
    if (entry.id === inspectTarget) setInspectTarget(null)
    requestAnimationFrame(() =>
      analysisRoot.current
        ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true })
    )
  }
  const analysisPanels = (
    <AtlasInspect
      entries={inspectEntries}
      active={inspectActive}
      minimised={inspectMinimised}
      mobile={isMobile}
      visible={
        (!list || listLibraryOpen) && (!isMobile || mobileSurface === "inspect")
      }
      onSelect={(id) => animateAtlas(() => selectInspect(id))}
      onMinimise={() =>
        animateAtlas(() => {
          setInspectMinimised(true)
          setMobileSurface("explore")
          setLeftPinned(false)
          if (list) restoreListFocus()
        })
      }
      onRemove={(entry) => animateAtlas(() => removeInspect(entry))}
    />
  )
  const notices = (
    <>
      {overlays}
      {undoLayers ? (
        <AtlasToast
          onDismiss={() => setUndoLayers(null)}
          action={{
            label: "Undo",
            onClick: () => {
              setLayers(undoLayers.layers)
              setAnalysisMode(undoLayers.mode)
              setInspectTarget(undoLayers.target)
              setUndoLayers(null)
            },
          }}
        >
          {undoLayers.message}
        </AtlasToast>
      ) : null}
      {locateFailed ? (
        <AtlasToast onDismiss={() => setLocateFailed(false)}>
          Location unavailable. Check your browser permissions and try again.
        </AtlasToast>
      ) : null}
    </>
  )
  const locate = async () => {
    const found = await mapRef.current?.locate()
    setLocateFailed(found !== true)
  }
  const listView = (
    <AtlasListView
      key={scalable ? JSON.stringify(data.scope) : "legacy"}
      remoteScope={scalable ? data.scope : undefined}
      sort={listSort}
      onSelect={selectListLibrary}
      selectedId={listLibraryOpen ? selectedId : null}
      onSortChange={setListSort}
      onShowAnalysis={
        inspectEntries.length
          ? () => {
              setList(false)
              setInspectMinimised(false)
              setMobileSurface("inspect")
            }
          : undefined
      }
      compact={isMobile}
      notice={
        hasDataNotice || stopList || usableLayers.includes("access") ? (
          <>
            {dataNotices}
            {stopList}
            {usableLayers.includes("access") ? legends : null}
          </>
        ) : undefined
      }
      libraries={inView}
      accessibility={
        usableLayers.includes("access") ? accessibility : undefined
      }
      center={center}
      now={now}
      onHover={setHovered}
      onShowMap={() => setList(false)}
      onSeePlans={() => setPlansOpen(true)}
    />
  )
  const projectionControls = (
    <div
      role="radiogroup"
      aria-label={tUi("projection")}
      className="flex min-w-16 flex-col gap-1 rounded-2xl p-1 text-xs font-semibold"
      style={PANEL_STYLE}
    >
      {(
        [
          ["flat", "2D"],
          ["globe", "Globe"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={projection === value}
          onClick={() => setProjection(value)}
          className="min-h-10 min-w-14 rounded-xl px-2.5 whitespace-nowrap text-(--t-ink-dim) hover:bg-(--t-bg-surface) aria-checked:bg-(--t-accent-chip) aria-checked:text-(--t-accent-primary)"
        >
          {label}
        </button>
      ))}
    </div>
  )
  const toolbar = (
    <div className="atlas-status flex min-h-12 min-w-0 items-center gap-3 rounded-[14px] border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-1 shadow-sm">
      <AtlasMapLegend
        layers={usableLayers}
        metric={accessMetric}
        accessibilityView={accessibilityView}
        compact
      >
        {legends}
      </AtlasMapLegend>
      <div className="atlas-overlay-chips flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {inspectEntries
          .filter((entry) => entry.layer)
          .map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`Open ${entry.title} · ${entry.detail}`}
              onClick={() => animateAtlas(() => selectInspect(entry.id))}
              className="min-h-8 shrink-0 rounded-full bg-(--t-bg-surface) px-3 text-xs font-semibold aria-pressed:bg-(--t-accent-chip) aria-pressed:text-(--t-accent-primary)"
              aria-pressed={inspectActive === entry.id && !inspectMinimised}
            >
              {entry.label}
            </button>
          ))}
      </div>
      <div className="atlas-status-count shrink-0">
        <AtlasCount
          count={resultCount ?? inView.length}
          sub={countSub}
          loading={scalable && !data.counts && !data.error}
        />
      </div>
      <ViewToggle list={list} onChange={setList} />
    </div>
  )
  const plans = (
    <AtlasPlansSheet
      open={plansOpen}
      tier={tier}
      currentPlan={capacity === 2 ? "team" : plan}
      signInHref={signInHref}
      onClose={() => setPlansOpen(false)}
    />
  )

  if (isMobile) {
    const showInspect =
      mobileSurface === "inspect" &&
      inspectEntries.length > 0 &&
      (!list || listLibraryOpen)
    const showList = list && !listLibraryOpen
    const size = list
      ? "full"
      : sheet === "peek" && showInspect && inspectEntries.length
        ? "half"
        : sheet
    const heights: Record<SheetSize, string> = {
      peek: "188px",
      half: "54%",
      full: "calc(100% - 12px)",
    }

    return (
      <div
        ref={analysisRoot}
        tabIndex={-1}
        className="atlas-motion absolute inset-0 overflow-clip outline-none"
        style={{ background: T.bg.void }}
      >
        {map}
        {!list ? (
          <>
            <div className="absolute top-3 left-3 z-20 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3">
              <AtlasMapLegend
                layers={usableLayers}
                metric={accessMetric}
                accessibilityView={accessibilityView}
                compact
                placement="below"
              >
                {legends}
              </AtlasMapLegend>
            </div>
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
              <MapButtons
                onZoomIn={() => mapRef.current?.zoomBy(1)}
                onZoomOut={() => mapRef.current?.zoomBy(-1)}
                onLocate={locate}
              />
              {projectionControls}
            </div>
            <div className="pointer-events-none absolute top-3 right-24 left-3 z-20 space-y-2 [&>*]:pointer-events-auto">
              {notices}
              {noMatch}
            </div>
          </>
        ) : null}
        <DashboardContextTransition routeKey="/map">
          <section
            aria-label="Explore panel"
            className={`${panelStyles.stack} absolute inset-x-0 bottom-0 z-30 flex min-h-0 flex-col overflow-clip rounded-t-[24px] border-t border-(--t-border-hi) bg-(--t-bg-deep) pb-[env(safe-area-inset-bottom)]`}
            style={{
              height: heights[size],
              viewTransitionName: "var(--atlas-mobile-sheet-transition, none)",
            }}
          >
            <button
              type="button"
              aria-label={`Panel size: ${size}. Change size`}
              onClick={() =>
                animateAtlas(() => setSheet(size === "full" ? "half" : "full"))
              }
              className="flex h-6 shrink-0 items-center justify-center"
            >
              <span className="h-[5px] w-10 rounded-full bg-(--t-border-hi)" />
            </button>
            <nav
              aria-label="Atlas workspace"
              className="flex shrink-0 items-center gap-1.5 border-b border-(--t-border-line) px-3 pb-2 max-[350px]:[&_svg]:hidden"
            >
              <button
                type="button"
                aria-pressed={!showInspect && !list}
                onClick={() => {
                  setList(false)
                  setMobileSurface("explore")
                  if (sheet === "peek") setSheet("half")
                }}
                className="min-h-10 flex-1 rounded-full bg-(--t-bg-surface) text-sm font-semibold whitespace-nowrap aria-pressed:bg-(--t-accent-chip) aria-pressed:text-(--t-accent-primary)"
              >
                Explore
              </button>
              <button
                type="button"
                disabled={!inspectEntries.length}
                aria-pressed={showInspect}
                onClick={() => {
                  if (!listLibraryOpen) setList(false)
                  setMobileSurface("inspect")
                  setInspectMinimised(false)
                  if (sheet === "peek") setSheet("half")
                }}
                className="min-h-10 flex-1 rounded-full bg-(--t-bg-surface) text-sm font-semibold whitespace-nowrap disabled:opacity-40 aria-pressed:bg-(--t-accent-chip) aria-pressed:text-(--t-accent-primary)"
              >
                {tInspect("inspect")}
                {inspectEntries.length ? ` · ${inspectEntries.length}` : ""}
              </button>
              <ViewToggle
                list={list}
                onChange={(value) => {
                  setList(value)
                  if (value) {
                    setSheet("full")
                    setInspectMinimised(true)
                    setMobileSurface("explore")
                    restoreListFocus()
                  }
                }}
              />
            </nav>
            <div
              hidden={!showList}
              className="min-h-0 flex-1 overflow-clip"
              style={{ display: showList ? "flex" : "none" }}
            >
              {list ? listView : null}
            </div>
            <div
              hidden={list || showInspect}
              className="flex min-h-0 flex-1 flex-col"
              style={{
                display: !list && !showInspect ? "flex" : "none",
              }}
            >
              <div className="shrink-0 px-3 pt-2">{tabs}</div>
              <div
                id="atlas-tabpanel"
                role="tabpanel"
                aria-labelledby={`atlas-tab-${tab}`}
                className={`min-h-0 flex-1 overflow-y-auto px-5 pt-4 ${tab === "filter" ? "pb-0" : "pb-5"}`}
              >
                {tabContent}
              </div>
              <div
                className={`flex shrink-0 items-center gap-3 border-t border-(--t-border-line) px-3 ${tab === "filter" ? "justify-end" : "justify-between"}`}
              >
                {tab !== "filter" ? (
                  <AtlasCount
                    count={resultCount ?? inView.length}
                    sub={countSub}
                    loading={scalable && !data.counts && !data.error}
                  />
                ) : null}
                {feedbackPrompt}
              </div>
            </div>
            <div
              id="atlas-analysis-panel"
              hidden={!showInspect}
              className="flex min-h-0 flex-1 flex-col"
              style={{
                display: showInspect ? "flex" : "none",
              }}
            >
              {analysisPanels}
            </div>
          </section>
        </DashboardContextTransition>
        {plans}
      </div>
    )
  }
  const leftEdge = collapsed ? 72 : LEFT_W

  return (
    <div
      ref={analysisRoot}
      tabIndex={-1}
      className="atlas-motion absolute inset-0 overflow-clip outline-none"
      style={{ background: T.bg.void }}
    >
      {map}
      <DashboardContextTransition routeKey="/map">
        <aside
          aria-label="Explore panel"
          className={`${panelStyles.stack} absolute inset-y-0 left-0 z-20 flex min-h-0 flex-col overflow-clip border-r border-(--t-border-line) bg-(--t-bg-deep)`}
          style={{
            width: collapsed ? 72 : LEFT_W,
            viewTransitionName: "var(--atlas-sidebar-transition, none)",
          }}
        >
          {collapsed ? (
            <>
              <nav
                aria-label="Explore"
                className="flex flex-col items-center gap-1.5 p-2 pt-3"
              >
                {(
                  [
                    ["search", "Search"],
                    ["filter", "Filters"],
                    ["layers", "Layers"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Open ${label}`}
                    aria-pressed={tab === key}
                    onClick={() =>
                      animateAtlas(() => {
                        setTab(key)
                        setUserCollapsed(false)
                        setLeftPinned(true)
                        if (narrow) setInspectMinimised(true)
                      })
                    }
                    className="flex min-h-[64px] w-[56px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl px-1 py-3 text-xs leading-4 font-semibold"
                    style={{
                      background: tab === key ? T.accent.chip : undefined,
                      color: tab === key ? T.accent.primary : T.ink.dim,
                    }}
                  >
                    <Icon name={key === "filter" ? "filter" : key} size={19} />
                    {label}
                  </button>
                ))}
              </nav>
              <div className="atlas-rail-feedback mt-auto flex flex-col items-center gap-2 pb-3">
                {feedbackPrompt}
                <button
                  type="button"
                  aria-label="Expand Explore"
                  onClick={() =>
                    animateAtlas(() => {
                      setUserCollapsed(false)
                      setLeftPinned(true)
                      if (narrow) setInspectMinimised(true)
                    })
                  }
                  className="flex min-h-11 w-12 items-center justify-center"
                >
                  <Icon name="chev" size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-1 border-b border-(--t-divider) bg-(--t-bg-surface) p-2">
                {tabs}
                <button
                  type="button"
                  aria-label="Collapse panel"
                  onClick={() =>
                    animateAtlas(() => {
                      setUserCollapsed(true)
                      setLeftPinned(false)
                    })
                  }
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep)"
                >
                  <Icon name="chev" className="rotate-180" size={17} />
                </button>
              </div>
              <div
                id="atlas-tabpanel"
                role="tabpanel"
                aria-labelledby={`atlas-tab-${tab}`}
                className={`min-h-0 flex-1 overflow-y-auto px-5 pt-[18px] ${tab === "filter" ? "pb-0" : "pb-5"}`}
                style={{
                  viewTransitionName:
                    "var(--atlas-sidebar-content-transition, none)",
                }}
              >
                {tabContent}
              </div>
              <div className="flex shrink-0 justify-end border-t border-(--t-border-line) px-3 py-1">
                {feedbackPrompt}
              </div>
            </>
          )}
        </aside>
      </DashboardContextTransition>
      {inspectEntries.length ? (
        <aside
          id="atlas-analysis-panel"
          aria-label="Inspect dock"
          className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col"
          style={{
            width: inspectMinimised ? 64 : RIGHT_W,
            display: list && !listLibraryOpen ? "none" : undefined,
          }}
        >
          {analysisPanels}
        </aside>
      ) : null}
      {!list ? (
        <>
          <div
            className="absolute top-4 z-20 flex flex-col items-end gap-2"
            style={{
              right: mapRightEdge,
              viewTransitionName: "var(--atlas-map-controls-transition, none)",
            }}
          >
            <MapButtons
              onZoomIn={() => mapRef.current?.zoomBy(1)}
              onZoomOut={() => mapRef.current?.zoomBy(-1)}
              onLocate={locate}
            />
            {projectionControls}
          </div>
          <div
            className="pointer-events-none absolute top-4 z-20 flex max-w-[560px] flex-col gap-2 [&>*]:pointer-events-auto"
            style={{ left: leftEdge + 16, right: mapRightEdge + 80 }}
          >
            {notices}
          </div>
          {noMatch ? (
            <div
              className="absolute top-1/2 z-20"
              style={{ left: leftEdge + 16, right: mapRightEdge + 16 }}
            >
              {noMatch}
            </div>
          ) : null}
          <div
            className="pointer-events-none absolute bottom-4 z-20 flex min-w-0 justify-center px-4 [&>*]:pointer-events-auto"
            style={{ left: leftEdge, right: mapRightEdge }}
          >
            {toolbar}
          </div>
        </>
      ) : (
        <section
          aria-label="Library list"
          className="absolute inset-y-0 right-0 z-20 flex min-w-0 flex-col overflow-hidden border-l border-(--t-border-line) bg-(--t-bg-deep)"
          style={{
            left: leftEdge,
            right: listLibraryOpen ? RIGHT_W : 0,
          }}
        >
          {listView}
        </section>
      )}
      {plans}
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

  const btn = "flex size-11 items-center justify-center bg-(--t-bg-deep)"

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

function analysisUrlSettings(params: URLSearchParams): {
  accessMetric: AtlasAccessMetric
  accessLevel: AtlasAccessLevel
  reachScope: "library" | "network"
  reachMode: AtlasReachMode
  reachMinutes: number
  populationLevel: AtlasPopulationDetail
  populationCountry: string
  contextRelease: string
  populationOpacity: number
} {
  const areaLevel = params.get("accessAreas")
  const reachTime = Number(params.get("reachMinutes"))
  const populationAreas = params.get("populationAreas") ?? ""
  const country = params.get("populationCountry") ?? ""
  const context = params.get("contextRelease") ?? ""
  const opacity = Number(params.get("populationOpacity") ?? "0.7")

  return {
    accessMetric:
      params.get("accessMetric") === "peoplePerLibrary"
        ? ("peoplePerLibrary" as const)
        : ("per100k" as const),
    accessLevel:
      areaLevel === "local" || areaLevel === "countries"
        ? areaLevel
        : ("auto" as const),
    reachScope:
      params.get("reachScope") === "network"
        ? ("network" as const)
        : ("library" as const),
    reachMode:
      params.get("reachMode") === "cycling"
        ? ("cycling" as const)
        : ("walking" as const),
    reachMinutes: [5, 10, 15, 30].includes(reachTime) ? reachTime : 15,
    populationLevel: ["auto", "countries", "regions", "local", "grid"].includes(
      populationAreas
    )
      ? (populationAreas as AtlasPopulationDetail)
      : ("auto" as const),
    populationCountry: ["GB", "SE", "NO", "DK", "FI", "AX"].includes(country)
      ? country
      : "GB",
    contextRelease: /^[a-z0-9-]{1,100}$/.test(context) ? context : "",
    populationOpacity: Number.isFinite(opacity)
      ? Math.max(0.1, Math.min(1, opacity))
      : 0.7,
  }
}
function setUrlValue(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean,
  fallback: string | number | boolean
) {
  if (value !== fallback) params.set(key, String(value))
}

function automaticPopulationLabel(level: string) {
  if (level === "grid") return "automaticGrid"
  if (level === "countries") return "automaticCountries"

  return "automaticLocal"
}
function populationAnalysisError({
  grid,
  contextError,
  loading,
  hasGrid,
  error,
}: {
  grid: boolean
  contextError: boolean
  loading: boolean
  hasGrid: boolean
  error: string | null
}) {
  if (!grid) return error
  if (contextError) return "Context unavailable"
  if (!loading && !hasGrid) return "Grid not installed"

  return null
}
function isPopulationArea(value: string) {
  return (
    /^(?:[A-Z]{3}|[EWSN]\d{8}|[a-z][a-z0-9-]{0,80})$/.test(value) ||
    /^(?:\d{2,5}|[A-Z]{2}\d{2,3})$/.test(value)
  )
}

function accessibilityExportLibraries(
  scalable: boolean,
  libraries: AtlasLibrary[],
  view: AtlasView | null,
  selected: string[],
  mode: AccessibilityView
) {
  if (scalable) return []

  return accessibilityLibraries(
    view
      ? libraries.filter((library) => inBounds(library, view.bounds))
      : libraries,
    selected,
    mode
  )
}
function recordScopeLabel(inView: boolean) {
  return inView ? "Records in view" : "Loaded records"
}

function initialAnalysisSelection(
  drawers: ReturnType<typeof atlasAnalysisDrawers>,
  requested: string | null,
  library: string | null,
  reach: boolean
) {
  return (
    drawers.find(({ mode }) => mode === requested)?.mode ??
    (library && !reach ? null : (drawers[0]?.mode ?? null))
  )
}

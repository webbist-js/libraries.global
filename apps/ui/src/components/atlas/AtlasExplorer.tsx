"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

import { Icon, type IconName, PANEL_STYLE } from "./atlas-ui"
import {
  activeFilterCount,
  applyFilters,
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
  toggleLayer,
  toUrlParams,
  typeGroupOf,
} from "./atlas.logic"
import { AtlasCount, AtlasLegends, ViewToggle } from "./AtlasBottomBar"
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
import { AtlasPlansSheet } from "./AtlasPlansSheet"
import {
  AtlasSearchTab,
  buildPlaces,
  type Place,
  type RecentItem,
} from "./AtlasSearchTab"

type Tab = "search" | "filter" | "layers"
type SheetSize = "peek" | "half" | "full"

const LEFT_W = 360
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

function useTier(): Tier {
  const { data } = authClient.useSession()
  if (!data?.user) return "public"
  // Entitlements aren't built yet; a `plan` on the session user will switch Pro on.
  const plan = (data.user as { plan?: string | null }).plan

  return plan === "pro" ? "pro" : "free"
}

export function AtlasExplorer() {
  const mapRef = useRef<AtlasMapHandle>(null)
  const isMobile = useIsMobile()
  const tier = useTier()

  // ── State (hydrated from the URL after mount) ─────────────────────────────
  const [hydrated, setHydrated] = useState(false)
  const [initialView, setInitialView] = useState<{
    lat: number
    lng: number
    zoom: number
  } | null>(null)
  const [filters, setFilters] = useState<AtlasFilters>(EMPTY_FILTERS)
  const [layers, setLayers] = useState<LayerId[]>([])
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

  const [tab, setTab] = useState<Tab>("search")
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState("")
  const [hovered, setHovered] = useState<AtlasLibrary | null>(null)
  const [heatOpacity, setHeatOpacity] = useState(0.7)
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
    setSelectedId(s.library)
    setList(s.list)
    setProjection(s.projection)
    if (activeFilterCount(s.filters) > 0) setTab("filter")
    else if (s.layers.length > 0) setTab("layers")
    setRecent(readStorage<RecentItem[]>(RECENT_KEY, []))
    setHintDismissed(readStorage(HINT_KEY, false) || Boolean(s.view))
    setOnline(navigator.onLine)
    setHydrated(true)
  }, [])

  // Load every published library once.
  const load = useCallback(() => {
    setLoadError(false)
    fetch("/api/public-proxy/api/libraries/atlas")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))

        return r.json()
      })
      .then((fc) => setAll(fromFeatureCollection(fc)))
      .catch(() => setLoadError(true))
  }, [])
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
      layers.filter((id) => layerAccess(layerDef(id), tier) === "available"),
    [layers, tier]
  )

  // ── URL sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return
    const t = setTimeout(() => {
      const params = toUrlParams({
        view: view
          ? { lat: view.lat, lng: view.lng, zoom: view.zoom }
          : initialView,
        filters,
        layers: usableLayers,
        library: selectedId,
        list,
        projection,
      })
      const qs = params.toString()
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      )
    }, 400)

    return () => clearTimeout(t)
  }, [
    hydrated,
    view,
    initialView,
    filters,
    usableLayers,
    selectedId,
    list,
    projection,
  ])

  // ── Derived data ──────────────────────────────────────────────────────────
  const libs = useMemo(() => all ?? [], [all])
  const listed = useMemo(
    () => applyFilters(libs, filters, now),
    [libs, filters, now]
  )
  const closures = useMemo(
    () =>
      usableLayers.includes("closures")
        ? libs.filter((l) => l.status === "permanently_closed")
        : [],
    [libs, usableLayers]
  )
  const inView = useMemo(
    () => (view ? listed.filter((l) => inBounds(l, view.bounds)) : listed),
    [listed, view]
  )
  const groupsInView = useMemo(
    () => [...new Set(inView.map((l) => typeGroupOf(l.type)))],
    [inView]
  )
  const places = useMemo(
    () => buildPlaces(libs.filter((l) => l.status !== "permanently_closed")),
    [libs]
  )
  const selected = useMemo(
    () => libs.find((l) => l.id === selectedId) ?? null,
    [libs, selectedId]
  )
  const filterCount = activeFilterCount(filters)
  const suggestions = useMemo(
    () =>
      all && listed.length === 0 && filterCount > 0
        ? loosenSuggestions(libs, filters, now)
        : [],
    [all, listed.length, filterCount, libs, filters, now]
  )

  // A shared link may point at a library by slug rather than id.
  useEffect(() => {
    if (!all || !selectedId || selected) return
    const bySlug = all.find((l) => l.slug === selectedId)
    setSelectedId(bySlug?.id ?? null)
  }, [all, selectedId, selected])

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
      setSelectedId(lib.id)
      setList(false)
      if (fly) mapRef.current?.flyTo(lib.lat, lib.lng, 14)
      remember({
        kind: "library",
        key: lib.id,
        label: lib.name,
        sub: [lib.city, lib.region, lib.country].filter(Boolean).join(", "),
      })
      if (isMobile) setSheet("half")
    },
    [remember, isMobile]
  )

  const pickPlace = useCallback(
    (p: Place) => {
      mapRef.current?.fitTo(p.libraries)
      setQuery("")
      remember({ kind: "place", key: p.key, label: p.label, sub: p.sub })
      if (isMobile) setSheet("peek")
    },
    [remember, isMobile]
  )

  const onMapSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (id && isMobile) setSheet("half")
    },
    [isMobile]
  )

  const onToggleLayer = useCallback(
    (id: LayerId) => {
      const { layers: next, replaced: removed } = toggleLayer(usableLayers, id)
      setLayers(next)
      setReplaced(removed ? { removed, added: id, prev: usableLayers } : null)
    },
    [usableLayers]
  )

  const signInHref = useMemo(() => {
    if (typeof window === "undefined") return "/auth/signin"

    return `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
    // Recompute when state that shapes the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, usableLayers, selectedId, view, hydrated])

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
      {tab === "search" ? (
        <AtlasSearchTab
          query={query}
          onQuery={setQuery}
          libraries={listed}
          places={places}
          filters={filters}
          now={now}
          recent={recent}
          onPickLibrary={(l) => selectLibrary(l)}
          onPickPlace={pickPlace}
          onPreset={(patch) => {
            setFilters((f) => ({ ...f, ...patch }))
            setTab("filter")
          }}
          onGoLayers={() => setTab("layers")}
        />
      ) : null}
      {tab === "filter" ? (
        <AtlasFiltersTab
          filters={filters}
          onChange={setFilters}
          libraries={libs}
          matchCount={listed.length}
          now={now}
          onShowResults={() => {
            mapRef.current?.fitTo(listed)
            if (isMobile) setSheet("peek")
          }}
        />
      ) : null}
      {tab === "layers" ? (
        <AtlasLayersTab
          tier={tier}
          active={usableLayers}
          onToggle={onToggleLayer}
          heatOpacity={heatOpacity}
          onHeatOpacity={setHeatOpacity}
          onSignIn={signIn}
          onSeePlans={() => setPlansOpen(true)}
        />
      ) : null}
    </>
  )

  const tabs = (
    <div role="tablist" aria-label="Explore" className="flex flex-1 gap-1">
      {(
        [
          ["search", "Search", "search"],
          ["filter", "Filters", "filter"],
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

  const legends = <AtlasLegends groups={groupsInView} layers={usableLayers} />
  const countSub = view ? "libraries in view" : "libraries"
  const center = view ?? { lat: 30, lng: 10 }

  const overlays = (
    <>
      {!online ? (
        <AtlasBanner
          tone="danger"
          title="You’re offline."
          body={
            all
              ? `Showing ${listed.length.toLocaleString()} libraries loaded earlier. The basemap and new data need a connection.`
              : "The atlas needs a connection to load."
          }
        />
      ) : null}
      {loadError ? (
        <AtlasBanner
          tone="danger"
          title="We couldn’t load the libraries."
          body="The map will fill in once they arrive."
          action={{ label: "Try again", onClick: load }}
        />
      ) : null}
      {mapError === "webgl" ? (
        <AtlasBanner
          tone="info"
          title="This browser can’t draw the map."
          body="It needs WebGL, which is turned off or unavailable here. Every library is still in the list."
        />
      ) : null}
      {mapError === "style" ? (
        <AtlasBanner
          tone="info"
          title="The basemap didn’t load."
          body="Library data is still available in the list view."
          action={
            list
              ? undefined
              : { label: "Open list", onClick: () => setList(true) }
          }
        />
      ) : null}
      {replaced ? (
        <AtlasToast
          onDismiss={() => setReplaced(null)}
          action={{
            label: "Undo",
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
      closures={closures}
      layers={usableLayers}
      heatOpacity={heatOpacity}
      selected={selected}
      hovered={hovered}
      projection={projection}
      initialView={initialView}
      padding={{
        left: isMobile || collapsed ? 0 : LEFT_W + GAP,
        right: !isMobile && selected ? RIGHT_W + GAP : 0,
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
    all && listed.length === 0 && filterCount > 0 ? (
      <AtlasNoMatch
        filterCount={filterCount}
        suggestions={suggestions}
        onApply={(s) => setFilters((f) => ({ ...f, ...s.patch }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />
    ) : null

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    const heights: Record<SheetSize, string> = {
      peek: "188px",
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
      : selected && sheet === "peek"
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
        <div className="pointer-events-none absolute inset-x-3 top-3 right-16 z-20 flex flex-col gap-2 [&>*]:pointer-events-auto">
          {overlays}
        </div>
        {noMatch && size === "peek" ? (
          <div className="absolute inset-x-3 top-1/4 z-20 flex justify-center">
            {noMatch}
          </div>
        ) : null}
        <section
          aria-label="Explore panel"
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
          <div className="min-h-0 flex-1 overflow-auto">
            {list ? (
              <AtlasListView
                compact
                libraries={inView}
                center={center}
                now={now}
                onHover={setHovered}
                onShowMap={() => setList(false)}
              />
            ) : selected ? (
              <AtlasLibraryPanel
                key={selected.id}
                compact
                library={selected}
                onClose={() => setSelectedId(null)}
              />
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
                  Library or place
                </button>
                <div className="flex items-center justify-between">
                  <AtlasCount count={inView.length} sub="in view" />
                  <ViewToggle list={list} onChange={setList} />
                </div>
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
  const rightEdge = selected && !list ? RIGHT_W + GAP * 2 : GAP

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-hide-footer="true"
      style={{ background: T.bg.void }}
    >
      {map}

      {collapsed ? (
        <nav
          aria-label="Explore panel"
          className="absolute top-4 bottom-4 left-4 z-20 flex w-[72px] flex-col items-center gap-1.5 rounded-[22px] pt-3.5"
          style={PANEL_STYLE}
        >
          {(
            [
              ["search", "Search"],
              ["filter", "Filters"],
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
          aria-label="Explore panel"
          className="absolute top-4 bottom-4 left-4 z-20 flex flex-col overflow-hidden rounded-[22px]"
          style={{ ...PANEL_STYLE, width: LEFT_W }}
        >
          <div
            className="flex items-center gap-1 border-b p-2"
            style={{ borderColor: T.border.divider, background: T.bg.surface }}
          >
            {tabs}
            <button
              type="button"
              aria-label="Collapse panel"
              onClick={() => setCollapsed(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ color: T.ink.dim }}
            >
              <Icon name="panel" size={18} />
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

      {selected && !list ? (
        <aside
          aria-label="Selected library"
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
            aria-label="Projection"
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
                onClick={() => setProjection(v)}
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

      <div
        className="pointer-events-none absolute top-4 z-20 flex max-w-[560px] flex-col items-start gap-2 [&>*]:pointer-events-auto"
        // In list view the map strip on the right is the free space.
        style={
          list
            ? { right: GAP, width: 320 }
            : { left: leftEdge, right: rightEdge + 90 }
        }
      >
        {overlays}
        {!mapReady && !mapError && !list ? (
          <AtlasLoading
            listReady={Boolean(all)}
            onOpenList={() => setList(true)}
          />
        ) : null}
      </div>

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
          className="absolute top-4 bottom-4 z-20 overflow-hidden rounded-[22px]"
          style={{ ...PANEL_STYLE, left: leftEdge, right: 352 }}
        >
          <AtlasListView
            libraries={inView}
            center={center}
            now={now}
            onHover={setHovered}
            onShowMap={() => setList(false)}
          />
        </div>
      ) : (
        <div
          className="absolute bottom-4 z-20 flex min-h-16 items-center gap-[18px] overflow-x-auto rounded-[20px] py-2.5 pr-3 pl-[18px]"
          style={{ ...PANEL_STYLE, left: leftEdge, right: rightEdge }}
        >
          {legends}
          <span
            className="w-px self-stretch"
            style={{ background: T.border.divider }}
          />
          <AtlasCount count={inView.length} sub={countSub} />
          <span className="flex-1" />
          <ViewToggle list={list} onChange={setList} />
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
  const btn = "flex size-11 items-center justify-center bg-white"

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[14px]"
      style={PANEL_STYLE}
    >
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className={btn}
      >
        <Icon name="plus" size={20} />
      </button>
      {onZoomOut ? (
        <button
          type="button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className={cn(btn, "border-t")}
          style={{ borderColor: T.border.divider }}
        >
          <Icon name="minus" size={20} />
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Show my location"
        onClick={onLocate}
        className={cn(btn, "border-t")}
        style={{ borderColor: T.border.divider }}
      >
        <Icon name="locate" size={20} />
      </button>
    </div>
  )
}

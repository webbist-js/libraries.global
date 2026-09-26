"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/styles"

import GlobeInfoPanel from "./GlobeInfoPanel"
import GlobeSearchOverlay from "./GlobeSearchOverlay"
import MapGlobe, { type GlobeDrillState } from "./MapGlobe"
import MapLibreFullView from "./MapLibreFullView"

// ── View modes ────────────────────────────────────────────────────────────────

type ViewMode = "globe" | "map"

// ── Main ──────────────────────────────────────────────────────────────────────

interface FullMapPageProps {
  locale?: string
  initialQuery?: string
}

export default function FullMapPage({ locale: _locale }: FullMapPageProps) {
  const [drillState, setDrillState] = useState<GlobeDrillState>({
    level: "world",
  })
  const [searchSettled, setSearchSettled] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)

  // View mode: globe ↔ map
  const [viewMode, setViewMode] = useState<ViewMode>("globe")
  const [mapVisible, setMapVisible] = useState(false)
  // Snapshot of drill state at point of opening map — used as MapLibre initial state
  const [mapDrillSnapshot, setMapDrillSnapshot] =
    useState<GlobeDrillState | null>(null)
  // Ref so closeMap can read the latest snapshot without being recreated
  const mapDrillSnapshotRef = useRef(mapDrillSnapshot)
  mapDrillSnapshotRef.current = mapDrillSnapshot

  // Ref so handleClose / auto-open effect can read viewMode without deps
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  const drillStateRef = useRef(drillState)
  drillStateRef.current = drillState

  const panelOpen = drillState.level !== "world"

  const handleDrillChange = useCallback(
    (s: GlobeDrillState) => setDrillState(s),
    []
  )

  const handleFirstInteraction = useCallback(() => setSearchSettled(true), [])
  const handleLoadingChange = useCallback(
    (loading: boolean, message?: string) => {
      setLoadingMsg(loading ? (message ?? "Loading…") : null)
    },
    []
  )

  // Also slide search to top when panel opens
  const effectiveSettled = searchSettled || panelOpen

  // ── Transition: globe → map (shelf slides up) ─────────────────────────────

  const openMap = useCallback(
    (state?: GlobeDrillState) => {
      setMapDrillSnapshot((prev) => state ?? prev ?? drillState)
      setViewMode("map")
      // Defer the CSS translate so the element is in the DOM before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMapVisible(true))
      })
    },
    [drillState]
  )

  // ── Transition: map → globe (shelf slides back down) ──────────────────────
  // Accepts an optional targetState to land on after the shelf closes.
  // Defaults to continent level (so the auto-open effect doesn't immediately re-fire).

  const closeMap = useCallback((targetState?: GlobeDrillState) => {
    setMapVisible(false)
    const snapshot = mapDrillSnapshotRef.current
    setDrillState(
      targetState ??
        (snapshot?.continent
          ? { level: "continent", continent: snapshot.continent }
          : { level: "world" })
    )
    // Unmount MapLibre after slide animation completes
    const t = setTimeout(() => {
      setViewMode("globe")
      setMapDrillSnapshot(null)
    }, 520)

    return () => clearTimeout(t)
  }, [])

  const handleClose = useCallback(() => {
    if (viewModeRef.current === "map") {
      // Panel closed while map shelf is open — slide shelf down too
      closeMap({ level: "world" })
    } else {
      setDrillState({ level: "world" })
    }
  }, [closeMap])

  // ── Auto-open: slide map in when a country is selected on the globe ────────

  useEffect(() => {
    if (drillState.level !== "country") return
    if (viewModeRef.current !== "globe") return

    // Brief delay — lets the globe finish its camera animation to the country
    const t = setTimeout(() => openMap(drillStateRef.current), 500)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillState.level, drillState.country?.slug])

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#02040a]">
      {/* Ambient radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 55% 52%, rgba(18,72,148,0.18) 0%, rgba(8,28,72,0.08) 42%, transparent 68%)",
        }}
      />

      {/* ── Globe view ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <div className="relative h-full w-full">
          <MapGlobe
            drillState={drillState}
            onDrillChange={handleDrillChange}
            onFirstInteraction={handleFirstInteraction}
            onLoadingChange={handleLoadingChange}
          />

          {/* Search/filter overlay — always centred on the globe */}
          <GlobeSearchOverlay
            settled={effectiveSettled}
            drillState={drillState}
            onDrillChange={handleDrillChange}
          />

          {/* "Click a continent" hint */}
          {drillState.level === "world" && !effectiveSettled && (
            <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
              <p className="text-center text-[12px] text-white/45">
                Click a continent to explore
              </p>
            </div>
          )}

          {/* Map loading indicator */}
          {loadingMsg && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-(--t-border-hi) bg-white/92 px-4 py-2 backdrop-blur-md">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-(--t-border-hi) border-t-(--t-accent-primary)" />
              <span className="text-[12px] font-medium text-(--t-ink-dim)">
                {loadingMsg}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MapLibre shelf — slides up from the bottom ───────────────────────── */}
      {mapDrillSnapshot && (
        <div
          className={cn(
            "absolute inset-0 z-30 flex flex-col transition-transform duration-500 ease-out",
            mapVisible ? "translate-y-0" : "translate-y-full"
          )}
          style={{ boxShadow: "0 -8px 40px rgba(23,22,43,0.3)" }}
        >
          {/* Drag handle hint */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-(--t-border-hi)" />
          </div>

          <MapLibreFullView
            drillState={mapDrillSnapshot}
            onBackToGlobe={closeMap}
            className="min-h-0 flex-1"
          />
        </div>
      )}

      {/* ── Info panel — floats above both globe and shelf ───────────────────── */}
      {/* z-40 keeps it above the shelf (z-30) in both view modes */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <GlobeInfoPanel
          state={drillState}
          onDrillChange={handleDrillChange}
          onClose={handleClose}
          onOpenMap={panelOpen && viewMode === "globe" ? openMap : undefined}
          onBackToGlobe={viewMode === "map" ? closeMap : undefined}
        />
      </div>
    </div>
  )
}

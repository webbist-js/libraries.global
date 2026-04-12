"use client"

import { useCallback, useState } from "react"

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
  const [isTransitioning, setIsTransitioning] = useState(false)
  // Snapshot of drill state at point of opening map — used as MapLibre initial state
  const [mapDrillSnapshot, setMapDrillSnapshot] =
    useState<GlobeDrillState | null>(null)

  const panelOpen = drillState.level !== "world"

  const handleDrillChange = useCallback(
    (s: GlobeDrillState) => setDrillState(s),
    []
  )
  const handleClose = useCallback(() => setDrillState({ level: "world" }), [])

  const handleFirstInteraction = useCallback(() => setSearchSettled(true), [])
  const handleLoadingChange = useCallback(
    (loading: boolean, message?: string) => {
      setLoadingMsg(loading ? (message ?? "Loading…") : null)
    },
    []
  )

  // Also slide search to top when panel opens
  const effectiveSettled = searchSettled || panelOpen

  // ── Transition: globe → map ─────────────────────────────────────────────────

  const openMap = useCallback(() => {
    // Snapshot current drill state for MapLibre initialisation
    setMapDrillSnapshot(drillState)

    setIsTransitioning(true)
    // Allow dark overlay to fade in, then swap views
    const t1 = setTimeout(() => {
      setViewMode("map")
      const t2 = setTimeout(() => setIsTransitioning(false), 350)

      return () => clearTimeout(t2)
    }, 200)

    return () => clearTimeout(t1)
  }, [drillState])

  // ── Transition: map → globe ─────────────────────────────────────────────────

  const closeMap = useCallback(() => {
    setIsTransitioning(true)
    const t1 = setTimeout(() => {
      setViewMode("globe")
      // Unmount MapLibre after the transition completes (so re-open always gets fresh init)
      const t2 = setTimeout(() => {
        setIsTransitioning(false)
        setMapDrillSnapshot(null)
      }, 350)

      return () => clearTimeout(t2)
    }, 200)

    return () => clearTimeout(t1)
  }, [])

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
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          viewMode === "map" && !isTransitioning
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        )}
      >
        {/* Globe fills the full area; info panel overlays on the left */}
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
              <p className="text-center text-[12px] text-white/25">
                Click a continent to explore
              </p>
            </div>
          )}

          {/* Map loading indicator */}
          {loadingMsg && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-md">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
              <span className="text-[12px] text-white/50">{loadingMsg}</span>
            </div>
          )}

          {/* Left floating info panel */}
          <GlobeInfoPanel
            state={drillState}
            onDrillChange={handleDrillChange}
            onClose={handleClose}
            onOpenMap={panelOpen ? openMap : undefined}
          />
        </div>
      </div>

      {/* ── MapLibre full-screen view ────────────────────────────────────────── */}
      {mapDrillSnapshot && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col transition-opacity duration-500",
            viewMode === "globe" && !isTransitioning
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          )}
        >
          <MapLibreFullView
            drillState={mapDrillSnapshot}
            onBackToGlobe={closeMap}
            className="min-h-0 flex-1"
          />
        </div>
      )}

      {/* ── Transition overlay (dark crossfade) ─────────────────────────────── */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-50 bg-[#02040a] transition-opacity duration-200",
          isTransitioning ? "opacity-90" : "opacity-0"
        )}
      />
    </div>
  )
}

"use client"

import { cn } from "@/lib/styles"

import { InteractiveMap, type MapDrillLevel } from "./InteractiveMap"
import type { GlobeDrillState } from "./MapGlobe"

interface MapLibreFullViewProps {
  drillState: GlobeDrillState
  onBackToGlobe: () => void
  className?: string
}

export default function MapLibreFullView({
  drillState,
  onBackToGlobe,
  className,
}: MapLibreFullViewProps) {
  // Map globe drill level to InteractiveMap mode
  const mode: MapDrillLevel =
    drillState.level === "region"
      ? "region"
      : drillState.level === "country"
        ? "country"
        : "continent"

  // Build initial center from drill state centroid
  const entity = drillState.region ?? drillState.country ?? drillState.continent
  const mapConfig = entity
    ? {
        centerLat: entity.centroid.lat,
        centerLng: entity.centroid.lng,
        defaultZoom:
          drillState.level === "region"
            ? 8
            : drillState.level === "country"
              ? 6
              : 4,
        boundingBoxNE: null,
        boundingBoxSW: null,
        mapStyle: null,
      }
    : null

  // Breadcrumb label for back button context
  const entityName =
    drillState.region?.name ??
    drillState.country?.name ??
    drillState.continent?.name

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* Back to Globe button */}
      <button
        onClick={onBackToGlobe}
        className="absolute top-4 left-4 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm text-white/70 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {entityName ? `${entityName} — Globe` : "Back to Globe"}
      </button>

      <InteractiveMap
        mode={mode}
        continentSlug={drillState.continent?.slug}
        countrySlug={drillState.country?.slug}
        regionSlug={drillState.region?.slug}
        mapConfig={mapConfig}
        fill
        className="min-h-0 flex-1"
      />
    </div>
  )
}

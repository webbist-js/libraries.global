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
  className,
}: MapLibreFullViewProps) {
  const mode: MapDrillLevel =
    drillState.level === "region"
      ? "region"
      : drillState.level === "country"
        ? "country"
        : "continent"

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

  return (
    <div className={cn("relative flex flex-col", className)}>
      <InteractiveMap
        mode={mode}
        continentSlug={drillState.continent?.slug}
        countrySlug={drillState.country?.slug}
        regionSlug={drillState.region?.slug}
        mapConfig={mapConfig}
        fill
        hideBreadcrumb
        className="min-h-0 flex-1"
      />
    </div>
  )
}

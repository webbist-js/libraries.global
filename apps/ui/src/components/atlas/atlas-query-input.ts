import { atlasLongitude, type AtlasScope } from "@repo/shared-data"

import type { AtlasFilters } from "./atlas.logic"
import type { AtlasView } from "./AtlasMap"

/** Building queries share one allowlist; mobile controls have their own API. */
export function atlasBuildingFilters(
  filters: AtlasFilters
): AtlasScope["filters"] {
  return {
    types: filters.types,
    ...(filters.networks?.length ? { networks: filters.networks } : {}),
    opening: filters.opening,
    atDay: filters.atDay,
    atMinutes: filters.atMinutes,
    operators: filters.operators as AtlasScope["filters"]["operators"],
    facilities: filters.facilities,
    events: filters.events,
    catalogue: filters.catalogue,
    founded: filters.founded,
  }
}

/** Globe cameras can zoom below zero; queries use resolution zero for that view. */
export function atlasViewportCamera(view: AtlasView | null) {
  const raw = view?.bounds ?? { west: -180, east: 180, south: -90, north: 90 }
  const world = Math.abs(raw.east - raw.west) >= 360

  return {
    bbox: {
      west: world ? -180 : atlasLongitude(raw.west),
      east: world ? 180 : atlasLongitude(raw.east),
      south: Math.max(-90, raw.south),
      north: Math.min(90, raw.north),
    },
    zoom: Math.max(0, Math.min(24, view?.zoom ?? 1)),
    centre: { lat: view?.lat ?? 30, lng: atlasLongitude(view?.lng ?? 10) },
  }
}

import type { AtlasBounds } from "./contracts"
import { atlasLocalGeography } from "./library-access"
import type { AtlasNetworkSelection } from "./network-reach"

export const ATLAS_REACH_MIN_ZOOM = 11
export const ATLAS_REACH_MAX_VISIBLE_LIBRARIES = 100
export const ATLAS_REACH_MAX_SERVICE_LIBRARIES = 50
export const ATLAS_REACH_MAX_SPAN_KM = 75
export const ATLAS_REACH_MAX_BOUNDS_KM2 = 2500
export const ATLAS_REACH_EXTENDED_SPAN_KM = 200
export const ATLAS_REACH_EXTENDED_BOUNDS_KM2 = 20_000
export type AtlasReachCapacity = 1 | 2

/** Conservative geographic envelope; never treat camera zoom as a server budget. */
export function atlasReachBoundsAreLocal(bounds: AtlasBounds | null): boolean {
  return atlasReachBoundsWithin(
    bounds,
    ATLAS_REACH_MAX_SPAN_KM,
    ATLAS_REACH_MAX_BOUNDS_KM2
  )
}

export function atlasReachBoundsWithin(
  bounds: AtlasBounds | null,
  spanKm: number,
  areaKm2: number
): boolean {
  if (!bounds || !Object.values(bounds).every(Number.isFinite)) return false
  const { west, east, south, north } = bounds
  if (
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west > east ||
    south > north
  )
    return false
  const latitude =
    south <= 0 && north >= 0 ? 0 : Math.min(Math.abs(south), Math.abs(north))
  const width = (east - west) * 111.195 * Math.cos((latitude * Math.PI) / 180)
  const height = (north - south) * 111.195

  return Math.max(width, height) <= spanKm && width * height <= areaKm2
}

export function atlasNetworkReachLimit(
  selection: Pick<
    AtlasNetworkSelection,
    "eligibleLibraries" | "bounds" | "areaCodes"
  >,
  capacity: AtlasReachCapacity = 1
): "libraries" | "area" | null {
  const mode = atlasNetworkReachMode(selection, capacity)

  return mode === "all" || mode === "single" ? null : mode
}

/** Bounded named services can exceed the local four-time envelope. */
export function atlasNetworkReachMode(
  selection: Pick<
    AtlasNetworkSelection,
    "eligibleLibraries" | "bounds" | "areaCodes"
  >,
  capacity: AtlasReachCapacity = 1
): "all" | "single" | "libraries" | "area" {
  if (capacity !== 1 && capacity !== 2) return "area"
  if (
    !Number.isSafeInteger(selection.eligibleLibraries) ||
    selection.eligibleLibraries > ATLAS_REACH_MAX_SERVICE_LIBRARIES * capacity
  )
    return "libraries"
  const areas = selection.areaCodes.map((code) =>
    atlasLocalGeography.areas.find((area) => area.code === code)
  )
  if (!areas.length || areas.some((area) => !area)) return "area"
  const bounds = areas.reduce<AtlasBounds>(
    (combined, area) => ({
      west: Math.min(combined.west, area!.bounds.west),
      east: Math.max(combined.east, area!.bounds.east),
      south: Math.min(combined.south, area!.bounds.south),
      north: Math.max(combined.north, area!.bounds.north),
    }),
    { west: 180, east: -180, south: 90, north: -90 }
  )

  const envelopes = [selection.bounds, bounds]
  if (
    envelopes.every((box) =>
      atlasReachBoundsWithin(
        box,
        ATLAS_REACH_MAX_SPAN_KM * capacity,
        ATLAS_REACH_MAX_BOUNDS_KM2 * capacity
      )
    )
  )
    return "all"

  return envelopes.every((box) =>
    atlasReachBoundsWithin(
      box,
      ATLAS_REACH_EXTENDED_SPAN_KM * capacity,
      ATLAS_REACH_EXTENDED_BOUNDS_KM2 * capacity
    )
  )
    ? "single"
    : "area"
}

export function atlasReachViewLimit(
  zoom: number | undefined,
  libraries: number | null
): "zoom" | "busy" | null {
  if (
    zoom === undefined ||
    !Number.isFinite(zoom) ||
    zoom < ATLAS_REACH_MIN_ZOOM
  )
    return "zoom"
  if (libraries === null || libraries > ATLAS_REACH_MAX_VISIBLE_LIBRARIES)
    return "busy"

  return null
}

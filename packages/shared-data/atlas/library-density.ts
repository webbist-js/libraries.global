import {
  atlasCell,
  atlasCellId,
  atlasLongitude,
  atlasInBounds,
  atlasBoundsRanges,
} from "./cells"
import {
  ATLAS_LIMITS,
  type AtlasBounds,
  type AtlasCoordinate,
  type AtlasProjection,
} from "./contracts"

export const ATLAS_DENSITY_VERSION = 1
export const ATLAS_DENSITY_MAX_ZOOM = ATLAS_LIMITS.maxDensityCellZoom
export const ATLAS_DENSITY_OFFSET = 4
export const ATLAS_DENSITY_COLORS = [
  "#ECEBFB",
  "#C2BEEC",
  "#9991DF",
  "#6E65D5",
  "#4338CA",
  "#3730A3",
] as const
/** Recorded libraries per 100 km². Fixed across cameras and filter selections. */
export const ATLAS_DENSITY_BREAKS = [0, 0.1, 1, 5, 20, 100] as const
export type AtlasDensityDetail = "auto" | 6 | 10 | 14 | 18
export interface AtlasDensitySettings {
  view: "smooth" | "grid"
  detail: AtlasDensityDetail
  scale: "fixed" | "local"
  opacity: number
  smoothing: 1 | 2 | 3
}
export const DEFAULT_ATLAS_DENSITY: AtlasDensitySettings = {
  view: "grid",
  detail: "auto",
  scale: "fixed",
  opacity: 0.65,
  smoothing: 2,
}
export interface AtlasDensitySelection {
  id: string
  total: number
  areaKm2: number
  per100Km2: number
  bounds: AtlasBounds
}
export interface AtlasDensityArchive {
  version: typeof ATLAS_DENSITY_VERSION
  url: string
  sha256: string
  archiveBytes: number
  count: number
  maxZoom: 16
}
export interface AtlasLibraryDensity {
  mode: "cells" | "tiles"
  resolution: number
  requestedResolution: number
  coarsened: boolean
  exactTotal: number
  /** Complete counts in whole cells, including a halo outside the viewport. */
  cells: { id: string; total: number }[]
  maxPer100Km2?: number
  archive?: AtlasDensityArchive
}
export function atlasDensityScale(
  data: AtlasLibraryDensity | null,
  scale: AtlasDensitySettings["scale"]
) {
  return scale === "local"
    ? data?.maxPer100Km2 && data.maxPer100Km2 > 0
      ? data.maxPer100Km2
      : 100
    : 100
}
export function atlasDensityResolution(
  zoom: number,
  detail: AtlasDensityDetail = "auto"
) {
  return detail === "auto"
    ? Math.max(
        4,
        Math.min(
          ATLAS_DENSITY_MAX_ZOOM,
          Math.floor(zoom) + ATLAS_DENSITY_OFFSET
        )
      )
    : detail
}
export function atlasDensityCell(
  id: string,
  total: number
): AtlasDensitySelection {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new RangeError("Invalid library density total")
  const { bounds } = atlasCell(id)
  const rad = Math.PI / 180
  const areaKm2 =
    6371.0088 ** 2 *
    (bounds.east - bounds.west) *
    rad *
    (Math.sin(bounds.north * rad) - Math.sin(bounds.south * rad))

  return { id, total, bounds, areaKm2, per100Km2: (total * 100) / areaKm2 }
}
export function atlasDensityGeometry(id: string) {
  const { west, east, south, north } = atlasCell(id).bounds

  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  }
}
/** Snap outward to complete cells, then add a three-cell halo for smoothing.
 * Counts must never be truncated at the viewport or a tile edge. */
export function atlasDensityBounds(
  bbox: AtlasBounds,
  zoom: number
): AtlasBounds {
  const n = 2 ** zoom
  const a = atlasCellId({ lng: bbox.west, lat: bbox.north }, zoom)
    .split("/")
    .map(Number)
  const b = atlasCellId(
    { lng: bbox.east === 180 ? 180 - 1e-9 : bbox.east, lat: bbox.south },
    zoom
  )
    .split("/")
    .map(Number)
  const north = atlasCell(`${zoom}/0/${Math.max(0, a[2]! - 3)}`).bounds.north
  const south = atlasCell(`${zoom}/0/${Math.min(n - 1, b[2]! + 3)}`).bounds
    .south
  const span =
    Math.abs(bbox.east - bbox.west) >= 360 ? n : ((b[1]! - a[1]! + n) % n) + 1
  if (span + 6 >= n) return { west: -180, east: 180, south, north }

  return {
    west: atlasLongitude(((a[1]! - 3) / n) * 360 - 180),
    east: atlasLongitude(((b[1]! + 4) / n) * 360 - 180),
    south,
    north,
  }
}
export function atlasDensityCounts(
  points: readonly AtlasCoordinate[],
  zoom: number
) {
  const counts = new Map<string, number>()
  for (const point of points) {
    const id = atlasCellId(point, zoom)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return [...counts].map(([id, total]) => ({ id, total }))
}
/** Compatibility provider for the complete, older in-memory Atlas catalogue. */
export function atlasDensityFromPoints(
  points: readonly AtlasCoordinate[],
  bbox: AtlasBounds,
  zoom: number,
  detail: AtlasDensityDetail
): AtlasLibraryDensity {
  const requestedResolution = atlasDensityResolution(zoom, detail)
  const exactTotal = points.filter((point) => atlasInBounds(point, bbox)).length
  for (let resolution = requestedResolution; resolution >= 0; resolution--) {
    const bounds = atlasDensityBounds(bbox, resolution)
    const cells = atlasDensityCounts(
      points.filter((point) => atlasInBounds(point, bounds)),
      resolution
    )
    if (cells.length > ATLAS_LIMITS.densityCells) continue
    const maxPer100Km2 = cells.reduce(
      (max, c) =>
        atlasBoundsRanges(bbox).some((b) => {
          const { bounds } = atlasCell(c.id)

          return (
            bounds.west < b.east &&
            bounds.east > b.west &&
            bounds.south < b.north &&
            bounds.north > b.south
          )
        })
          ? Math.max(max, atlasDensityCell(c.id, c.total).per100Km2)
          : max,
      0
    )

    return {
      mode: "cells",
      exactTotal,
      resolution,
      requestedResolution,
      coarsened: resolution !== requestedResolution,
      cells,
      maxPer100Km2,
    }
  }
  throw new Error("Complete library density unavailable")
}
/** Additive index upgrade: staging rebuilds can derive fine cells from older projections. */
export function atlasDensityIndexProjection<T extends Partial<AtlasProjection>>(
  record: T
): T {
  if (
    typeof record.latitude !== "number" ||
    typeof record.longitude !== "number"
  )
    return record

  return {
    ...record,
    ...Object.fromEntries(
      Array.from(
        { length: ATLAS_DENSITY_MAX_ZOOM - ATLAS_LIMITS.maxCellZoom },
        (_, i) => {
          const z = ATLAS_LIMITS.maxCellZoom + 1 + i

          return [
            `atlas_cell_${z}`,
            atlasCellId({ lat: record.latitude!, lng: record.longitude! }, z),
          ]
        }
      )
    ),
  }
}
export function parseAtlasDensitySettings(
  params: URLSearchParams
): AtlasDensitySettings {
  const detail = Number(params.get("densityDetail"))
  const opacity = Number(params.get("densityOpacity"))

  return {
    smoothing: [1, 2, 3].includes(Number(params.get("densitySmoothing")))
      ? (Number(params.get("densitySmoothing")) as 1 | 2 | 3)
      : 2,
    view: params.get("densityView") === "smooth" ? "smooth" : "grid",
    detail: [6, 10, 14, 18].includes(detail)
      ? (detail as AtlasDensityDetail)
      : "auto",
    scale: params.get("densityScale") === "local" ? "local" : "fixed",
    opacity:
      params.has("densityOpacity") &&
      Number.isFinite(opacity) &&
      opacity >= 0.1 &&
      opacity <= 1
        ? opacity
        : DEFAULT_ATLAS_DENSITY.opacity,
  }
}

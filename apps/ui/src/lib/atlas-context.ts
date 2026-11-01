import type { AtlasBounds } from "@repo/shared-data"

export type AtlasContextTheme =
  | "population"
  | "deprivation"
  | "carAccess"
  | "administrative"
export interface AtlasContextRelease {
  id: string
  theme: AtlasContextTheme
  country: string
  name: string
  year: number
  edition: string
  boundary: string
  boundaryDate?: string
  source: string
  sourceUrl: string
  licence: string
  attribution: string
  note: string
  bounds: AtlasBounds
  coverage?: { status: "partial"; gaps: string[] }
  areaCount?: number
  classification?: "source-categories"
  categories?: { value: number; label: string; color: string }[]
  level?: "local" | "regions"
}
export interface AtlasContextArea {
  code: string
  name: string
  value: number | null
  rank?: number
  category?: string
  relativeScore?: number
  households?: number
  withoutCar?: number
  bounds: AtlasBounds
}
export interface AtlasContextPoint {
  area: AtlasContextArea | null
  density?: number | null
}
export const contextTileUrl = (release: AtlasContextRelease) =>
  `/api/atlas/context?kind=tile&release=${encodeURIComponent(release.id)}&z={z}&x={x}&y={y}`

export function parseContextQuery(params: URLSearchParams): URLSearchParams {
  const kind = params.get("kind") ?? "catalogue"
  const allowed: Record<string, string[]> = {
    catalogue: ["kind"],
    tile: ["kind", "release", "z", "x", "y"],
    search: ["kind", "release", "q", "offset"],
    point: ["kind", "release", "lng", "lat"],
    geometry: ["kind", "release"],
  }
  if (
    !allowed[kind] ||
    params.size > 6 ||
    [...params.keys()].some(
      (k) => !allowed[kind]!.includes(k) || params.getAll(k).length !== 1
    )
  )
    throw new RangeError("Invalid context query")
  if (
    kind !== "catalogue" &&
    !/^[a-z0-9-]{1,100}$/.test(params.get("release") ?? "")
  )
    throw new RangeError("Invalid context release")
  if (kind === "tile") {
    const values = ["z", "x", "y"].map((k) => {
      const value = params.get(k) ?? ""
      if (!/^\d{1,5}$/.test(value)) throw new RangeError("Invalid context tile")

      return Number(value)
    })
    if (values[0]! > 14 || values.slice(1).some((v) => v >= 2 ** values[0]!))
      throw new RangeError("Invalid context tile")
  }
  if (kind === "point") {
    for (const [k, max] of [
      ["lng", 180],
      ["lat", 85.1],
    ] as const) {
      const raw = params.get(k)
      if (
        !raw ||
        !/^-?\d{1,3}(?:\.\d{1,8})?$/.test(raw) ||
        Math.abs(Number(raw)) > max
      )
        throw new RangeError("Invalid context point")
    }
  }
  if (
    kind === "search" &&
    ((params.get("q")?.length ?? 0) > 80 ||
      !/^\d{1,5}$/.test(params.get("offset") ?? "0") ||
      Number(params.get("offset") ?? 0) > 40000)
  )
    throw new RangeError("Invalid context search")

  return new URLSearchParams(params)
}

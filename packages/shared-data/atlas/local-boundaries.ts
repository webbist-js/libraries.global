// Server/worker-only subpath: detailed assignment geometry must not enter client bundles.
import boundaries from "./data/local-boundaries.json"

export const atlasLocalBoundaryVersion = boundaries.version
const buckets = new Map<string, typeof boundaries.features>()
let initialized = false
const key = (x: number, y: number) => `${x}:${y}`
const cell = (coordinate: number) => Math.floor(coordinate * 4)
function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!,
      [xj, yj] = ring[j]!
    const cross = (x - xi!) * (yj! - yi!) - (y - yi!) * (xj! - xi!)
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(xi!, xj!) &&
      x <= Math.max(xi!, xj!) &&
      y >= Math.min(yi!, yj!) &&
      y <= Math.max(yi!, yj!)
    )
      return true
    if (
      yi! > y !== yj! > y &&
      x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!
    )
      inside = !inside
  }

  return inside
}

/** One whole reporting unit per coordinate; never divide a district's population by a viewport. */
export function atlasLocalAreaCode(coordinate: {
  lat: number
  lng: number
}): string | null {
  if (
    coordinate.lng < -9 ||
    coordinate.lng > 2 ||
    coordinate.lat < 49 ||
    coordinate.lat > 61
  )
    return null
  if (!initialized) {
    for (const feature of boundaries.features) {
      const b = feature.properties.bounds
      for (let x = cell(b.west); x <= cell(b.east); x++)
        for (let y = cell(b.south); y <= cell(b.north); y++) {
          const k = key(x, y),
            rows = buckets.get(k) ?? []
          rows.push(feature)
          buckets.set(k, rows)
        }
    }
    initialized = true
  }
  for (const feature of buckets.get(
    key(cell(coordinate.lng), cell(coordinate.lat))
  ) ?? []) {
    const b = feature.properties.bounds
    if (
      coordinate.lng < b.west ||
      coordinate.lng > b.east ||
      coordinate.lat < b.south ||
      coordinate.lat > b.north
    )
      continue
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    if (
      polygons.some(
        (polygon: any) =>
          ringContains(polygon[0], coordinate.lng, coordinate.lat) &&
          !polygon
            .slice(1)
            .some((ring: number[][]) =>
              ringContains(ring, coordinate.lng, coordinate.lat)
            )
      )
    )
      return feature.properties.code
  }

  return null
}

/** Analytical area on a sphere in km². Rings use GeoJSON [longitude, latitude].
 * Generated once by the worker; large assignment geometries stay server-side. */
export type AtlasPosition = [number, number]
export type AtlasPolygonGeometry =
  | { type: "Polygon"; coordinates: AtlasPosition[][] }
  | { type: "MultiPolygon"; coordinates: AtlasPosition[][][] }

const RADIUS_KM = 6371.0088
const RAD = Math.PI / 180

function ringArea(ring: AtlasPosition[]): number {
  if (ring.length < 4) throw new RangeError("Invalid polygon ring")
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!,
      b = ring[i + 1]!
    if (
      ![...a, ...b].every(Number.isFinite) ||
      Math.abs(a[0]) > 180 ||
      Math.abs(b[0]) > 180 ||
      Math.abs(a[1]) > 90 ||
      Math.abs(b[1]) > 90
    )
      throw new RangeError("Invalid polygon coordinate")
    let delta = (b[0] - a[0]) * RAD
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    sum += delta * (2 + Math.sin(a[1] * RAD) + Math.sin(b[1] * RAD))
  }
  const first = ring[0]!,
    last = ring.at(-1)!
  if (first[0] !== last[0] || first[1] !== last[1])
    throw new RangeError("Polygon rings must be closed")

  return (Math.abs(sum) * RADIUS_KM ** 2) / 2
}

export function atlasGeometryAreaKm2(geometry: AtlasPolygonGeometry): number {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  let area = 0
  for (const rings of polygons) {
    if (!rings.length) throw new RangeError("Missing polygon shell")
    const shell = ringArea(rings[0]!)
    const holes = rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0)
    if (holes > shell) throw new RangeError("Polygon holes exceed shell")
    area += shell - holes
  }
  if (!Number.isFinite(area) || area <= 0)
    throw new RangeError("Invalid polygon area")

  return area
}

/** Restrict untrusted provider geometry before storing it or sending it to WebGL. */
export function parseAtlasPolygon(
  input: unknown,
  maxPositions = 50000
): AtlasPolygonGeometry {
  const raw = input as AtlasPolygonGeometry
  if (
    !raw ||
    !["Polygon", "MultiPolygon"].includes(raw.type) ||
    !Array.isArray(raw.coordinates)
  )
    throw new RangeError("Expected polygon geometry")
  const polygons = raw.type === "Polygon" ? [raw.coordinates] : raw.coordinates
  let count = 0
  for (const polygon of polygons) {
    if (!validPolygonRings(polygon)) throw new RangeError("Missing polygon")
    for (const ring of polygon) {
      count += validateRing(ring)
      if (count > maxPositions)
        throw new RangeError("Polygon exceeds vertex budget")
      for (const position of ring) validatePosition(position)
    }
  }
  atlasGeometryAreaKm2(raw)

  return raw
}

function validatePosition(position: AtlasPosition) {
  if (
    !Array.isArray(position) ||
    position.length !== 2 ||
    !position.every(Number.isFinite) ||
    Math.abs(position[0]) > 180 ||
    Math.abs(position[1]) > 90
  )
    throw new RangeError("Invalid polygon position")
}

function validPolygonRings(polygon: AtlasPosition[][]) {
  return Array.isArray(polygon) && polygon.length > 0
}

function validateRing(ring: AtlasPosition[]) {
  if (!Array.isArray(ring) || ring.length < 4)
    throw new RangeError("Invalid polygon ring")

  return ring.length
}

import {
  ATLAS_LIMITS,
  type AtlasBounds,
  type AtlasCell,
  type AtlasCellZoom,
  type AtlasCoordinate,
} from "./contracts"

export const ATLAS_MERCATOR_LATITUDE = 85.0511287798066
export const atlasLongitude = (lng: number): number =>
  ((((lng + 180) % 360) + 360) % 360) - 180
const clampLatitude = (lat: number): number =>
  Math.max(-ATLAS_MERCATOR_LATITUDE, Math.min(ATLAS_MERCATOR_LATITUDE, lat))

export function atlasDisplayCoordinate(
  location: unknown
): AtlasCoordinate | null {
  if (!location || typeof location !== "object") return null
  const { lat, lng } = location as { lat?: unknown; lng?: unknown }
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  )
    return null

  return { lat: clampLatitude(lat), lng: atlasLongitude(lng) }
}

/** Disjoint normalized ranges. Stored longitude 180 is normalized to -180. */
export function atlasBoundsRanges(bbox: AtlasBounds): AtlasBounds[] {
  const { west, east, south, north } = bbox
  if (
    ![west, east, south, north].every(Number.isFinite) ||
    south < -90 ||
    north > 90 ||
    south > north
  )
    throw new RangeError("Invalid Atlas bounds")
  const vertical = { south: clampLatitude(south), north: clampLatitude(north) }
  if (Math.abs(east - west) >= 360)
    return [{ west: -180, east: 180, ...vertical }]
  const w = atlasLongitude(west)
  const e = atlasLongitude(east)

  return w <= e
    ? [{ west: w, east: e, ...vertical }]
    : [
        { west: w, east: 180, ...vertical },
        { west: -180, east: e, ...vertical },
      ]
}

export function atlasInBounds(
  point: AtlasCoordinate,
  bbox: AtlasBounds
): boolean {
  return atlasBoundsRanges(bbox).some(
    (range) =>
      point.lat >= range.south &&
      point.lat <= range.north &&
      point.lng >= range.west &&
      point.lng <= range.east
  )
}

function checkZoom(z: number): asserts z is AtlasCellZoom {
  if (!Number.isInteger(z) || z < 0 || z > ATLAS_LIMITS.maxDensityCellZoom)
    throw new RangeError("Invalid Atlas cell resolution")
}
const mercatorY = (lat: number): number => {
  const radians = (clampLatitude(lat) * Math.PI) / 180

  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2
}
const tileLatitude = (y: number, n: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI
const cellIndex = (position: number, n: number): number =>
  Math.max(0, Math.min(n - 1, Math.floor(position * n)))

export function atlasCellId(point: AtlasCoordinate, z: number): string {
  checkZoom(z)
  const n = 2 ** z
  const x = cellIndex((atlasLongitude(point.lng) + 180) / 360, n)
  const y = cellIndex(mercatorY(point.lat), n)

  return `${z}/${x}/${y}`
}

export function atlasCell(id: string): AtlasCell {
  const match = /^(\d+)\/(\d+)\/(\d+)$/.exec(id)
  if (!match) throw new RangeError("Invalid Atlas cell")
  const z = Number(match[1])
  checkZoom(z)
  const n = 2 ** z
  const x = Number(match[2])
  const y = Number(match[3])
  if (x >= n || y >= n) throw new RangeError("Invalid Atlas cell")

  return {
    id,
    bounds: {
      west: (x / n) * 360 - 180,
      east: ((x + 1) / n) * 360 - 180,
      north: tileLatitude(y, n),
      south: tileLatitude(y + 1, n),
    },
    centre: { lng: ((x + 0.5) / n) * 360 - 180, lat: tileLatitude(y + 0.5, n) },
  }
}

/** Calculate cardinality before enumeration, so even a world z12 stays bounded. */
export function atlasCellsForBounds(
  bbox: AtlasBounds,
  z: number,
  budget: number = ATLAS_LIMITS.cells
): { count: number; complete: boolean; cells: AtlasCell[] } {
  checkZoom(z)
  if (
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > ATLAS_LIMITS.facetValues
  )
    throw new RangeError("Invalid Atlas cell budget")
  const ranges = atlasBoundsRanges(bbox)
  const n = 2 ** z
  const vertical = ranges[0]!
  const y0 = cellIndex(mercatorY(vertical.north), n)
  const y1 = cellIndex(mercatorY(vertical.south), n)
  const spans = ranges
    .map(({ west, east }) => ({
      first: cellIndex((west + 180) / 360, n),
      last: cellIndex((east + 180) / 360, n),
    }))
    .sort((a, b) => a.first - b.first)
  const merged: { first: number; last: number }[] = []
  for (const span of spans) {
    const previous = merged.at(-1)
    if (previous && span.first <= previous.last + 1)
      previous.last = Math.max(previous.last, span.last)
    else merged.push({ ...span })
  }
  const count =
    merged.reduce((sum, span) => sum + span.last - span.first + 1, 0) *
    (y1 - y0 + 1)
  if (count > budget) return { count, complete: false, cells: [] }
  const cells: AtlasCell[] = []
  for (const span of merged)
    for (let x = span.first; x <= span.last; x++)
      for (let y = y0; y <= y1; y++) cells.push(atlasCell(`${z}/${x}/${y}`))

  return { count, complete: true, cells }
}

export function atlasAggregation(
  bbox: AtlasBounds,
  budget: number = ATLAS_LIMITS.cells
): { zoom: AtlasCellZoom; cells: AtlasCell[] } {
  let selected = {
    zoom: 0 as AtlasCellZoom,
    cells: atlasCellsForBounds(bbox, 0, budget).cells,
  }
  for (let z = 1; z <= ATLAS_LIMITS.maxCellZoom; z++) {
    const result = atlasCellsForBounds(bbox, z, budget)
    if (!result.complete) break
    selected = { zoom: z as AtlasCellZoom, cells: result.cells }
  }

  return selected
}

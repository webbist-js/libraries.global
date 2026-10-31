import type { AboutGlobeCountry } from "@/components/about/about-globe.types"

type Position = [number, number]
type Ring = Position[]
type Polygon = Ring[]

export type CountryBoundaries = {
  features: {
    properties: { iso3: string }
    geometry:
      | { type: "Polygon"; coordinates: Polygon }
      | { type: "MultiPolygon"; coordinates: Polygon[] }
  }[]
}

type IndexedPolygon = {
  rings: Polygon
  west: number
  east: number
  south: number
  north: number
}

/** Unwrap adjacent longitudes so islands crossing 180° remain small polygons. */
function indexPolygon(polygon: Polygon): IndexedPolygon {
  const rings = polygon.map((ring) => {
    let previous = ring[0]?.[0] ?? 0

    return ring.map(([lng, lat]) => {
      while (lng - previous > 180) lng -= 360
      while (lng - previous < -180) lng += 360
      previous = lng

      return [lng, lat] as Position
    })
  })
  const outer = rings[0] ?? []

  return {
    rings,
    west: Math.min(...outer.map(([lng]) => lng)),
    east: Math.max(...outer.map(([lng]) => lng)),
    south: Math.min(...outer.map(([, lat]) => lat)),
    north: Math.max(...outer.map(([, lat]) => lat)),
  }
}

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i]!
    const [previousX, previousY] = ring[j]!
    if (
      y > lat !== previousY > lat &&
      lng < ((previousX - x) * (lat - y)) / (previousY - y) + x
    )
      inside = !inside
  }

  return inside
}

/** Bounding boxes keep pointer movement cheap; holes and multipolygons matter. */
export function createCountryPicker(
  boundaries: CountryBoundaries,
  countries: readonly AboutGlobeCountry[]
) {
  const byIso = new Map(countries.map((country) => [country.iso3, country]))
  const entries = boundaries.features.flatMap(({ properties, geometry }) => {
    const country = byIso.get(properties.iso3)
    if (!country) return []
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates

    return polygons.map((polygon) => ({ country, ...indexPolygon(polygon) }))
  })

  return (lat: number, lng: number): AboutGlobeCountry | null => {
    for (const entry of entries) {
      if (lat < entry.south || lat > entry.north) continue
      const longitude =
        lng + 360 * Math.round(((entry.west + entry.east) / 2 - lng) / 360)
      if (longitude < entry.west || longitude > entry.east) continue
      if (
        inRing(longitude, lat, entry.rings[0]!) &&
        !entry.rings.slice(1).some((hole) => inRing(longitude, lat, hole))
      )
        return entry.country
    }

    return null
  }
}

export function globeInteractionReady(
  progress: number,
  story: boolean,
  top: number,
  bottom: number,
  viewportHeight: number,
  viewportTop = 56
) {
  return story
    ? progress >= 0.98 && top >= viewportTop && bottom <= viewportHeight + 1
    : top >= viewportTop && bottom <= viewportHeight + 1
}

export type LocalBoundaries = {
  features: {
    properties: { code: string }
    geometry: CountryBoundaries["features"][number]["geometry"]
  }[]
}
export function withUkCountries(
  world: CountryBoundaries,
  local: LocalBoundaries
): CountryBoundaries {
  const countryCode: Record<string, string> = {
    E: "ENG",
    S: "SCT",
    W: "WLS",
    N: "NIR",
  }

  return {
    features: [
      ...world.features,
      ...local.features.flatMap((feature) => {
        const iso3 = countryCode[feature.properties.code[0]!]

        return iso3
          ? [{ properties: { iso3 }, geometry: feature.geometry }]
          : []
      }),
    ],
  }
}

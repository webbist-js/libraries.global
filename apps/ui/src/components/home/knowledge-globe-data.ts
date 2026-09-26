import * as THREE from "three"

export const EARTH_RADIUS = 3.2
export const EARTH_TILT = THREE.MathUtils.degToRad(-23.5)

type Hub = {
  importance: number
  lat: number
  lng: number
  name: string
  phase: number
}

const HUBS: Hub[] = [
  // ── Europe (3 nodes spread across the continent) ─────────────────────────────
  {
    name: "British Library",
    lat: 51.5295,
    lng: -0.1268,
    importance: 0.95,
    phase: 0.15,
  },
  {
    name: "Bibliothèque Nationale de France",
    lat: 48.8339,
    lng: 2.3769,
    importance: 0.92,
    phase: 0.72,
  },
  {
    name: "Austrian National Library",
    lat: 48.2066,
    lng: 16.3667,
    importance: 0.88,
    phase: 1.3,
  },
  // ── North Africa ─────────────────────────────────────────────────────────────
  {
    name: "Bibliotheca Alexandrina",
    lat: 31.2089,
    lng: 29.908,
    importance: 0.9,
    phase: 1.88,
  },
  // ── Middle East ──────────────────────────────────────────────────────────────
  {
    name: "Qatar National Library",
    lat: 25.3169,
    lng: 51.4398,
    importance: 0.85,
    phase: 2.46,
  },
  // ── Southeast Asia ───────────────────────────────────────────────────────────
  {
    name: "National Library of Singapore",
    lat: 1.2966,
    lng: 103.8547,
    importance: 0.82,
    phase: 3.04,
  },
  // ── East Asia ────────────────────────────────────────────────────────────────
  {
    name: "National Library of China",
    lat: 39.9389,
    lng: 116.3124,
    importance: 0.88,
    phase: 3.62,
  },
  {
    name: "National Diet Library",
    lat: 35.6826,
    lng: 139.7469,
    importance: 0.88,
    phase: 4.2,
  },
  // ── Oceania ──────────────────────────────────────────────────────────────────
  {
    name: "State Library of Victoria",
    lat: -37.8122,
    lng: 144.9644,
    importance: 0.82,
    phase: 4.78,
  },
  // ── Southern Africa ──────────────────────────────────────────────────────────
  {
    name: "National Library of South Africa",
    lat: -33.9278,
    lng: 18.4629,
    importance: 0.78,
    phase: 5.36,
  },
  // ── North America — East Coast ───────────────────────────────────────────────
  {
    name: "Library of Congress",
    lat: 38.8892,
    lng: -77.0046,
    importance: 1,
    phase: 5.94,
  },
  // ── North America — West Coast ───────────────────────────────────────────────
  {
    name: "Seattle Public Library",
    lat: 47.6062,
    lng: -122.3321,
    importance: 0.8,
    phase: 0.38,
  },
  // ── Canada ───────────────────────────────────────────────────────────────────
  {
    name: "Library and Archives Canada",
    lat: 45.4255,
    lng: -75.7005,
    importance: 0.78,
    phase: 0.96,
  },
  // ── Central America ──────────────────────────────────────────────────────────
  {
    name: "Jose Vasconcelos Library",
    lat: 19.4448,
    lng: -99.1421,
    importance: 0.78,
    phase: 1.54,
  },
  // ── South America ────────────────────────────────────────────────────────────
  {
    name: "Real Gabinete Português de Leitura",
    lat: -22.9068,
    lng: -43.1813,
    importance: 0.8,
    phase: 2.12,
  },
  {
    name: "El Ateneo Grand Splendid",
    lat: -34.5988,
    lng: -58.3931,
    importance: 0.82,
    phase: 2.7,
  },
]

// Each library has 3–5 connections to varied destinations — mix of regional,
// cross-continental, and trans-ocean arcs to give the globe full coverage.
const CONNECTIONS = [
  // ── British Library (London) ─────────────────────────────────────────────────
  [0, 3], // → Alexandrina (Egypt, 3400 km)
  [0, 4], // → Qatar (5200 km)
  [0, 7], // → Tokyo (9600 km)
  [0, 10], // → Library of Congress (5600 km)

  // ── BnF Paris ────────────────────────────────────────────────────────────────
  [1, 5], // → Singapore (10700 km)
  [1, 9], // → Cape Town (9200 km)
  [1, 14], // → Rio de Janeiro (9200 km)

  // ── Austrian National Library (Vienna) ──────────────────────────────────────
  [2, 6], // → Beijing (6200 km)
  [2, 10], // → Library of Congress (8600 km)
  [2, 14], // → Rio de Janeiro (10000 km)

  // ── Bibliotheca Alexandrina (Egypt) ─────────────────────────────────────────
  [3, 9], // → Cape Town (7200 km)

  // ── Qatar National Library ───────────────────────────────────────────────────
  [4, 5], // → Singapore (5600 km)
  [4, 6], // → Beijing (4900 km)
  [4, 9], // → Cape Town (6500 km)

  // ── Singapore ────────────────────────────────────────────────────────────────
  [5, 7], // → Tokyo (5400 km)
  [5, 8], // → Melbourne (6300 km)
  [5, 11], // → Seattle (12800 km trans-Pacific)
  [5, 13], // → Mexico City (16500 km — circles the globe)

  // ── Beijing ──────────────────────────────────────────────────────────────────
  [6, 11], // → Seattle (8500 km trans-Pacific)
  [6, 12], // → Ottawa (10200 km polar arc)

  // ── Tokyo ────────────────────────────────────────────────────────────────────
  [7, 8], // → Melbourne (8800 km)
  [7, 11], // → Seattle (8300 km trans-Pacific)
  [7, 13], // → Mexico City (11300 km trans-Pacific)

  // ── Melbourne ────────────────────────────────────────────────────────────────
  [8, 11], // → Seattle
  [8, 15], // → Buenos Aires

  // ── Cape Town ────────────────────────────────────────────────────────────────
  [9, 15], // → Buenos Aires (South Atlantic)

  // ── Library of Congress (DC) ─────────────────────────────────────────────────
  [10, 11], // → Seattle (4100 km)
  [10, 13], // → Mexico City (3350 km)

  // ── Seattle ──────────────────────────────────────────────────────────────────
  [11, 13], // → Mexico City (2700 km)

  // ── Ottawa ───────────────────────────────────────────────────────────────────
  [12, 15], // → Buenos Aires (9800 km)

  // ── Mexico City ──────────────────────────────────────────────────────────────
  [13, 14], // → Rio de Janeiro (7500 km)

  // ── Rio de Janeiro ───────────────────────────────────────────────────────────
  [14, 3], // → Alexandrina (8900 km trans-Atlantic to Africa)
] as const

export type GlobeLight = {
  phase: number
  position: THREE.Vector3
  size: number
}

export type ArcRoute = {
  color: string
  curve: THREE.Curve<THREE.Vector3>
  linePoints: THREE.Vector3[]
  phase: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function createSeededRandom(seed: number) {
  return () => {
    seed = Math.trunc(seed)
    seed = Math.trunc(seed + 0x6d2b79f5)
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function latLngToVector3(
  lat: number,
  lng: number,
  radius = EARTH_RADIUS
) {
  const latRad = THREE.MathUtils.degToRad(lat)
  const lngRad = THREE.MathUtils.degToRad(lng)
  const cosLat = Math.cos(latRad)

  return new THREE.Vector3(
    cosLat * Math.sin(lngRad) * radius,
    Math.sin(latRad) * radius,
    cosLat * Math.cos(lngRad) * radius
  )
}

type LatLng = { lat: number; lng: number }

/**
 * Great-circle arc that lifts gently off the surface. The route follows the
 * shortest path over the sphere (slerp), and altitude is a sine bump whose
 * peak scales with angular distance — short regional hops barely clear the
 * surface, trans-ocean routes rise to ~a fifth of the radius. No more
 * quadratic-bezier spikes on short chords.
 */
class GreatCircleArc extends THREE.Curve<THREE.Vector3> {
  private readonly from: THREE.Vector3
  private readonly to: THREE.Vector3
  private readonly angle: number
  private readonly peak: number
  private readonly base: number

  constructor(from: THREE.Vector3, to: THREE.Vector3, base: number) {
    super()
    this.from = from.clone().normalize()
    this.to = to.clone().normalize()
    this.angle = this.from.angleTo(this.to)
    this.base = base
    this.peak = EARTH_RADIUS * ((0.2 * this.angle) / (1 + this.angle * 0.6))
  }

  override getPoint(t: number, target = new THREE.Vector3()) {
    const sinAngle = Math.sin(this.angle)
    if (sinAngle < 1e-6) {
      target.copy(this.from)
    } else {
      target
        .copy(this.from)
        .multiplyScalar(Math.sin((1 - t) * this.angle) / sinAngle)
        .addScaledVector(this.to, Math.sin(t * this.angle) / sinAngle)
    }

    return target
      .normalize()
      .multiplyScalar(this.base + this.peak * Math.sin(Math.PI * t))
  }
}

function createArcCurve(start: LatLng, end: LatLng) {
  return new GreatCircleArc(
    latLngToVector3(start.lat, start.lng, 1),
    latLngToVector3(end.lat, end.lng, 1),
    EARTH_RADIUS + 0.02
  )
}

function createKnowledgeLights() {
  const lights: GlobeLight[] = []

  HUBS.forEach((hub, hubIndex) => {
    const random = createSeededRandom(hubIndex * 113 + 19)
    const count = 4 + Math.round(hub.importance * 7)

    for (let index = 0; index < count; index += 1) {
      const latOffset = (random() - 0.5) * (hub.importance > 0.85 ? 7.5 : 11)
      const lngOffset = (random() - 0.5) * (hub.importance > 0.85 ? 11 : 16)
      const lat = clamp(hub.lat + latOffset, -65, 72)
      const lng = hub.lng + lngOffset

      lights.push({
        phase: hub.phase + index * 0.42,
        position: latLngToVector3(lat, lng, EARTH_RADIUS + 0.011),
        size: 0.018 + random() * 0.015,
      })
    }
  })

  return lights
}

export const HUB_MARKERS: GlobeLight[] = HUBS.map((hub) => ({
  phase: hub.phase,
  position: latLngToVector3(hub.lat, hub.lng, EARTH_RADIUS + 0.014),
  size: 0.03 + hub.importance * 0.016,
}))

export const KNOWLEDGE_LIGHTS = createKnowledgeLights()

/** Arc palette — warm gold with the occasional pale indigo, per the render. */
const ARC_COLORS = [
  "#f2c879", // warm gold
  "#ffe2a8", // pale gold
  "#e8b65a", // deeper gold
  "#f5e3bd", // parchment
  "#c9c2ff", // pale indigo
] as const

function toArcRoute(curve: THREE.Curve<THREE.Vector3>, index: number) {
  return {
    color: ARC_COLORS[index % ARC_COLORS.length]!,
    curve,
    linePoints: curve.getPoints(96),
    phase: (index * 0.137) % 1,
  }
}

export const ARC_ROUTES: ArcRoute[] = CONNECTIONS.map(
  ([startIndex, endIndex], index) =>
    toArcRoute(createArcCurve(HUBS[startIndex]!, HUBS[endIndex]!), index)
)

// ─── Real-data builders ───────────────────────────────────────────────────────
// When the homepage has actual published records, the globe plots those instead
// of the illustrative HUBS/CONNECTIONS above.

export type LibraryMarker = {
  lat: number
  lng: number
  featured?: boolean
}

/**
 * Build globe lights from real library records. Featured records become
 * prominent hub markers; the rest are smaller knowledge lights.
 */
export function buildLibraryLights(markers: LibraryMarker[]): {
  hubs: GlobeLight[]
  lights: GlobeLight[]
} {
  const random = createSeededRandom(41)
  const hubs: GlobeLight[] = []
  const lights: GlobeLight[] = []

  markers.forEach((marker, index) => {
    const light: GlobeLight = {
      phase: (index * 0.61) % (Math.PI * 2),
      position: latLngToVector3(
        marker.lat,
        marker.lng,
        EARTH_RADIUS + (marker.featured ? 0.014 : 0.011)
      ),
      size: marker.featured
        ? 0.038 + random() * 0.008
        : 0.02 + random() * 0.012,
    }
    if (marker.featured) hubs.push(light)
    else lights.push(light)
  })

  return { hubs, lights }
}

/** Each featured library links to this many of its nearest featured peers. */
const ARC_NEIGHBOURS = 2
const ARC_LIMIT = 48
/** ~0.3° — below this two records are effectively the same spot. */
const ARC_MIN_ANGLE = 0.005

/**
 * Build network arcs from real records. Only featured ("pillar") libraries
 * are connected — each to its nearest featured peers. Purely visual for now;
 * one day this could reflect real inter-library loan relationships.
 */
export function buildLibraryArcs(markers: LibraryMarker[]): ArcRoute[] {
  const featured = markers.filter((m) => m.featured)
  if (featured.length < 2) return []

  const directions = featured.map((m) => latLngToVector3(m.lat, m.lng, 1))
  const seen = new Set<string>()
  const routes: ArcRoute[] = []

  directions.forEach((direction, i) => {
    const nearest = directions
      .map((other, j) => ({ j, angle: direction.angleTo(other) }))
      .filter(({ j, angle }) => j !== i && angle > ARC_MIN_ANGLE)
      .sort((x, y) => x.angle - y.angle)
      .slice(0, ARC_NEIGHBOURS)

    nearest.forEach(({ j }) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) return
      seen.add(key)
      routes.push(
        toArcRoute(createArcCurve(featured[i]!, featured[j]!), routes.length)
      )
    })
  })

  return routes.slice(0, ARC_LIMIT)
}

/** Centroid of the plotted records — used to face the data toward the camera. */
export function markersCentroid(markers: LibraryMarker[]): {
  lat: number
  lng: number
} | null {
  if (markers.length === 0) return null
  // Average on the unit sphere so antimeridian-spanning data behaves.
  const sum = markers.reduce(
    (acc, m) => acc.add(latLngToVector3(m.lat, m.lng, 1)),
    new THREE.Vector3()
  )
  if (sum.lengthSq() < 1e-9) return null
  sum.normalize()

  return {
    lat: THREE.MathUtils.radToDeg(Math.asin(sum.y)),
    lng: THREE.MathUtils.radToDeg(Math.atan2(sum.x, sum.z)),
  }
}

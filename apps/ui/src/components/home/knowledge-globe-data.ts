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

function createArcCurve(start: Hub, end: Hub, spreadSeed: number) {
  const startPoint = latLngToVector3(start.lat, start.lng, EARTH_RADIUS + 0.03)
  const endPoint = latLngToVector3(end.lat, end.lng, EARTH_RADIUS + 0.03)

  // Direction from globe centre through the arc midpoint.
  const midpointDirection = startPoint.clone().add(endPoint).normalize()

  // Lateral axis perpendicular to the arc plane — used for visual separation
  // of routes that would otherwise overlap.
  let planeNormal = startPoint.clone().cross(endPoint)
  if (planeNormal.lengthSq() < 1e-6) {
    planeNormal = new THREE.Vector3(0, 1, 0)
  } else {
    planeNormal.normalize()
  }

  const lateralDirection = planeNormal
    .clone()
    .cross(midpointDirection)
    .normalize()

  const random = createSeededRandom(spreadSeed * 97 + 31)

  const chordLength = startPoint.distanceTo(endPoint)
  const distanceFactor = THREE.MathUtils.clamp(
    chordLength / (EARTH_RADIUS * 2.15),
    0.22,
    1
  )

  // For a QuadraticBezierCurve3 the arc peak only reaches ~half the distance
  // to the control point, so the control point must be pushed 2× the desired
  // Shallower arcs that hug the globe surface more closely, matching the
  // reference image aesthetic. Range: 1.14 (short) → 1.38 (long).
  const arcHeightMultiplier = 1.14 + distanceFactor * 0.24

  // Small lateral nudge so adjacent routes don't stack on top of each other.
  const lateralOffset =
    EARTH_RADIUS * (0.008 + random() * 0.018) * (0.3 + distanceFactor * 0.45)
  const lateralSign = spreadSeed % 2 === 0 ? 1 : -1

  // Keep transatlantic routes flatter.
  const isAtlantic =
    (start.name === "London" && end.name === "New York") ||
    (start.name === "New York" && end.name === "London") ||
    (start.name === "Warsaw" && end.name === "New York") ||
    (start.name === "New York" && end.name === "Warsaw")

  const arcHeight =
    EARTH_RADIUS * (arcHeightMultiplier + (isAtlantic ? -0.04 : 0))

  // Single quadratic bezier control point: pushed outward along the midpoint
  // direction to form the arc, plus a tiny lateral nudge for separation.
  // QuadraticBezierCurve3 guarantees smooth tangents at both endpoints.
  const controlPoint = midpointDirection
    .clone()
    .multiplyScalar(arcHeight)
    .add(lateralDirection.clone().multiplyScalar(lateralOffset * lateralSign))

  return new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint)
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

export const ARC_ROUTES: ArcRoute[] = CONNECTIONS.map(
  ([startIndex, endIndex], index) => {
    const curve = createArcCurve(HUBS[startIndex]!, HUBS[endIndex]!, index)

    // Pure white / silver-blue palette — no warm tones, matches the
    // reference image's cool monochromatic style.
    const color = [
      "#e8f4ff", // near-white cool
      "#c8e0ff", // light blue
      "#f0f8ff", // almost white
      "#b8d0f0", // steel blue
      "#d8ecff", // pale sky
      "#a8c8e8", // muted blue
    ][index % 6]!

    return {
      color,
      curve,
      linePoints: curve.getPoints(190),
      phase: index * 0.09,
    }
  }
)

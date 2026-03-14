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
  { name: "Warsaw", lat: 52.2298, lng: 21.0122, importance: 1, phase: 0.15 },
  { name: "London", lat: 51.5072, lng: -0.1276, importance: 0.92, phase: 0.58 },
  {
    name: "New York",
    lat: 40.7128,
    lng: -74.006,
    importance: 0.94,
    phase: 1.1,
  },
  { name: "Lagos", lat: 6.5244, lng: 3.3792, importance: 0.72, phase: 1.82 },
  {
    name: "Nairobi",
    lat: -1.2921,
    lng: 36.8219,
    importance: 0.68,
    phase: 2.35,
  },
  { name: "Delhi", lat: 28.6139, lng: 77.209, importance: 0.9, phase: 2.9 },
  {
    name: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    importance: 0.88,
    phase: 3.4,
  },
  { name: "Tokyo", lat: 35.6764, lng: 139.65, importance: 0.9, phase: 3.92 },
  {
    name: "Sao Paulo",
    lat: -23.5505,
    lng: -46.6333,
    importance: 0.82,
    phase: 4.45,
  },
  {
    name: "Sydney",
    lat: -33.8688,
    lng: 151.2093,
    importance: 0.76,
    phase: 5.08,
  },
  {
    name: "Mexico City",
    lat: 19.4326,
    lng: -99.1332,
    importance: 0.76,
    phase: 5.58,
  },
  {
    name: "Cape Town",
    lat: -33.9249,
    lng: 18.4241,
    importance: 0.72,
    phase: 6.12,
  },
]

// Curated to reduce parallel London fan-out and give the globe cleaner composition.
const CONNECTIONS = [
  [0, 1], // Warsaw → London
  [0, 2], // Warsaw → New York
  [0, 6], // Warsaw → Singapore
  [0, 7], // Warsaw → Tokyo
  [0, 9], // Warsaw → Sydney

  [1, 2], // London → New York
  [1, 3], // London → Lagos
  [1, 8], // London → Sao Paulo
  [1, 11], // London → Cape Town

  [2, 3], // New York → Lagos
  [2, 5], // New York → Delhi
  [2, 8], // New York → Sao Paulo
  [2, 10], // New York → Mexico City

  [3, 6], // Lagos → Singapore
  [4, 6], // Nairobi → Singapore
  [4, 11], // Nairobi → Cape Town

  [5, 6], // Delhi → Singapore
  [5, 7], // Delhi → Tokyo
  [6, 7], // Singapore → Tokyo
  [6, 9], // Singapore → Sydney

  [8, 11], // Sao Paulo → Cape Town

  // Trans-Pacific — gives the Pacific-facing side activity when the globe rotates.
  [7, 2], // Tokyo → New York
  [7, 10], // Tokyo → Mexico City
  [9, 10], // Sydney → Mexico City
  [9, 2], // Sydney → New York

  // South Atlantic crossing — fills the gap between South America and Africa.
  [8, 3], // Sao Paulo → Lagos
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
  // visible lift above the surface. Range: 1.30 (short) → 1.65 (long) gives
  // a visible peak of ~0.5–1.0 units above the globe for a flight-path look.
  const arcHeightMultiplier = 1.3 + distanceFactor * 0.35

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
    EARTH_RADIUS * (arcHeightMultiplier + (isAtlantic ? -0.08 : 0))

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

    const color = ["#c8e0ff", "#d9ebff", "#b8d7f6"][index % 3]!

    return {
      color,
      curve,
      linePoints: curve.getPoints(190),
      phase: index * 0.09,
    }
  }
)

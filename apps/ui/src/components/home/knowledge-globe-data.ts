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

const CONNECTIONS = [
  [0, 1],
  [0, 2],
  [0, 5],
  [0, 6],
  [0, 7],
  [0, 9],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [1, 8],
  [1, 11],
  [2, 3],
  [2, 5],
  [2, 8],
  [2, 10],
  [3, 6],
  [4, 6],
  [4, 11],
  [5, 6],
  [5, 7],
  [6, 7],
  [6, 9],
  [8, 11],
] as const

export type GlobeLight = {
  phase: number
  position: THREE.Vector3
  size: number
}

export type ArcRoute = {
  color: string
  curve: THREE.CatmullRomCurve3
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

function createArcCurve(
  start: Hub,
  end: Hub,
  height: number,
  spreadSeed: number
) {
  const startPoint = latLngToVector3(start.lat, start.lng, EARTH_RADIUS + 0.035)
  const endPoint = latLngToVector3(end.lat, end.lng, EARTH_RADIUS + 0.035)
  const midDirection = startPoint.clone().add(endPoint).normalize()
  const planeNormal = startPoint.clone().cross(endPoint).normalize()
  const lateralDirection = planeNormal.clone().cross(midDirection).normalize()
  const random = createSeededRandom(spreadSeed * 97 + 31)
  const distanceFactor = THREE.MathUtils.clamp(
    startPoint.distanceTo(endPoint) / (EARTH_RADIUS * 2.2),
    0.35,
    1.1
  )
  const lateralSign = random() > 0.5 ? 1 : -1
  const lateralOffset =
    EARTH_RADIUS * (0.08 + random() * 0.14) * distanceFactor * lateralSign

  const controlPointA = startPoint
    .clone()
    .lerp(endPoint, 0.28)
    .normalize()
    .multiplyScalar(EARTH_RADIUS * (height * 0.94))
    .add(lateralDirection.clone().multiplyScalar(lateralOffset * 0.7))

  const controlPointB = startPoint
    .clone()
    .lerp(endPoint, 0.72)
    .normalize()
    .multiplyScalar(EARTH_RADIUS * (height * 1.02))
    .add(lateralDirection.clone().multiplyScalar(lateralOffset))

  return new THREE.CatmullRomCurve3([
    startPoint,
    controlPointA,
    controlPointB,
    endPoint,
  ])
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
    const curve = createArcCurve(
      HUBS[startIndex]!,
      HUBS[endIndex]!,
      1.04 + (index % 4) * 0.03,
      index
    )
    const color = ["#c8e0ff", "#e0eeff", "#a0c8ee"][index % 3]!

    return {
      color,
      curve,
      linePoints: curve.getPoints(44),
      phase: index * 0.09,
    }
  }
)

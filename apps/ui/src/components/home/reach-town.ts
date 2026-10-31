/** A fictional, bounded street network. Units are illustrative, not geographic metres. */
export type TownPoint = { x: number; y: number }
export const TOWN_NODES: Record<string, TownPoint> = {
  a0: { x: 36, y: 70 },
  a1: { x: 111, y: 58 },
  a2: { x: 191, y: 75 },
  a3: { x: 270, y: 60 },
  a4: { x: 346, y: 80 },
  northWest: { x: 390, y: 110 },
  northEast: { x: 440, y: 110 },
  ne1: { x: 505, y: 80 },
  ne2: { x: 575, y: 100 },
  b0: { x: 62, y: 144 },
  b1: { x: 145, y: 140 },
  b2: { x: 226, y: 143 },
  b3: { x: 300, y: 128 },
  b4: { x: 350, y: 145 },
  c0: { x: 37, y: 227 },
  c1: { x: 114, y: 214 },
  c2: { x: 195, y: 218 },
  library: { x: 266, y: 205 },
  c4: { x: 353, y: 214 },
  d0: { x: 51, y: 300 },
  d1: { x: 133, y: 288 },
  d2: { x: 214, y: 291 },
  d3: { x: 285, y: 270 },
  d4: { x: 362, y: 283 },
  southWest: { x: 389, y: 289 },
  southEast: { x: 439, y: 285 },
  eastCentre: { x: 462, y: 210 },
  eastRoad: { x: 560, y: 230 },
  eastUpper: { x: 528, y: 151 },
  eastLower: { x: 510, y: 306 },
  farSE: { x: 575, y: 340 },
  station: { x: 520, y: 370 },
  bottom1: { x: 100, y: 365 },
  bottom2: { x: 203, y: 360 },
  bottom3: { x: 291, y: 345 },
  bottom4: { x: 355, y: 352 },
  church: { x: 319, y: 172 },
  school: { x: 161, y: 95 },
  westLane: { x: -38, y: 242 },
  northLane: { x: 173, y: -14 },
  southLane: { x: 178, y: 428 },
}
const CONNECTIONS = [
  ["a0", "a1"],
  ["a1", "a2"],
  ["a2", "a3"],
  ["a3", "a4"],
  ["a4", "northWest"],
  ["northWest", "northEast"],
  ["northEast", "ne1"],
  ["ne1", "ne2"],
  ["a0", "b0"],
  ["a1", "b1"],
  ["a2", "b2"],
  ["a3", "b3"],
  ["a4", "b4"],
  ["b0", "b1"],
  ["b1", "b2"],
  ["b2", "b3"],
  ["b3", "b4"],
  ["b4", "northWest"],
  ["b0", "c0"],
  ["b1", "c1"],
  ["b2", "c2"],
  ["b3", "library"],
  ["b4", "c4"],
  ["c0", "c1"],
  ["c1", "c2"],
  ["c2", "library"],
  ["library", "c4"],
  ["c0", "d0"],
  ["c1", "d1"],
  ["c2", "d2"],
  ["library", "d3"],
  ["c4", "d4"],
  ["d0", "d1"],
  ["d1", "d2"],
  ["d2", "d3"],
  ["d3", "d4"],
  ["d4", "southWest"],
  ["southWest", "southEast"],
  ["d0", "bottom1"],
  ["d1", "bottom1"],
  ["d2", "bottom2"],
  ["d3", "bottom3"],
  ["d4", "bottom4"],
  ["bottom1", "bottom2"],
  ["bottom2", "bottom3"],
  ["bottom3", "bottom4"],
  ["northEast", "eastUpper"],
  ["eastUpper", "ne2"],
  ["northEast", "eastCentre"],
  ["eastUpper", "eastRoad"],
  ["eastCentre", "eastRoad"],
  ["eastCentre", "southEast"],
  ["eastRoad", "eastLower"],
  ["southEast", "eastLower"],
  ["eastLower", "farSE"],
  ["eastLower", "station"],
  ["library", "church"],
  ["a2", "school"],
  ["c0", "westLane"],
  ["a2", "northLane"],
  ["bottom2", "southLane"],
] as const

export const TOWN_STREETS = CONNECTIONS.map(([from, to]) => ({
  id: `${from}-${to}`,
  from,
  to,
  bridge:
    (from === "northWest" && to === "northEast") ||
    (from === "southWest" && to === "southEast"),
}))
export const townDistance = (a: TownPoint, b: TownPoint) =>
  Math.hypot(b.x - a.x, b.y - a.y)
// This scale puts the fifteen-minute limits along outer roads, rather than
// covering the entire bounded town. These are fictional drawing units.
export const WALK_UNITS_PER_MINUTE = 21

/** Shortest walking distance, constrained to connected streets and the two bridges. */
export function townWalkingDistances() {
  const distances: Record<string, number> = Object.fromEntries(
    Object.keys(TOWN_NODES).map((id) => [id, Infinity])
  )
  distances.library = 0
  const remaining = new Set(Object.keys(TOWN_NODES))
  while (remaining.size) {
    const current = [...remaining].reduce(
      (best, id) => (distances[id]! < distances[best]! ? id : best),
      remaining.values().next().value!
    )
    remaining.delete(current)
    for (const street of TOWN_STREETS) {
      const next =
        street.from === current
          ? street.to
          : street.to === current
            ? street.from
            : null
      if (next && remaining.has(next))
        distances[next] = Math.min(
          distances[next]!,
          distances[current]! +
            townDistance(TOWN_NODES[current]!, TOWN_NODES[next]!)
        )
    }
  }

  return distances
}
const WALK_DISTANCES = townWalkingDistances()
const interpolate = (a: TownPoint, b: TownPoint, t: number): TownPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Partial edge coverage is calculated from either endpoint; it cannot jump a river. */
export function townReach(minutes: number) {
  const budget = minutes * WALK_UNITS_PER_MINUTE

  return TOWN_STREETS.flatMap((street) => {
    const a = TOWN_NODES[street.from]!,
      b = TOWN_NODES[street.to]!,
      length = townDistance(a, b)
    const fromA = Math.max(
      0,
      Math.min(1, (budget - WALK_DISTANCES[street.from]!) / length)
    )
    const fromB = Math.max(
      0,
      Math.min(1, (budget - WALK_DISTANCES[street.to]!) / length)
    )
    if (fromA + fromB >= 1) return [{ id: street.id, from: a, to: b }]

    return [
      ...(fromA > 0
        ? [{ id: street.id + "-a", from: a, to: interpolate(a, b, fromA) }]
        : []),
      ...(fromB > 0
        ? [{ id: street.id + "-b", from: b, to: interpolate(b, a, fromB) }]
        : []),
    ]
  })
}

/** Small footprints align with the roads, with gaps at junctions and along the river. */
export const TOWN_BUILDINGS = TOWN_STREETS.flatMap((street, index) => {
  if (street.bridge) return []
  const a = TOWN_NODES[street.from]!,
    b = TOWN_NODES[street.to]!,
    length = townDistance(a, b),
    dx = (b.x - a.x) / length,
    dy = (b.y - a.y) / length
  const buildings = []
  for (let at = 22; at < length - 16; at += 18) {
    for (const side of [-1, 1]) {
      const x = a.x + dx * at - dy * side * 15,
        y = a.y + dy * at + dx * side * 15
      if ((x > 376 && x < 432) || (x > 150 && x < 201 && y > 154 && y < 199))
        continue
      buildings.push({
        id: `${street.id}-${at}-${side}`,
        x,
        y,
        width: 9 + (index % 4),
        height: 6 + (index % 3),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      })
    }
  }

  return buildings
})

/** Shared Bezier geometry keeps the basemap and catchment riverbanks aligned. */
const RIVER_CURVES = [
  [
    { x: 407, y: -70 },
    { x: 430, y: 49 },
    { x: 386, y: 111 },
    { x: 404, y: 177 },
  ],
  [
    { x: 404, y: 177 },
    { x: 422, y: 243 },
    { x: 424, y: 289 },
    { x: 405, y: 334 },
  ],
  [
    { x: 405, y: 334 },
    { x: 386, y: 379 },
    { x: 401, y: 397 },
    { x: 416, y: 470 },
  ],
] as const

export const TOWN_RIVER_PATH =
  `M${RIVER_CURVES[0][0].x} ${RIVER_CURVES[0][0].y}` +
  RIVER_CURVES.map(
    (curve) =>
      `C${curve
        .slice(1)
        .map((point) => `${point.x} ${point.y}`)
        .join(" ")}`
  ).join(" ")

export function townRiverCenter(y: number) {
  const curve =
    RIVER_CURVES.find((points) => y <= points[3].y) ?? RIVER_CURVES[2]
  const cubic = (t: number, axis: "x" | "y") =>
    (1 - t) ** 3 * curve[0][axis] +
    3 * (1 - t) ** 2 * t * curve[1][axis] +
    3 * (1 - t) * t * t * curve[2][axis] +
    t ** 3 * curve[3][axis]
  let low = 0,
    high = 1
  for (let i = 0; i < 16; i++) {
    const t = (low + high) / 2
    if (cubic(t, "y") < y) low = t
    else high = t
  }

  return cubic((low + high) / 2, "x")
}
function distanceToStreet(point: TownPoint, from: TownPoint, to: TownPoint) {
  const length = townDistance(from, to),
    t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - from.x) * (to.x - from.x) +
          (point.y - from.y) * (to.y - from.y)) /
          (length * length)
      )
    )

  return townDistance(point, interpolate(from, to, t))
}

/** Fictional catchment surface: a connected centre, narrowing into street
 * frontages as the walking budget runs out. No broad buffer at the limits. */
export function townCatchmentContains(minutes: number, point: TownPoint) {
  if (minutes <= 0) return false
  const budget = minutes * WALK_UNITS_PER_MINUTE
  const riverX = townRiverCenter(point.y)
  const inRiver = Math.abs(point.x - riverX) < 15.5
  if (
    inRiver &&
    !TOWN_STREETS.some(
      (street) =>
        street.bridge &&
        distanceToStreet(
          point,
          TOWN_NODES[street.from]!,
          TOWN_NODES[street.to]!
        ) <= 4.5
    )
  )
    return false

  return TOWN_STREETS.some((street) => {
    const a = TOWN_NODES[street.from]!,
      b = TOWN_NODES[street.to]!,
      length = townDistance(a, b)
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
          (length * length)
      )
    )
    const nearest = interpolate(a, b, t),
      frontage = townDistance(point, nearest)
    const walked = Math.min(
      WALK_DISTANCES[street.from]! + t * length,
      WALK_DISTANCES[street.to]! + (1 - t) * length
    )
    if (walked > budget) return false
    // Keep the central blocks joined, but expose the street network at the
    // perimeter: progressively thinner arms instead of one inflated envelope.
    const outerProgress = Math.max(0, (walked / budget - 0.28) / 0.72)
    const streetFrontage = 6 + 34 * (1 - outerProgress) ** 1.6
    if (frontage > (street.bridge ? 6 : streetFrontage)) return false
    if (
      !street.bridge &&
      point.x < riverX !== nearest.x < townRiverCenter(nearest.y)
    )
      return false

    return walked + frontage * 1.4 <= budget
  })
}

/** Trace the occupied surface into filled contours; no corridor strokes or decorative rings. */
export function townCatchmentPath(minutes: number) {
  const step = 5,
    columns = 140,
    rows = 96,
    originX = -45,
    originY = -40
  const occupied = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: columns }, (_, x) =>
      townCatchmentContains(minutes, {
        x: originX + (x + 0.5) * step,
        y: originY + (y + 0.5) * step,
      })
    )
  )
  const edges = new Map<string, string[]>()
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const key = `${x1},${y1}`,
      next = `${x2},${y2}`
    edges.set(key, [...(edges.get(key) ?? []), next])
  }
  occupied.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (filled) {
        if (!occupied[y - 1]?.[x]) add(x, y, x + 1, y)
        if (!occupied[y]?.[x + 1]) add(x + 1, y, x + 1, y + 1)
        if (!occupied[y + 1]?.[x]) add(x + 1, y + 1, x, y + 1)
        if (!occupied[y]?.[x - 1]) add(x, y + 1, x, y)
      }
    })
  )
  const paths: string[] = []
  while (edges.size) {
    const start = edges.keys().next().value!,
      points: TownPoint[] = []
    let key = start
    do {
      const [x, y] = key.split(",").map(Number)
      points.push({ x: originX + x! * step, y: originY + y! * step })
      const next = edges.get(key)?.pop()
      if (!edges.get(key)?.length) edges.delete(key)
      if (!next) break
      key = next
    } while (key !== start)
    const smooth = smoothCatchmentContour(points, step)
    if (smooth.length > 3)
      paths.push(
        `M${smooth.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("L")}Z`
      )
  }

  return paths.join(" ")
}

/** Soften cell corners, then align shoreline vertices with the shared river curve. */
function smoothCatchmentContour(points: TownPoint[], step: number) {
  return points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length]!,
      after = points[(index + 1) % points.length]!
    const smoothed = {
      x: (before.x + point.x * 2 + after.x) / 4,
      y: (before.y + point.y * 2 + after.y) / 4,
    }
    const riverX = townRiverCenter(smoothed.y)
    const bankDistance = Math.abs(smoothed.x - riverX)
    const besideBridge = TOWN_STREETS.some(
      (street) =>
        street.bridge &&
        distanceToStreet(
          smoothed,
          TOWN_NODES[street.from]!,
          TOWN_NODES[street.to]!
        ) < 8
    )
    // Project rasterized shore points onto the actual bank, keeping bridge openings.
    if (Math.abs(bankDistance - 15.5) < step && !besideBridge)
      smoothed.x = riverX + Math.sign(smoothed.x - riverX) * 15.5

    return smoothed
  })
}

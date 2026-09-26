// Pure logic for the Atlas Explorer map: filtering, facet counts, layer
// registry and URL state. No React or MapLibre imports — unit-testable.

// ── Data ────────────────────────────────────────────────────────────────────

/** Properties of one library feature from GET /api/libraries/atlas. */
export interface AtlasLibrary {
  id: string
  name: string
  slug: string
  type: string
  status: string
  operator: string | null
  city: string | null
  country: string | null
  region: string | null
  /** Canonical page path, e.g. /europe/england/norfolk/loddon-library */
  path: string | null
  tz: string | null
  /** 7 arrays (Mon–Sun) of [startMinute, endMinute]; null when hours unknown. */
  hours: number[][][] | null
  founded: number | null
  closed: number | null
  events: boolean
  catalogue: boolean
  access: string[]
  services: string[]
  /** Record completeness, 0–100. */
  complete: number
  lat: number
  lng: number
}

interface AtlasFeature {
  geometry: { coordinates: [number, number] }
  properties: Omit<AtlasLibrary, "lat" | "lng">
}

export function fromFeatureCollection(fc: {
  features?: AtlasFeature[]
}): AtlasLibrary[] {
  return (fc.features ?? []).map((f) => ({
    ...f.properties,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }))
}

// ── Library type groups (filter chips, pin shapes, tints) ───────────────────

export type TypeGroupKey =
  | "public"
  | "academic"
  | "national"
  | "special"
  | "monastic"
  | "other"

/** Pin shape and tint key per group; tint keys match TYPE_TINT. */
export const TYPE_GROUPS: {
  key: TypeGroupKey
  label: string
  tint: "public" | "academic" | "national" | "special" | "neutral"
  types: string[]
}[] = [
  {
    key: "public",
    label: "Public",
    tint: "public",
    types: ["Public", "Municipal", "Mobile"],
  },
  {
    key: "academic",
    label: "Academic",
    tint: "academic",
    types: ["Academic", "University"],
  },
  {
    key: "national",
    label: "National",
    tint: "national",
    types: ["National", "Parliamentary", "State"],
  },
  {
    key: "special",
    label: "Special & archive",
    tint: "special",
    types: ["Special", "Archive", "Private", "Cultural"],
  },
  { key: "monastic", label: "Monastic", tint: "special", types: ["Monastic"] },
  {
    key: "other",
    label: "Other",
    tint: "neutral",
    types: ["Digital", "Other"],
  },
]

export function typeGroupOf(type: string): TypeGroupKey {
  return TYPE_GROUPS.find((g) => g.types.includes(type))?.key ?? "other"
}

// ── Operator groups ─────────────────────────────────────────────────────────

export const OPERATOR_GROUPS: {
  key: string
  label: string
  values: string[]
}[] = [
  {
    key: "council",
    label: "Council",
    values: ["Municipality", "Regional Government"],
  },
  { key: "government", label: "Government", values: ["National Government"] },
  {
    key: "community",
    label: "Community-run",
    values: ["Community Managed", "Volunteer Managed"],
  },
  { key: "university", label: "University", values: ["University"] },
  { key: "religious", label: "Religious", values: ["Religious Institution"] },
  {
    key: "charity",
    label: "Charity or foundation",
    values: ["Private Foundation"],
  },
  { key: "independent", label: "Independent", values: ["Independent"] },
]

function operatorGroupOf(operator: string | null): string | null {
  if (!operator) return null

  return OPERATOR_GROUPS.find((g) => g.values.includes(operator))?.key ?? null
}

// ── Opening hours ───────────────────────────────────────────────────────────

/** Day index 0–6 (Mon–Sun) and minutes since midnight in a timezone. */
export function nowIn(
  tz: string | null,
  now: Date
): { day: number; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz ?? undefined,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      get("weekday")
    )
    const hour = Number.parseInt(get("hour"), 10) % 24

    return { day, minutes: hour * 60 + Number.parseInt(get("minute"), 10) }
  } catch {
    const js = now.getDay()

    return {
      day: js === 0 ? 6 : js - 1,
      minutes: now.getHours() * 60 + now.getMinutes(),
    }
  }
}

export function isOpenAt(
  hours: number[][][] | null,
  day: number,
  minutes: number
): boolean {
  return (hours?.[day] ?? []).some(([s, e]) => minutes >= s! && minutes < e!)
}

/** Open after 19:00 on any day, or open on Sunday. */
export function isOpenLateOrSunday(hours: number[][][] | null): boolean {
  if (!hours) return false
  if ((hours[6] ?? []).length > 0) return true

  return hours.some((d) => d.some(([, e]) => e! > 19 * 60))
}

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60) % 24

  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Joins back-to-back timeframes (e.g. staffed then self-service) into one range. */
export function mergeRanges(ranges: number[][]): number[][] {
  const sorted = [...ranges].sort((a, b) => a[0]! - b[0]!)
  const out: number[][] = []
  for (const [s, e] of sorted) {
    const last = out.at(-1)
    if (last && s! <= last[1]!) last[1] = Math.max(last[1]!, e!)
    else out.push([s!, e!])
  }

  return out
}

export function todayHoursLabel(lib: AtlasLibrary, now: Date): string {
  if (!lib.hours) return "Hours not added yet"
  const { day } = nowIn(lib.tz, now)
  const today = lib.hours[day] ?? []
  if (today.length === 0) return "Closed today"

  return mergeRanges(today)
    .map(([s, e]) => `${formatMinutes(s!)}–${formatMinutes(e!)}`)
    .join(", ")
}

export type OpenNow = "open" | "closed" | "unknown"

export function openNow(lib: AtlasLibrary, now: Date): OpenNow {
  if (!lib.hours) return "unknown"
  const { day, minutes } = nowIn(lib.tz, now)

  return isOpenAt(lib.hours, day, minutes) ? "open" : "closed"
}

// ── Accessibility ───────────────────────────────────────────────────────────

const STEP_FREE = /wheelchair|step[- ]free|level access|ramp|lift/i

export function hasStepFree(lib: AtlasLibrary): boolean {
  return lib.access.some((a) => STEP_FREE.test(a))
}

// ── Filters ─────────────────────────────────────────────────────────────────

export interface AtlasFilters {
  types: TypeGroupKey[]
  opening: "any" | "now" | "at"
  /** Used when opening is "at": day 0–6 (Mon–Sun) and minutes since midnight. */
  atDay: number
  atMinutes: number
  operators: string[]
  /** Accessibility or service names that must all be present. */
  facilities: string[]
  events: boolean
  catalogue: boolean
  /** Inclusive founded-year range, or null for any. */
  founded: [number, number] | null
}

export const EMPTY_FILTERS: AtlasFilters = {
  types: [],
  opening: "any",
  atDay: 6,
  atMinutes: 12 * 60,
  operators: [],
  facilities: [],
  events: false,
  catalogue: false,
  founded: null,
}

export function activeFilterCount(f: AtlasFilters): number {
  return (
    (f.types.length > 0 ? 1 : 0) +
    (f.opening === "any" ? 0 : 1) +
    (f.operators.length > 0 ? 1 : 0) +
    f.facilities.length +
    (f.events ? 1 : 0) +
    (f.catalogue ? 1 : 0) +
    (f.founded ? 1 : 0)
  )
}

/** Libraries shown on the map: permanently closed ones only via the Closures layer. */
export function isListed(lib: AtlasLibrary): boolean {
  return lib.status !== "permanently_closed"
}

export function matches(
  lib: AtlasLibrary,
  f: AtlasFilters,
  now: Date
): boolean {
  if (f.types.length > 0 && !f.types.includes(typeGroupOf(lib.type)))
    return false
  if (f.opening === "now") {
    const { day, minutes } = nowIn(lib.tz, now)
    if (!isOpenAt(lib.hours, day, minutes)) return false
  }
  if (f.opening === "at" && !isOpenAt(lib.hours, f.atDay, f.atMinutes))
    return false
  if (
    f.operators.length > 0 &&
    !f.operators.includes(operatorGroupOf(lib.operator) ?? "")
  )
    return false
  if (f.facilities.length > 0) {
    const has = new Set([...lib.access, ...lib.services])
    if (!f.facilities.every((x) => has.has(x))) return false
  }
  if (f.events && !lib.events) return false
  if (f.catalogue && !lib.catalogue) return false
  if (f.founded) {
    if (lib.founded === null) return false
    if (lib.founded < f.founded[0] || lib.founded > f.founded[1]) return false
  }

  return true
}

export function applyFilters(
  libs: AtlasLibrary[],
  f: AtlasFilters,
  now: Date
): AtlasLibrary[] {
  return libs.filter((l) => isListed(l) && matches(l, f, now))
}

/** Facilities present in the data, most common first, with counts. */
export function facilityOptions(
  libs: AtlasLibrary[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const l of libs) {
    for (const n of new Set([...l.access, ...l.services]))
      counts.set(n, (counts.get(n) ?? 0) + 1)
  }

  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Count of listed libraries matching `f` after applying `patch`. */
export function countWith(
  libs: AtlasLibrary[],
  f: AtlasFilters,
  patch: Partial<AtlasFilters>,
  now: Date
): number {
  const g = { ...f, ...patch }
  let n = 0
  for (const l of libs) if (isListed(l) && matches(l, g, now)) n++

  return n
}

export interface LoosenSuggestion {
  label: string
  patch: Partial<AtlasFilters>
  gain: number
}

/** For the empty state: each active filter, and how many libraries removing it brings back. */
export function loosenSuggestions(
  libs: AtlasLibrary[],
  f: AtlasFilters,
  now: Date
): LoosenSuggestion[] {
  const base = countWith(libs, f, {}, now)
  const options: { label: string; patch: Partial<AtlasFilters> }[] = []
  if (f.opening === "now")
    options.push({ label: "Remove “Open now”", patch: { opening: "any" } })
  if (f.opening === "at")
    options.push({
      label: "Remove the opening time",
      patch: { opening: "any" },
    })
  if (f.types.length > 0)
    options.push({ label: "Include all library types", patch: { types: [] } })
  if (f.operators.length > 0)
    options.push({ label: "Include all operators", patch: { operators: [] } })
  for (const name of f.facilities)
    options.push({
      label: `Remove “${name}”`,
      patch: { facilities: f.facilities.filter((x) => x !== name) },
    })
  if (f.events)
    options.push({
      label: "Remove “Has upcoming events”",
      patch: { events: false },
    })
  if (f.catalogue)
    options.push({
      label: "Remove “Live catalogue link”",
      patch: { catalogue: false },
    })
  if (f.founded)
    options.push({
      label: "Widen founded year to any",
      patch: { founded: null },
    })

  return options
    .map((o) => ({ ...o, gain: countWith(libs, f, o.patch, now) - base }))
    .filter((o) => o.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
}

// ── Layers ──────────────────────────────────────────────────────────────────

export type Tier = "public" | "free" | "pro"

export type LayerId =
  | "density"
  | "openLate"
  | "closures"
  | "access"
  | "events"
  | "complete"
  | "perCapita"
  | "founded"
  | "mobile"
  | "population"
  | "deprivation"
  | "transit"
  | "schools"

export interface LayerDef {
  id: LayerId
  name: string
  sub: string
  group: "libraries" | "context"
  /** Lowest tier that can switch it on. */
  tier: Tier
  /** False until the data or backend exists; shown as "Coming soon". */
  ready: boolean
  /** Layers in the same exclusive group replace each other. */
  exclusive?: "heat" | "pinStyle"
}

export const LAYERS: LayerDef[] = [
  {
    id: "density",
    name: "Library density",
    sub: "Heatmap · all records",
    group: "libraries",
    tier: "public",
    ready: true,
    exclusive: "heat",
  },
  {
    id: "openLate",
    name: "Open late or on Sundays",
    sub: "After 19:00, or any Sunday hours",
    group: "libraries",
    tier: "public",
    ready: true,
  },
  {
    id: "closures",
    name: "Closures",
    sub: "Permanently closed libraries",
    group: "libraries",
    tier: "public",
    ready: true,
  },
  {
    id: "access",
    name: "Step-free access",
    sub: "Where step-free entry is recorded",
    group: "libraries",
    tier: "free",
    ready: true,
    exclusive: "pinStyle",
  },
  {
    id: "events",
    name: "Events density",
    sub: "Libraries with an events feed",
    group: "libraries",
    tier: "free",
    ready: true,
    exclusive: "heat",
  },
  {
    id: "complete",
    name: "Record completeness",
    sub: "How much we know",
    group: "libraries",
    tier: "free",
    ready: true,
    exclusive: "pinStyle",
  },
  {
    id: "perCapita",
    name: "Libraries per 100k people",
    sub: "By council area",
    group: "libraries",
    tier: "pro",
    ready: false,
  },
  {
    id: "founded",
    name: "Founded year",
    sub: "With time slider",
    group: "libraries",
    tier: "pro",
    ready: false,
  },
  {
    id: "mobile",
    name: "Mobile library routes",
    sub: "Lines and stops",
    group: "libraries",
    tier: "public",
    ready: false,
  },
  {
    id: "population",
    name: "Population density",
    sub: "GHSL",
    group: "context",
    tier: "free",
    ready: false,
  },
  {
    id: "deprivation",
    name: "Deprivation",
    sub: "IMD · SIMD · WIMD",
    group: "context",
    tier: "pro",
    ready: false,
  },
  {
    id: "transit",
    name: "Transit stops and lines",
    sub: "OSM · GTFS",
    group: "context",
    tier: "pro",
    ready: false,
  },
  {
    id: "schools",
    name: "Schools",
    sub: "Government registers",
    group: "context",
    tier: "free",
    ready: false,
  },
]

export function layerDef(id: LayerId): LayerDef {
  return LAYERS.find((l) => l.id === id)!
}

const RANK: Record<Tier, number> = { public: 0, free: 1, pro: 2 }

export type LayerAccess = "available" | "signin" | "pro" | "soon"

export function layerAccess(def: LayerDef, tier: Tier): LayerAccess {
  // Don't ask people to sign in for something that doesn't exist yet. Pro
  // layers keep their Pro state; the upsell says Pro isn't available yet.
  if (!def.ready && def.tier !== "pro") return "soon"
  if (RANK[tier] < RANK[def.tier]) return def.tier === "pro" ? "pro" : "signin"
  if (!def.ready) return "soon"

  return "available"
}

/** Turns a layer on, returning the new set and any layer it replaced. */
export function toggleLayer(
  active: LayerId[],
  id: LayerId
): { layers: LayerId[]; replaced: LayerId | null } {
  if (active.includes(id))
    return { layers: active.filter((x) => x !== id), replaced: null }
  const group = layerDef(id).exclusive
  const replaced = group
    ? (active.find((x) => layerDef(x).exclusive === group) ?? null)
    : null

  return {
    layers: [...active.filter((x) => x !== replaced), id],
    replaced,
  }
}

// ── Viewport ────────────────────────────────────────────────────────────────

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export function inBounds(lib: AtlasLibrary, b: Bounds): boolean {
  if (lib.lat < b.south || lib.lat > b.north) return false

  // Bounds can cross the antimeridian (west > east).
  return b.west <= b.east
    ? lib.lng >= b.west && lib.lng <= b.east
    : lib.lng >= b.west || lib.lng <= b.east
}

/** Squared equirectangular distance; enough for sorting by nearness. */
export function distanceSq(
  lib: AtlasLibrary,
  lat: number,
  lng: number
): number {
  const x = (lib.lng - lng) * Math.cos((lat * Math.PI) / 180)
  const y = lib.lat - lat

  return x * x + y * y
}

// ── URL state ───────────────────────────────────────────────────────────────

export interface AtlasUrlState {
  view: { lat: number; lng: number; zoom: number } | null
  filters: AtlasFilters
  layers: LayerId[]
  library: string | null
  list: boolean
  projection: "globe" | "flat"
}

const LAYER_IDS = new Set(LAYERS.map((l) => l.id))
const GROUP_KEYS = new Set(TYPE_GROUPS.map((g) => g.key))
const OPERATOR_KEYS = new Set(OPERATOR_GROUPS.map((g) => g.key))

const csv = (v: string | null) => (v ? v.split(",").filter(Boolean) : [])

export function parseUrlState(params: URLSearchParams): AtlasUrlState {
  const view = csv(params.get("v")).map(Number)
  const founded = csv(params.get("fy")).map(Number)
  const at = csv(params.get("at")).map(Number)
  const opening = params.get("open")

  return {
    view:
      view.length === 3 && view.every(Number.isFinite)
        ? { lat: view[0]!, lng: view[1]!, zoom: view[2]! }
        : null,
    filters: {
      types: csv(params.get("type")).filter((t): t is TypeGroupKey =>
        GROUP_KEYS.has(t as TypeGroupKey)
      ),
      opening: opening === "now" || opening === "at" ? opening : "any",
      atDay: at.length === 2 && at[0]! >= 0 && at[0]! <= 6 ? at[0]! : 6,
      atMinutes:
        at.length === 2 && at[1]! >= 0 && at[1]! < 1440 ? at[1]! : 12 * 60,
      operators: csv(params.get("op")).filter((o) => OPERATOR_KEYS.has(o)),
      facilities: params.getAll("fac"),
      events: params.get("ev") === "1",
      catalogue: params.get("cat") === "1",
      founded:
        founded.length === 2 && founded.every(Number.isFinite)
          ? [founded[0]!, founded[1]!]
          : null,
    },
    layers: csv(params.get("layers")).filter((l): l is LayerId =>
      LAYER_IDS.has(l as LayerId)
    ),
    library: params.get("lib"),
    list: params.get("list") === "1",
    projection: params.get("proj") === "flat" ? "flat" : "globe",
  }
}

export function toUrlParams(s: AtlasUrlState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.view)
    p.set(
      "v",
      [
        s.view.lat.toFixed(4),
        s.view.lng.toFixed(4),
        s.view.zoom.toFixed(2),
      ].join(",")
    )
  const f = s.filters
  if (f.types.length) p.set("type", f.types.join(","))
  if (f.opening !== "any") p.set("open", f.opening)
  if (f.opening === "at") p.set("at", `${f.atDay},${f.atMinutes}`)
  if (f.operators.length) p.set("op", f.operators.join(","))
  for (const x of f.facilities) p.append("fac", x)
  if (f.events) p.set("ev", "1")
  if (f.catalogue) p.set("cat", "1")
  if (f.founded) p.set("fy", f.founded.join(","))
  if (s.layers.length) p.set("layers", s.layers.join(","))
  if (s.library) p.set("lib", s.library)
  if (s.list) p.set("list", "1")
  if (s.projection === "flat") p.set("proj", "flat")

  return p
}

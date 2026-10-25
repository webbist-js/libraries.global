// Pure logic for the Atlas Explorer map: filtering, facet counts, layer
// registry and URL state. No React or MapLibre imports — unit-testable.
import {
  ATLAS_TYPE_GROUPS,
  ATLAS_OPERATOR_GROUPS,
  atlasTypeGroup,
  atlasOperatorGroup,
  type AtlasTypeGroup,
  effectiveLibraryHours,
  noticeLocalDate,
  type LibraryNotice,
  type MobileFrequency,
} from "@repo/shared-data"

// ── Data ────────────────────────────────────────────────────────────────────

/** Properties of one library feature from GET /api/libraries/atlas. */
export interface AtlasLibrary {
  /** Compact server geometry has an ordinary-hours late classification. */
  networkIds?: string[]
  atlasLate?: boolean
  /** Server evaluated effective hours, including Notices, for a bounded row. */
  atlasOpenNow?: OpenNow
  /** Independent published selection may have no building point to draw. */
  mapped?: boolean
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
  staffHours?: number[][][] | null
  hours: number[][][] | null
  notices?: LibraryNotice[]
  closedDates?: string[]
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

export type TypeGroupKey = AtlasTypeGroup

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
    types: [...ATLAS_TYPE_GROUPS.public],
  },
  {
    key: "academic",
    label: "Academic",
    tint: "academic",
    types: [...ATLAS_TYPE_GROUPS.academic],
  },
  {
    key: "national",
    label: "National",
    tint: "national",
    types: [...ATLAS_TYPE_GROUPS.national],
  },
  {
    key: "special",
    label: "Special & archive",
    tint: "special",
    types: [...ATLAS_TYPE_GROUPS.special],
  },
  {
    key: "mobile",
    label: "Mobile",
    tint: "public",
    types: [...ATLAS_TYPE_GROUPS.mobile],
  },
  {
    key: "monastic",
    label: "Monastic",
    tint: "special",
    types: [...ATLAS_TYPE_GROUPS.monastic],
  },
  {
    key: "other",
    label: "Other",
    tint: "neutral",
    types: [...ATLAS_TYPE_GROUPS.other],
  },
]

export function typeGroupOf(type: string): TypeGroupKey {
  return atlasTypeGroup(type)
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
    values: [...ATLAS_OPERATOR_GROUPS.council],
  },
  {
    key: "government",
    label: "Government",
    values: [...ATLAS_OPERATOR_GROUPS.government],
  },
  {
    key: "community",
    label: "Community-run",
    values: [...ATLAS_OPERATOR_GROUPS.community],
  },
  {
    key: "university",
    label: "University",
    values: [...ATLAS_OPERATOR_GROUPS.university],
  },
  {
    key: "religious",
    label: "Religious",
    values: [...ATLAS_OPERATOR_GROUPS.religious],
  },
  {
    key: "charity",
    label: "Charity or foundation",
    values: [...ATLAS_OPERATOR_GROUPS.charity],
  },
  {
    key: "independent",
    label: "Independent",
    values: [...ATLAS_OPERATOR_GROUPS.independent],
  },
]

function operatorGroupOf(operator: string | null): string | null {
  return atlasOperatorGroup(operator)
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
  if (lib.atlasOpenNow !== undefined) return lib.atlasOpenNow
  const date = noticeLocalDate(now, lib.tz)
  const effective = effectiveLibraryHours(null, lib.notices ?? [], date)
  if (effective.closed || lib.closedDates?.includes(date)) return "closed"
  if (effective.hours) {
    const local = nowIn(lib.tz, now)
    const keys = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]
    const day = (effective.hours as any).days?.find(
      (d: any) => d.day === keys[local.day]
    )

    return day?.enabled &&
      day.timeframes?.some((tf: any) => {
        const minutes = (v: string) =>
          Number(v.split(":")[0]) * 60 + Number(v.split(":")[1])

        return (
          minutes(tf.startTime) <= local.minutes &&
          local.minutes < minutes(tf.endTime)
        )
      })
      ? "open"
      : "closed"
  }
  if (!lib.hours) return "unknown"
  const { day, minutes } = nowIn(lib.tz, now)

  return isOpenAt(lib.hours, day, minutes) ? "open" : "closed"
}

// ── Accessibility ───────────────────────────────────────────────────────────

export type AccessibilityView = "matches" | "compare" | "gaps"

/** Highlight recorded accessibility features; an empty selection means any. */
export function hasAccessibility(
  lib: AtlasLibrary,
  selected: string[] = []
): boolean {
  return selected.length
    ? selected.every((name) => lib.access.includes(name))
    : lib.access.length > 0
}

/** Missing positive records do not establish that a feature is absent. */
export function accessibilitySummary(
  libs: AtlasLibrary[],
  selected: string[] = []
) {
  let matches = 0
  let partial = 0
  for (const lib of libs) {
    if (hasAccessibility(lib, selected)) matches += 1
    else if (selected.some((name) => lib.access.includes(name))) partial += 1
  }

  return {
    total: libs.length,
    matches,
    partial,
    unconfirmed: libs.length - matches,
  }
}

/** Shared by map, list and export, so every view has the same population. */
export function accessibilityLibraries(
  libs: AtlasLibrary[],
  selected: string[],
  view: AccessibilityView
): AtlasLibrary[] {
  if (view === "compare") return libs

  return libs.filter(
    (lib) => hasAccessibility(lib, selected) === (view === "matches")
  )
}

export function accessibilityOptions(
  libs: AtlasLibrary[],
  selected: string[] = [],
  catalogue: string[] = []
) {
  const counts = new Map<string, number>(
    [...catalogue, ...selected].map((name) => [name, 0])
  )
  for (const lib of libs.filter(isListed))
    for (const name of new Set(lib.access))
      counts.set(name, (counts.get(name) ?? 0) + 1)

  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Filters ─────────────────────────────────────────────────────────────────

export interface AtlasFilters {
  networks?: string[]
  types: TypeGroupKey[]
  opening: "any" | "now" | "staff_now" | "at"
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
  mobileFrequency?: MobileFrequency[]
  mobileSharesLive?: boolean
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
  mobileFrequency: [],
  mobileSharesLive: false,
}

export function activeFilterCount(f: AtlasFilters): number {
  return (
    (f.networks?.length ? 1 : 0) +
    (f.types.length > 0 ? 1 : 0) +
    (f.opening === "any" ? 0 : 1) +
    (f.operators.length > 0 ? 1 : 0) +
    f.facilities.length +
    (f.events ? 1 : 0) +
    (f.catalogue ? 1 : 0) +
    (f.founded ? 1 : 0) +
    (f.mobileFrequency?.length ? 1 : 0) +
    (f.mobileSharesLive ? 1 : 0)
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
  if (
    f.networks?.length &&
    !f.networks.some((id) => lib.networkIds?.includes(id))
  )
    return false
  if (f.types.length > 0 && !f.types.includes(typeGroupOf(lib.type)))
    return false
  if (f.opening === "staff_now") {
    if (
      !lib.tz ||
      [
        "permanently_closed",
        "temporarily_closed",
        "planned",
        "appointment_only",
      ].includes(lib.status)
    )
      return false
    const { day, minutes } = nowIn(lib.tz, now)
    if (!isOpenAt(lib.staffHours ?? null, day, minutes)) return false
  }
  if (f.opening === "now") {
    if (
      !lib.tz ||
      [
        "permanently_closed",
        "temporarily_closed",
        "planned",
        "appointment_only",
      ].includes(lib.status)
    )
      return false
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

/**
 * The atlas tier for a session plan. Fails closed: only a known paid plan
 * (pro or team) unlocks "pro", and anything unexpected is treated as free.
 */
export function tierForPlan(plan: string | null | undefined): Tier {
  if (plan === "pro" || plan === "team") return "pro"

  return plan === "public" ? "public" : "free"
}

export type LayerId =
  | "pins"
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
  | "carAccess"
  | "transit"
  | "schools"
  | "reach"
  | "coverageGaps"
  | "serviceCoverage"

export type LayerGroup =
  | "locations"
  | "characteristics"
  | "patterns"
  | "coverage"
  | "reference"

export const LAYER_GROUPS: { id: LayerGroup; name: string }[] = [
  { id: "locations", name: "Locations" },
  { id: "characteristics", name: "Library characteristics" },
  { id: "patterns", name: "Patterns and distribution" },
  { id: "coverage", name: "Access and coverage" },
  { id: "reference", name: "Reference geography" },
]

export interface LayerDef {
  id: LayerId
  name: string
  sub: string
  group: LayerGroup
  /** Lowest tier that can switch it on. */
  tier: Tier
  /** False until the data or backend exists; shown as "Coming soon". */
  ready: boolean
  /** Layers in the same exclusive group replace each other. */
  exclusive?: "heat" | "pinStyle" | "area"
  /** Changes the location markers, so their base layer must stay on. */
  requiresPins?: boolean
}

export const LAYERS: LayerDef[] = [
  {
    id: "pins",
    name: "Library locations",
    sub: "Pins and clusters for every record",
    group: "locations",
    tier: "public",
    ready: true,
  },
  {
    id: "mobile",
    name: "Mobile library routes",
    sub: "Lines, stops and live vehicles",
    group: "locations",
    tier: "public",
    ready: true,
  },
  {
    id: "density",
    name: "Library density",
    sub: "Heatmap · all records",
    group: "patterns",
    tier: "public",
    ready: true,
    exclusive: "heat",
  },
  {
    id: "openLate",
    name: "Opening hours",
    sub: "Open after 19:00 or on Sundays",
    group: "characteristics",
    tier: "public",
    ready: true,
    requiresPins: true,
  },
  {
    id: "closures",
    name: "Closed libraries",
    sub: "Recorded permanent closures",
    group: "locations",
    tier: "public",
    ready: true,
  },
  {
    id: "access",
    name: "Accessibility",
    sub: "Choose recorded accessibility features",
    group: "characteristics",
    tier: "free",
    ready: true,
    exclusive: "pinStyle",
    requiresPins: true,
  },
  {
    id: "events",
    name: "Events density",
    sub: "Libraries with an events feed",
    group: "patterns",
    tier: "free",
    ready: true,
    exclusive: "heat",
  },
  {
    id: "complete",
    name: "Record completeness",
    sub: "How much we know",
    group: "characteristics",
    tier: "free",
    ready: true,
    exclusive: "pinStyle",
    requiresPins: true,
  },
  {
    id: "perCapita",
    name: "Library access",
    sub: "Recorded libraries relative to population",
    group: "coverage",
    tier: "pro",
    ready: true,
    exclusive: "area",
  },
  {
    id: "founded",
    name: "Founded year",
    sub: "With time slider",
    group: "characteristics",
    tier: "pro",
    ready: false,
    requiresPins: true,
  },
  {
    id: "reach",
    name: "Travel-time reach",
    sub: "Walking and cycling to a library",
    group: "coverage",
    tier: "pro",
    ready: true,
    requiresPins: true,
  },
  {
    id: "coverageGaps",
    name: "Residents beyond reach",
    sub: "Population outside a chosen travel time",
    group: "coverage",
    tier: "pro",
    ready: false,
    exclusive: "area",
  },
  {
    id: "serviceCoverage",
    name: "Service coverage by area",
    sub: "Recorded facilities and accessibility",
    group: "coverage",
    tier: "pro",
    ready: false,
    exclusive: "area",
  },
  {
    id: "population",
    name: "Population density",
    sub: "Area averages · grid where available",
    group: "reference",
    tier: "free",
    ready: true,
    exclusive: "area",
  },
  {
    id: "deprivation",
    name: "Deprivation",
    sub: "IMD · WIMD · SIMD · NIMDM",
    group: "reference",
    tier: "pro",
    ready: true,
    exclusive: "area",
  },
  {
    id: "carAccess",
    name: "Households without a car",
    sub: "Census 2021 · England and Wales",
    group: "reference",
    tier: "pro",
    ready: true,
    exclusive: "area",
  },
  {
    id: "transit",
    name: "Transit stops and lines",
    sub: "OSM · GTFS",
    group: "reference",
    tier: "pro",
    ready: false,
  },
  {
    id: "schools",
    name: "Schools",
    sub: "Government registers",
    group: "reference",
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
  // Readiness takes priority for every plan: upgrades cannot unlock a feature
  // until its data and renderer exist.
  if (!def.ready) return "soon"
  if (RANK[tier] < RANK[def.tier]) return def.tier === "pro" ? "pro" : "signin"

  return "available"
}

export function pinDependentLayers(active: readonly LayerId[]): LayerDef[] {
  return active.map(layerDef).filter((def) => def.requiresPins)
}

/** Apply after entitlement filtering so unavailable layers cannot force pins on. */
export function withRequiredLibraryLocations(active: LayerId[]): LayerId[] {
  return !active.includes("pins") && pinDependentLayers(active).length
    ? ["pins", ...active]
    : active
}

/** Turns a layer on, returning the new set and any layer it replaced. */
export function toggleLayer(
  active: LayerId[],
  id: LayerId
): { layers: LayerId[]; replaced: LayerId | null } {
  const current = withRequiredLibraryLocations(active)
  if (id === "pins" && pinDependentLayers(current).length)
    return { layers: current, replaced: null }
  if (current.includes(id))
    return { layers: current.filter((x) => x !== id), replaced: null }
  const group = layerDef(id).exclusive
  const replaced = group
    ? (current.find((x) => layerDef(x).exclusive === group) ?? null)
    : null

  return {
    layers: withRequiredLibraryLocations([
      ...current.filter((x) => x !== replaced),
      id,
    ]),
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
  accessibility?: string[]
  accessibilityView?: AccessibilityView
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
      ...(params.has("network")
        ? {
            networks: csv(params.get("network"))
              .filter((id) => /^[a-zA-Z0-9_-]{1,100}$/.test(id))
              .slice(0, 100),
          }
        : {}),
      types: csv(params.get("type")).filter((t): t is TypeGroupKey =>
        GROUP_KEYS.has(t as TypeGroupKey)
      ),
      opening:
        opening === "now" || opening === "staff_now" || opening === "at"
          ? opening
          : "any",
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
      mobileFrequency: csv(params.get("frequency")).filter(
        (value): value is MobileFrequency =>
          ["weekly", "fortnightly", "monthly"].includes(value)
      ),
      mobileSharesLive: params.get("sharesLive") === "1",
    },
    layers: csv(params.has("layers") ? params.get("layers") : "pins")
      .map((layer) => (layer === "libraryAccess" ? "perCapita" : layer))
      .filter((l): l is LayerId => LAYER_IDS.has(l as LayerId)),
    accessibility: [...new Set(params.getAll("access"))]
      .filter((name) => name.length <= 150)
      .slice(0, 100),
    accessibilityView:
      params.get("accessView") === "compare" ||
      params.get("accessView") === "gaps"
        ? (params.get("accessView") as AccessibilityView)
        : "matches",
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
  if (f.networks?.length) p.set("network", f.networks.join(","))
  if (f.types.length) p.set("type", f.types.join(","))
  if (f.opening !== "any") p.set("open", f.opening)
  if (f.opening === "at") p.set("at", `${f.atDay},${f.atMinutes}`)
  if (f.operators.length) p.set("op", f.operators.join(","))
  for (const x of f.facilities) p.append("fac", x)
  if (f.events) p.set("ev", "1")
  if (f.catalogue) p.set("cat", "1")
  if (f.founded) p.set("fy", f.founded.join(","))
  if (f.mobileFrequency?.length) p.set("frequency", f.mobileFrequency.join(","))
  if (f.mobileSharesLive) p.set("sharesLive", "1")
  p.set("layers", s.layers.join(","))
  for (const name of s.accessibility ?? []) p.append("access", name)
  if (s.accessibilityView && s.accessibilityView !== "matches")
    p.set("accessView", s.accessibilityView)
  if (s.library) p.set("lib", s.library)
  if (s.list) p.set("list", "1")
  if (s.projection === "flat") p.set("proj", "flat")

  return p
}

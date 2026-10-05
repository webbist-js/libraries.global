// Pure helpers for the continent / country / region pages (v2).
// No React imports — unit-testable.

import { gapDefinition, gapsOf, type GapRecord } from "@repo/shared-data"

import { distanceKm } from "@/components/index-page/find-helpers"
import {
  DAY_ORDER,
  type OpeningTimesDay,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"

// ── Numbers and words ─────────────────────────────────────────────────────────

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n)
}

/** "1 library", "12 libraries". */
export function countNoun(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural
}

export const toCoord = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number.parseFloat(value) : value

  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/** "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** County → Counties, Region → Regions, Council area → Council areas. */
export function pluralizeLabel(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`

  return `${label}s`
}

/** Counties → County, Regions → Region, Council areas → Council area. */
export function singularizeLabel(label: string): string {
  if (/ies$/i.test(label)) return `${label.slice(0, -3)}y`
  if (/(ss|x|z|ch|sh)es$/i.test(label)) return label.slice(0, -2)
  if (/s$/i.test(label) && !/ss$/i.test(label)) return label.slice(0, -1)

  return label
}

/** Sentence-case a label for use mid-sentence, leaving proper nouns alone. */
export function lowerFirst(label: string): string {
  if (/[A-Z]/.test(label.slice(1))) return label

  return label.charAt(0).toLowerCase() + label.slice(1)
}

export type ChildLabels = {
  /** Title-case singular, e.g. "County": select labels and hero badges. */
  name: string
  /** Section title, e.g. "Counties". */
  plural: string
  /** Mid-sentence singular, e.g. "county". */
  singular: string
}

/** The Place Labels on a Country (UI only; they never change the hierarchy). */
export type PlaceLabelFields = {
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

/**
 * One level's words: the plural label wins, then the singular (pluralised);
 * a mixed singular ("County / Unitary Authority") or nothing falls back.
 */
function levelLabels(
  type: string | null | undefined,
  section: string | null | undefined,
  fallback: "Region" | "Area"
): ChildLabels {
  const plural = section?.trim()
  if (plural) {
    const name = singularizeLabel(plural)

    return { name, plural, singular: lowerFirst(name) }
  }
  const name = type?.trim()
  if (name && !name.includes("/")) {
    return { name, plural: pluralizeLabel(name), singular: lowerFirst(name) }
  }

  return {
    name: fallback,
    plural: `${fallback}s`,
    singular: fallback.toLowerCase(),
  }
}

/** A Region's own Area labels, where its Areas differ from the country's. */
export type AreaLabelFields = Pick<
  PlaceLabelFields,
  "areaTypeLabel" | "areasSectionLabel"
>

/**
 * What a country calls its Regions and its Areas. A Region that names its
 * own Areas (Greater London's boroughs, in a country of districts) wins for
 * the Area level.
 */
export function placeLabels(
  country: PlaceLabelFields | null | undefined,
  region?: AreaLabelFields | null
): {
  region: ChildLabels
  area: ChildLabels
} {
  const areaSource =
    region?.areaTypeLabel?.trim() || region?.areasSectionLabel?.trim()
      ? region
      : country

  return {
    region: levelLabels(
      country?.regionTypeLabel,
      country?.regionsSectionLabel,
      "Region"
    ),
    area: levelLabels(
      areaSource?.areaTypeLabel,
      areaSource?.areasSectionLabel,
      "Area"
    ),
  }
}

// ── Opening hours ─────────────────────────────────────────────────────────────

const DAY_SHORT: Record<(typeof DAY_ORDER)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

const isOpenDay = (day: OpeningTimesDay | undefined): day is OpeningTimesDay =>
  Boolean(day?.enabled && day.timeframes?.length)

const dayTimes = (day: OpeningTimesDay) =>
  day.timeframes.map((tf) => `${tf.startTime}–${tf.endTime}`).join(", ")

/** Runs of consecutive entries sharing a key: [[Mon, Tue], [Thu]]. */
function runsOf<T>(items: readonly (T | null)[], key: (item: T) => string) {
  const runs: T[][] = []
  let current: T[] = []
  let currentKey: string | null = null
  for (const item of items) {
    const k = item === null ? null : key(item)
    if (item !== null && k === currentKey) {
      current.push(item)
      continue
    }
    if (current.length) runs.push(current)
    current = item === null ? [] : [item]
    currentKey = k
  }
  if (current.length) runs.push(current)

  return runs
}

const runLabel = (run: readonly OpeningTimesDay[]) =>
  run.length === 1
    ? DAY_SHORT[run[0]!.day]
    : `${DAY_SHORT[run[0]!.day]}–${DAY_SHORT[run.at(-1)!.day]}`

/**
 * A one-line week: "Mon–Fri 09:00–17:00 · Sat 10:00–13:00". Weeks with more
 * than two different patterns collapse to "Open Mon–Sat · hours vary by day".
 * Null when no hours are recorded.
 */
export function summariseWeek(
  openingTimes: OpeningTimesValue | null | undefined
): string | null {
  const byDay = new Map((openingTimes?.days ?? []).map((d) => [d.day, d]))
  const week = DAY_ORDER.map((key) => {
    const day = byDay.get(key)

    return isOpenDay(day) ? day : null
  })
  if (!week.some(Boolean)) return null

  const patterns = runsOf(week, dayTimes)
  if (patterns.length <= 2) {
    return patterns
      .map((run) => `${runLabel(run)} ${dayTimes(run[0]!)}`)
      .join(" · ")
  }
  const openDays = runsOf(week, () => "open")
    .map(runLabel)
    .join(", ")

  return `Open ${openDays} · hours vary by day`
}

// ── Record gaps ───────────────────────────────────────────────────────────────

const LOCATION_GAPS = ["hours", "photo", "accessibility", "contact"] as const

/** The gaps shown on location pages: the details visitors need first. */
export const GAP_DEFS = LOCATION_GAPS.map((key) => {
  const g = gapDefinition(key)

  return { key, label: g.label, phrase: g.phrase }
})

export type GapKey = (typeof LOCATION_GAPS)[number]

export function recordGaps(library: GapRecord): GapKey[] {
  const gaps = new Set(gapsOf(library))

  return LOCATION_GAPS.filter((k) => gaps.has(k))
}

export const gapLabel = (key: GapKey) =>
  GAP_DEFS.find((g) => g.key === key)!.label

/** "opening hours, a photo and accessibility details". */
export function describeGaps(keys: readonly GapKey[]): string {
  return joinList(keys.map((k) => GAP_DEFS.find((g) => g.key === k)!.phrase))
}

// ── Nearby regions ────────────────────────────────────────────────────────────

type Placed = { center?: { lat: number; lng: number } | null }

/**
 * Siblings for the region page's side card. With a centre for this region:
 * the nearest siblings that have libraries (or the nearest overall when none
 * do). Without one: the siblings with the most libraries.
 */
export function pickNearby<
  T extends Placed & { libraryCount: number; name: string },
>(
  self: { lat: number; lng: number } | null | undefined,
  siblings: readonly T[],
  limit = 4
): { mode: "nearby" | "most"; items: T[] } {
  if (self) {
    const byDistance = siblings
      .filter((s) => s.center)
      .map((s) => ({
        s,
        d: distanceKm(self.lat, self.lng, s.center!.lat, s.center!.lng),
      }))
      .sort((a, b) => a.d - b.d)
      .map(({ s }) => s)
    const withLibraries = byDistance.filter((s) => s.libraryCount > 0)
    const items = (withLibraries.length ? withLibraries : byDistance).slice(
      0,
      limit
    )
    if (items.length) return { mode: "nearby", items }
  }

  return {
    mode: "most",
    items: siblings
      .filter((s) => s.libraryCount > 0)
      .sort(
        (a, b) =>
          b.libraryCount - a.libraryCount || a.name.localeCompare(b.name)
      )
      .slice(0, limit),
  }
}

// ── Map marker grouping ───────────────────────────────────────────────────────

export type ScreenPoint = { id: string; x: number; y: number; weight: number }

export type MarkerGroup = {
  ids: string[]
  x: number
  y: number
  weight: number
}

/**
 * Greedy pixel-space grouping for the hero map: the heaviest point seeds a
 * group and takes every free point within `radius` px of it. The group sits
 * at its members' weighted centre.
 */
export function groupScreenPoints(
  points: readonly ScreenPoint[],
  radius: number
): MarkerGroup[] {
  const free = [...points].sort(
    (a, b) => b.weight - a.weight || a.id.localeCompare(b.id)
  )
  const taken = new Set<string>()
  const groups: MarkerGroup[] = []

  for (const seed of free) {
    if (taken.has(seed.id)) continue
    const members = free.filter(
      (p) =>
        !taken.has(p.id) && Math.hypot(p.x - seed.x, p.y - seed.y) <= radius
    )
    for (const m of members) taken.add(m.id)
    const weight = members.reduce((sum, m) => sum + m.weight, 0)
    const w = (m: ScreenPoint) =>
      weight > 0 ? m.weight / weight : 1 / members.length
    groups.push({
      ids: members.map((m) => m.id),
      x: members.reduce((sum, m) => sum + m.x * w(m), 0),
      y: members.reduce((sum, m) => sum + m.y * w(m), 0),
      weight,
    })
  }

  return groups
}

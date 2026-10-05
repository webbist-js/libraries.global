/**
 * Derived fields the library search index carries so Find libraries can
 * filter, count and sort in Meilisearch instead of loading every record:
 * "open now", the record's gaps, digital collections, checked hours, the
 * stored completeness, and a 1° grid cell for the homepage globe.
 */

import { isGapKey } from "@repo/shared-data"

export const OPEN_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

/** The opening-times normaliser allows six timeframes a day. */
export const OPEN_FRAMES_PER_DAY = 6

/** `open_mon_0_from`: minutes after local midnight on that weekday. */
export const openField = (day: string, frame: number, edge: "from" | "to") =>
  `open_${day.slice(0, 3)}_${frame}_${edge}`

export const OPEN_FIELD_NAMES = OPEN_DAYS.flatMap((day) =>
  Array.from({ length: OPEN_FRAMES_PER_DAY }, (_, n) => [
    openField(day, n, "from"),
    openField(day, n, "to"),
  ]).flat()
)

type Day = { day?: unknown; enabled?: unknown; timeframes?: unknown }
type Timeframe = { startTime?: unknown; endTime?: unknown }

function days(openingTimes: unknown): Day[] {
  const list = (openingTimes as { days?: unknown } | null | undefined)?.days

  return Array.isArray(list) ? (list as Day[]) : []
}

function minutes(hm: unknown): number | null {
  if (typeof hm !== "string") return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const value = Number(m[1]) * 60 + Number(m[2])

  return value <= 1440 ? value : null
}

const optionCount = (value: unknown) =>
  Array.isArray(value) ? value.length : 0

/**
 * Each enabled day's timeframes as minute ranges. Mirrors the Find page's
 * `openStatus`: open when `from <= now < to` on today's weekday; a timeframe
 * that ends before it starts never matches there, so it's left out.
 */
export function openFields(openingTimes: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const day of days(openingTimes)) {
    const key = typeof day.day === "string" ? day.day.toLowerCase() : ""
    if (
      !day.enabled ||
      !(OPEN_DAYS as readonly string[]).includes(key) ||
      !Array.isArray(day.timeframes)
    )
      continue
    let n = 0
    for (const tf of day.timeframes as Timeframe[]) {
      const from = minutes(tf?.startTime)
      const to = minutes(tf?.endTime)
      if (from == null || to == null || to <= from) continue
      if (n >= OPEN_FRAMES_PER_DAY) break
      out[openField(key, n, "from")] = from
      out[openField(key, n, "to")] = to
      n++
    }
  }

  return out
}

/**
 * Legacy fallback for a row not yet backfilled with stored `gaps` (Task 2):
 * the three gaps the Find page's "Needs" filter used to derive inline.
 */
export function libraryNeeds(entry: Record<string, unknown>): string[] {
  const needs: string[] = []
  const hasHours = days(entry.openingTimes).some(
    (d) => d.enabled && optionCount(d.timeframes) > 0
  )
  if (!hasHours) needs.push("hours")
  if (!(entry.heroImage as { url?: unknown } | null | undefined)?.url)
    needs.push("photo")
  if (!optionCount(entry.accessibility) && !optionCount(entry.services))
    needs.push("facilities")

  return needs
}

/** A 1° grid cell, `"52,0"`, for counting libraries per place on the globe. */
export function geoCell(lat: number | null, lng: number | null): string | null {
  // `+ 0` turns -0 into 0, so a cell never reads "52,-0".
  return lat == null || lng == null
    ? null
    : `${Math.round(lat) + 0},${Math.round(lng) + 0}`
}

const seconds = (v: unknown): number | null => {
  if (typeof v !== "string" && !(v instanceof Date)) return null
  const t = new Date(v).getTime()

  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

const VERIFIED_SECTIONS = ["hours", "status", "address", "contact"] as const

/** The stored gaps, or the legacy derivation for a row not yet backfilled. */
function needsOf(entry: Record<string, unknown>): string[] {
  return Array.isArray(entry.gaps)
    ? entry.gaps.filter(isGapKey)
    : libraryNeeds(entry)
}

/** Unix seconds for when the library was created and when each section was last checked. */
export function timestampFields(
  entry: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {}
  const created = seconds(entry.createdAt)
  if (created != null) out.created_ts = created
  const last = seconds(entry.lastVerifiedAt)
  if (last != null) out.last_verified_ts = last
  const map = entry.verifiedSections
  if (map && typeof map === "object" && !Array.isArray(map))
    for (const s of VERIFIED_SECTIONS) {
      const t = seconds((map as Record<string, unknown>)[s])
      if (t != null) out[`verified_${s}_ts`] = t
    }

  return out
}

export const TIMESTAMP_FIELD_NAMES = [
  "created_ts",
  "last_verified_ts",
  ...VERIFIED_SECTIONS.map((s) => `verified_${s}_ts`),
]

export function librarySearchFields(
  entry: Record<string, unknown>,
  lat: number | null,
  lng: number | null
): Record<string, unknown> {
  const cell = geoCell(lat, lng)

  return {
    completeness:
      typeof entry.completeness === "number" ? entry.completeness : 0,
    has_hours: days(entry.openingTimes).length > 0,
    has_iiif:
      typeof entry.iiifEndpoint === "string" &&
      entry.iiifEndpoint.trim() !== "",
    needs: needsOf(entry),
    open_tz:
      typeof entry.timezone === "string" && entry.timezone !== ""
        ? entry.timezone
        : "UTC",
    ...openFields(entry.openingTimes),
    ...(cell ? { geo_cell: cell } : {}),
    ...timestampFields(entry),
  }
}

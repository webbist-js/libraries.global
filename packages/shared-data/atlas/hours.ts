import {
  effectiveLibraryHours,
  effectiveLibraryWeekHours,
  noticeEndDate,
  noticeIsActive,
  noticeLocalDate,
  type LibraryNotice,
} from "../library-notices"
import {
  addDays,
  isCalendarDate,
  localDateTime,
  WEEKDAYS,
} from "../mobile-timetable"
import type {
  AtlasDayShort,
  AtlasOpeningField,
  AtlasOpeningFields,
  AtlasProjection,
} from "./contracts"

export const ATLAS_OPEN_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
export const ATLAS_OPEN_FRAMES_PER_DAY = 10
export const atlasOpenField = (
  day: string,
  frame: number,
  edge: "from" | "to",
  prefix: "open" | "regular_open" = "open"
): AtlasOpeningField =>
  `${prefix}_${day.slice(0, 3) as AtlasDayShort}_${frame}_${edge}`
export const ATLAS_OPEN_FIELD_NAMES = ATLAS_OPEN_DAYS.flatMap((day) =>
  Array.from({ length: ATLAS_OPEN_FRAMES_PER_DAY }, (_, n) => [
    atlasOpenField(day, n, "from"),
    atlasOpenField(day, n, "to"),
  ]).flat()
)
export type AtlasInterval = [number, number]
export type AtlasWeek = AtlasInterval[][]
type Day = { day?: unknown; enabled?: unknown; timeframes?: unknown }
type Timeframe = { startTime?: unknown; endTime?: unknown }

function minute(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minutes = Number(match[2])

  return hour <= 24 && minutes < 60 && (hour < 24 || minutes === 0)
    ? hour * 60 + minutes
    : null
}

/** Shared normalization for Atlas and the existing Find index. */
export function atlasWeeklyIntervals(
  input: unknown,
  strictFrames = false
): AtlasWeek {
  const value = input as { days?: unknown } | null
  const days = Array.isArray(value?.days) ? (value.days as Day[]) : []

  return ATLAS_OPEN_DAYS.map((key) => {
    const intervals: AtlasInterval[] = []
    for (const day of days) {
      if (!day || typeof day !== "object") continue
      if (
        typeof day.day !== "string" ||
        day.day.toLowerCase() !== key ||
        !day.enabled ||
        !Array.isArray(day.timeframes)
      )
        continue
      for (const tf of day.timeframes as Timeframe[]) {
        if (!tf || typeof tf !== "object") continue
        const from = minute(tf.startTime)
        const to = minute(tf.endTime)
        if (from !== null && to !== null && to > from)
          intervals.push([from, to])
      }
    }
    if (strictFrames && intervals.length > ATLAS_OPEN_FRAMES_PER_DAY)
      throw new RangeError(
        "Atlas opening intervals exceed the indexed frame limit"
      )

    return intervals.slice(0, ATLAS_OPEN_FRAMES_PER_DAY)
  })
}

export function atlasOpenFields(input: unknown): Record<string, number> {
  return atlasIntervalFields(atlasWeeklyIntervals(input)) as Record<
    string,
    number
  >
}
export function atlasIntervalFields(
  week: AtlasWeek,
  prefix: "open" | "regular_open" = "open"
): AtlasOpeningFields {
  const fields: AtlasOpeningFields = {}
  ATLAS_OPEN_DAYS.forEach((day, offset) => {
    const intervals = week[offset] ?? []
    if (intervals.length > ATLAS_OPEN_FRAMES_PER_DAY)
      throw new RangeError(
        "Atlas opening intervals exceed the indexed frame limit"
      )
    intervals.forEach(([from, to], n) => {
      fields[atlasOpenField(day, n, "from", prefix)] = from
      fields[atlasOpenField(day, n, "to", prefix)] = to
    })
  })

  return fields
}
export const atlasLateOrSunday = (week: AtlasWeek): boolean =>
  (week[6]?.length ?? 0) > 0 ||
  week.some((day) => day.some(([, to]) => to > 1140))

const zones = new Map<string, string>()

export function atlasTimezone(value: string | null | undefined): string {
  const key = typeof value === "string" && value.length > 0 ? value : "UTC"
  const cached = zones.get(key)
  if (cached) return cached
  let canonical = "UTC"
  try {
    canonical = new Intl.DateTimeFormat("en", {
      timeZone: key,
    }).resolvedOptions().timeZone
  } catch {
    /* Missing/invalid timezones have one server-independent fallback. */
  }
  if (zones.size >= 1024) zones.clear()
  zones.set(key, canonical)

  return canonical
}
export function atlasTimezoneCatalog(): string[] {
  return [
    ...new Set(
      ["UTC", ...Intl.supportedValuesOf("timeZone")].map(atlasTimezone)
    ),
  ].sort()
}

const midnights = new Map<string, string>()
function midnight(date: string, timezone: string, now: Date): string {
  // Calendar dates are monotone even across repeated DST hours and skipped dates.
  const key = `${date}:${timezone}`
  const cached = midnights.get(key)
  if (cached) return cached
  let lower = Math.floor(now.getTime() / 60_000)
  let upper = Math.ceil(Date.parse(`${date}T00:00:00Z`) / 60_000) + 2 * 24 * 60
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (noticeLocalDate(new Date(middle * 60_000), timezone) >= date)
      upper = middle
    else lower = middle + 1
  }

  const result = new Date(lower * 60_000).toISOString()
  if (midnights.size >= 2048) midnights.clear()
  midnights.set(key, result)

  return result
}

export function atlasHoursProjection(
  input: unknown,
  allNotices: readonly LibraryNotice[],
  timezone: string,
  now: Date
): AtlasOpeningFields & {
  late_sunday: boolean
  closed_dates: string[]
  has_hours: boolean
  has_effective_hours: boolean
  effective_week_start: string
  clock_valid_until: string | null
} {
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid Atlas evaluation instant")
  const local = localDateTime(now, timezone)
  const monday = addDays(local.date, -WEEKDAYS.indexOf(local.weekday))
  const nextMonday = addDays(monday, 7)
  const notices = allNotices.filter((notice) => {
    if (notice.endedAt || !["closure", "changed_hours"].includes(notice.type))
      return false
    if (
      !isCalendarDate(notice.from) ||
      (notice.to !== null &&
        (!isCalendarDate(notice.to) || notice.to < notice.from))
    )
      throw new RangeError("Invalid Atlas Notice dates")

    return noticeEndDate(notice) >= monday
  })
  const regular = atlasWeeklyIntervals(input, true)
  const effectiveInput = notices.length
    ? effectiveLibraryWeekHours(input, notices, monday)
    : input
  const effective = notices.length
    ? atlasWeeklyIntervals(effectiveInput, true)
    : regular
  const closed_dates = notices.length
    ? Array.from({ length: 7 }, (_, day) => addDays(monday, day)).filter(
        (date) =>
          notices.some((n) => n.type === "closure" && noticeIsActive(n, date))
      )
    : []
  const boundaries: string[] = []
  for (const notice of notices) {
    const end = noticeEndDate(notice)
    if (notice.from < nextMonday && end >= monday) boundaries.push(nextMonday)
    for (const date of [notice.from, addDays(end, 1)])
      if (date > local.date) boundaries.push(date)
    if (notice.from >= nextMonday) {
      const weekday = (new Date(`${notice.from}T12:00:00Z`).getUTCDay() + 6) % 7
      const noticeMonday = addDays(notice.from, -weekday)
      if (noticeMonday > local.date) boundaries.push(noticeMonday)
    }
  }
  const next = boundaries.sort()[0]

  return {
    ...atlasIntervalFields(regular, "regular_open"),
    ...atlasIntervalFields(effective),
    late_sunday: atlasLateOrSunday(regular),
    closed_dates,
    has_hours: input !== null && input !== undefined,
    has_effective_hours:
      effectiveLibraryHours(input, notices, local.date).hours != null,
    effective_week_start: monday,
    clock_valid_until: next ? midnight(next, timezone, now) : null,
  }
}

export function atlasProjectionOpenAt(
  record: AtlasProjection,
  day: number,
  minutes: number,
  prefix: "open" | "regular_open" = "regular_open"
): boolean {
  const key = ATLAS_OPEN_DAYS[day]
  if (!key || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440)
    return false
  for (let n = 0; n < ATLAS_OPEN_FRAMES_PER_DAY; n++) {
    const from = record[atlasOpenField(key, n, "from", prefix)]
    const to = record[atlasOpenField(key, n, "to", prefix)]
    if (
      from !== undefined &&
      to !== undefined &&
      from <= minutes &&
      minutes < to
    )
      return true
  }

  return false
}

export function atlasProjectionOpenNow(
  record: AtlasProjection,
  now: Date
): boolean {
  if (
    record.clock_valid_until &&
    now.getTime() >= Date.parse(record.clock_valid_until)
  )
    throw new RangeError("Atlas effective opening hours require refresh")
  const local = localDateTime(now, record.open_tz)

  return (
    !record.closed_dates.includes(local.date) &&
    atlasProjectionOpenAt(
      record,
      WEEKDAYS.indexOf(local.weekday),
      local.minute,
      "open"
    )
  )
}

function intervalFilter(
  day: string,
  minutes: number,
  prefix: "open" | "regular_open"
): string {
  return Array.from(
    { length: ATLAS_OPEN_FRAMES_PER_DAY },
    (_, n) =>
      `(${atlasOpenField(day, n, "from", prefix)} <= ${minutes} AND ${atlasOpenField(day, n, "to", prefix)} > ${minutes})`
  ).join(" OR ")
}

export function atlasOpenAtFilter(day: number, minutes: number): string {
  const key = ATLAS_OPEN_DAYS[day]
  if (
    !key ||
    !Number.isInteger(day) ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes >= 1440
  )
    throw new RangeError("Invalid Atlas local opening time")

  return `(${intervalFilter(key, minutes, "regular_open")})`
}
const currentFilters = new Map<string, string>()

export function atlasOpenNowFilter(
  timezones: readonly string[],
  now: Date
): string {
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid Atlas evaluation instant")
  const canonicalZones = [...new Set(timezones.map(atlasTimezone))].sort()
  const cacheKey = `${Math.floor(now.getTime() / 60000)}:${canonicalZones.join(",")}`
  const cached = currentFilters.get(cacheKey)
  if (cached) return cached
  const groups = new Map<
    string,
    { day: string; minute: number; date: string; zones: string[] }
  >()
  for (const zone of canonicalZones) {
    const local = localDateTime(now, zone)
    const key = `${local.date}:${local.weekday}:${local.minute}`
    const group = groups.get(key) ?? {
      day: ATLAS_OPEN_DAYS[WEEKDAYS.indexOf(local.weekday)]!,
      minute: local.minute,
      date: local.date,
      zones: [],
    }
    group.zones.push(zone)
    groups.set(key, group)
  }
  if (groups.size === 0) return "atlas_id < 0"

  const filter = `(${[...groups.values()]
    .map(
      ({ day, minute: m, date, zones: z }) =>
        `(open_tz IN ${JSON.stringify(z)} AND (${intervalFilter(day, m, "open")}) AND NOT closed_dates = ${JSON.stringify(date)})`
    )
    .join(" OR ")})`
  if (currentFilters.size >= 32)
    currentFilters.delete(currentFilters.keys().next().value!)
  currentFilters.set(cacheKey, filter)

  return filter
}

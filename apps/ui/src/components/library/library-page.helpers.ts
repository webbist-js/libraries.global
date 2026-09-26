// Pure helpers for the library detail page (v2).
// No React imports — unit-testable.

export const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type DayKey = (typeof DAY_ORDER)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
}

export interface OpeningTimeframe {
  startTime: string
  endTime: string
  staffing?: string | null
}

export interface OpeningTimesDay {
  day: DayKey
  enabled: boolean
  timeframes: OpeningTimeframe[]
}

export interface OpeningTimesValue {
  version?: number
  days: OpeningTimesDay[]
}

export type OpenState = "open" | "closed" | "unknown"

export interface OpenStatus {
  state: OpenState
  /** Human label, e.g. "Open until 20:00 today", "Closed · opens 09:00 Monday", "Hours not added yet" */
  label: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)

  return (h ?? 0) * 60 + (m ?? 0)
}

/** Current [dayKey, minutesSinceMidnight] in the library's IANA timezone. */
function nowInZone(timezone: string | null | undefined, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone ?? undefined,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? ""
    const dayKey = get("weekday").toLowerCase() as DayKey
    const minutes =
      Number.parseInt(get("hour"), 10) * 60 + Number.parseInt(get("minute"), 10)

    return { dayKey, minutes }
  } catch {
    const jsDay = now.getDay()
    const dayKey = DAY_ORDER[jsDay === 0 ? 6 : jsDay - 1] as DayKey

    return { dayKey, minutes: now.getHours() * 60 + now.getMinutes() }
  }
}

/**
 * Compute the live open/closed status from the opening-times custom field.
 * Returns "unknown" when no usable hours exist.
 */
export function getOpenStatus(
  openingTimes: OpeningTimesValue | null | undefined,
  timezone: string | null | undefined,
  now: Date = new Date()
): OpenStatus {
  const days = openingTimes?.days
  if (!Array.isArray(days) || days.length === 0) {
    return { state: "unknown", label: "Hours not added yet" }
  }
  const hasAny = days.some((d) => d.enabled && d.timeframes?.length > 0)
  if (!hasAny) {
    return { state: "unknown", label: "Hours not added yet" }
  }

  const { dayKey, minutes } = nowInZone(timezone, now)
  const today = days.find((d) => d.day === dayKey)

  if (today?.enabled) {
    for (const tf of today.timeframes ?? []) {
      const start = timeToMinutes(tf.startTime)
      const end = timeToMinutes(tf.endTime)
      if (minutes >= start && minutes < end) {
        return { state: "open", label: `Open until ${tf.endTime} today` }
      }
    }
    // Not open now — is there a later timeframe today?
    const upcoming = (today.timeframes ?? [])
      .filter((tf) => timeToMinutes(tf.startTime) > minutes)
      .sort(
        (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      )[0]
    if (upcoming) {
      return {
        state: "closed",
        label: `Closed · opens ${upcoming.startTime} today`,
      }
    }
  }

  // Find the next open day (up to a week ahead)
  const todayIndex = DAY_ORDER.indexOf(dayKey)
  for (let offset = 1; offset <= 7; offset++) {
    const key = DAY_ORDER[(todayIndex + offset) % 7] as DayKey
    const day = days.find((d) => d.day === key)
    const first = day?.enabled
      ? [...(day.timeframes ?? [])].sort(
          (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        )[0]
      : undefined
    if (first) {
      const dayLabel = offset === 1 ? "tomorrow" : DAY_LABELS[key]

      return {
        state: "closed",
        label: `Closed · opens ${first.startTime} ${dayLabel}`,
      }
    }
  }

  return { state: "closed", label: "Closed" }
}

/** Format one day's timeframes as "09:00–17:00" (multiple joined with ", "). */
export function formatDayTimes(day: OpeningTimesDay | undefined): string {
  if (!day?.enabled || !day.timeframes?.length) return "Closed"

  return day.timeframes.map((tf) => `${tf.startTime}–${tf.endTime}`).join(", ")
}

/** Decimal coordinates → "51.5299° N, 0.1277° W" */
export function formatCoordinates(
  location: { lat?: unknown; lng?: unknown } | null | undefined
): string | null {
  const lat = typeof location?.lat === "number" ? location.lat : null
  const lng = typeof location?.lng === "number" ? location.lng : null
  if (lat == null || lng == null) return null
  const latLabel = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`
  const lngLabel = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}`

  return `${latLabel}, ${lngLabel}`
}

export interface CompletenessSection {
  key: string
  label: string
  filled: boolean
}

/**
 * Record completeness — how many of the core sections have data.
 * Mirrors the POC's "N of M sections documented".
 */
export function computeCompleteness(library: {
  heroImage?: unknown
  openingTimes?: OpeningTimesValue | null
  streetAddress?: string | null
  location?: unknown
  accessibility?: unknown[] | null
  services?: unknown[] | null
  amenities?: unknown[] | null
  description?: unknown
  summary?: string | null
  collectionStats?: unknown[] | null
  foundedYear?: string | null
  openedYear?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
}): { filled: number; total: number; sections: CompletenessSection[] } {
  const hasHours = Boolean(
    library.openingTimes?.days?.some((d) => d.enabled && d.timeframes?.length)
  )
  const sections: CompletenessSection[] = [
    { key: "photo", label: "Photo", filled: Boolean(library.heroImage) },
    { key: "hours", label: "Opening hours", filled: hasHours },
    {
      key: "address",
      label: "Address",
      filled: Boolean(library.streetAddress),
    },
    {
      key: "location",
      label: "Map location",
      filled: Boolean(library.location),
    },
    {
      key: "facilities",
      label: "Accessibility & facilities",
      filled: Boolean(
        library.accessibility?.length ||
        library.services?.length ||
        library.amenities?.length
      ),
    },
    {
      key: "collections",
      label: "Collections",
      filled: Boolean(
        library.summary ||
        (Array.isArray(library.description) && library.description.length) ||
        library.collectionStats?.length
      ),
    },
    {
      key: "history",
      label: "History",
      filled: Boolean(library.foundedYear || library.openedYear),
    },
    {
      key: "contact",
      label: "Contact",
      filled: Boolean(library.website || library.phone || library.email),
    },
  ]
  const filled = sections.filter((s) => s.filled).length

  return { filled, total: sections.length, sections }
}

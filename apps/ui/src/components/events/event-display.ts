import type { EventSearchHit } from "@/lib/meilisearch"

// ── v2 type tints — [bg, fg] pairs aligned with the library-type tint system ──

export const EVENT_TYPE_TINT: Record<string, { bg: string; fg: string }> = {
  talk: { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
  screening: { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
  performance: { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
  workshop: { bg: "var(--tint-academic-bg)", fg: "var(--tint-academic-fg)" },
  storytime: { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" },
  exhibition: { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" },
  tour: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  drop_in: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  book_club: { bg: "#F5EEDC", fg: "#6B5420" },
  reading_group: { bg: "#F5EEDC", fg: "#6B5420" },
  other: { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
}

export function eventTypeTint(type: string) {
  return EVENT_TYPE_TINT[type] ?? EVENT_TYPE_TINT.other!
}

// ── Provider display ──────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  eventbrite: "Eventbrite",
  ticketsource: "TicketSource",
  wegottickets: "WeGotTickets",
  spydus: "Library calendar",
  solus: "Library calendar",
  aspen: "Library calendar",
  ical: "Library calendar",
  custom_ical: "Library calendar",
}

export function providerLabel(provider?: string | null): string {
  if (!provider) return "Library calendar"

  return PROVIDER_LABEL[provider] ?? provider
}

// ── Filters (page-local model for the /events browse page) ────────────────────

export type WhenScope = "any" | "today" | "weekend" | "7d" | "30d"

export type EventsFilters = {
  search: string
  when: WhenScope
  types: string[]
  times: TimeSlot[]
  freeOnly: boolean
}

export const DEFAULT_EVENTS_FILTERS: EventsFilters = {
  search: "",
  when: "any",
  types: [],
  times: [],
  freeOnly: false,
}

export type TimeSlot = "morning" | "afternoon" | "evening" | "allday"

export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  allday: "All day",
}

export function timeSlotOf(hit: EventSearchHit): TimeSlot {
  if (hit.allDay) return "allday"
  const hour = new Date(hit.startTime).getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"

  return "evening"
}

/** The upcoming weekend (through Sunday 23:59). If today is Sat/Sun, that's this weekend. */
function weekendRange(now: Date): [Date, Date] {
  const day = now.getDay() // 0 Sun … 6 Sat
  const from = new Date(now)
  if (day >= 1 && day <= 5) {
    from.setDate(from.getDate() + (6 - day))
    from.setHours(0, 0, 0, 0)
  }
  const end = new Date(from)
  if (end.getDay() === 6) end.setDate(end.getDate() + 1) // Sat → its Sunday
  end.setHours(23, 59, 59, 999)

  return [from, end]
}

export function inWhenScope(
  hit: EventSearchHit,
  when: WhenScope,
  now: Date
): boolean {
  if (when === "any") return true
  const start = new Date(hit.startTime)
  if (when === "today") {
    return start.toDateString() === now.toDateString()
  }
  if (when === "weekend") {
    const [from, to] = weekendRange(now)

    return start >= from && start <= to
  }
  const days = when === "7d" ? 7 : 30
  const to = new Date(now)
  to.setDate(to.getDate() + days)
  to.setHours(23, 59, 59, 999)

  return start <= to
}

export function matchesSearch(hit: EventSearchHit, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return [hit.title, hit.library_name, hit.library_city, hit.eventType]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q))
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** "Tomorrow, Saturday 26 September" / "Today, …" / "Tuesday 29 September" */
export function agendaGroupLabel(dateKey: string, now: Date): string {
  const date = new Date(`${dateKey}T12:00:00`)
  const long = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const that = new Date(date)
  that.setHours(0, 0, 0, 0)
  const diffDays = Math.round((that.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return `Today, ${long}`
  if (diffDays === 1) return `Tomorrow, ${long}`

  return long
}

export function dateKeyOf(hit: EventSearchHit): string {
  const d = new Date(hit.startTime)
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")

  return `${d.getFullYear()}-${month}-${day}`
}

export function groupByDate(
  hits: EventSearchHit[]
): { key: string; events: EventSearchHit[] }[] {
  const groups = new Map<string, EventSearchHit[]>()
  for (const hit of hits) {
    const key = dateKeyOf(hit)
    const list = groups.get(key)
    if (list) list.push(hit)
    else groups.set(key, [hit])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, events]) => ({
      key,
      events: events.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }))
}

/** Path to the library detail page, when the denormalised slugs allow it. */
export function libraryPathOf(hit: EventSearchHit): string | null {
  if (
    hit.library_continent_slug &&
    hit.library_country_slug &&
    hit.library_region_slug &&
    hit.library_slug
  ) {
    return `/${hit.library_continent_slug}/${hit.library_country_slug}/${hit.library_region_slug}/${hit.library_slug}`
  }

  return null
}

/** Google Calendar template link — per-event "Add to calendar" without a backend. */
export function addToCalendarUrl(hit: EventSearchHit): string {
  const start = new Date(hit.startTime)
  const end = hit.endTime
    ? new Date(hit.endTime)
    : new Date(start.getTime() + 60 * 60 * 1000)
  const fmt = (d: Date) =>
    `${d.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: hit.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${hit.url}`,
    location: [hit.library_name, hit.library_city].filter(Boolean).join(", "),
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

"use client"

import { Icon } from "@iconify/react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LibraryEvent {
  documentId: string
  title: string
  summary?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  status: string
  tags?: string[] | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  talk: "Talk",
  exhibition: "Exhibition",
  storytime: "Storytime",
  book_club: "Book Club",
  workshop: "Workshop",
  tour: "Tour",
  screening: "Screening",
  reading_group: "Reading Group",
  performance: "Performance",
  drop_in: "Drop-in",
  other: "Event",
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  talk: "mdi:microphone-outline",
  exhibition: "mdi:image-frame",
  storytime: "mdi:book-open-page-variant-outline",
  book_club: "mdi:book-multiple-outline",
  workshop: "mdi:laptop",
  tour: "mdi:map-marker-path",
  screening: "mdi:film-outline",
  reading_group: "mdi:account-group-outline",
  performance: "mdi:music-note-outline",
  drop_in: "mdi:calendar-check-outline",
  other: "mdi:calendar-blank-outline",
}

function formatEventDate(
  startTime: string,
  endTime?: string | null,
  allDay?: boolean
): string {
  const start = new Date(startTime)

  const datePart = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  if (allDay) return datePart

  const timePart = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  if (endTime) {
    const end = new Date(endTime)
    const endTimePart = end.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    return `${datePart} · ${timePart}–${endTimePart}`
  }

  return `${datePart} · ${timePart}`
}

function formatDayNum(startTime: string): string {
  return new Date(startTime).toLocaleDateString("en-GB", { day: "numeric" })
}

function formatMonth(startTime: string): string {
  return new Date(startTime)
    .toLocaleDateString("en-GB", { month: "short" })
    .toUpperCase()
}

// ── Event Card ─────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: LibraryEvent }) {
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? "Event"
  const typeIcon =
    EVENT_TYPE_ICONS[event.eventType] ?? "mdi:calendar-blank-outline"

  const priceLabel = event.isFree
    ? "Free"
    : event.priceMin != null
      ? event.priceMax != null && event.priceMax !== event.priceMin
        ? `£${event.priceMin}–£${event.priceMax}`
        : `£${event.priceMin}`
      : "Ticketed"

  return (
    <Link
      href={`/events/${event.documentId}`}
      className="group flex items-stretch gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 transition-all duration-200 hover:border-(--t-border-hi) hover:bg-(--t-bg-deep)"
      style={{ textDecoration: "none" }}
    >
      {/* Date block */}
      <div
        className="flex shrink-0 flex-col items-center justify-center rounded-xl p-3"
        style={{
          background: "rgba(127,223,255,0.06)",
          border: "1px solid rgba(127,223,255,0.12)",
          minWidth: "52px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.serif,
            fontSize: "24px",
            lineHeight: 1,
            color: T.accent.aurora,
            fontWeight: 600,
          }}
        >
          {formatDayNum(event.startTime)}
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.low,
            marginTop: "3px",
          }}
        >
          {formatMonth(event.startTime)}
        </span>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <p
            className="truncate text-sm leading-snug font-medium transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
            style={{ color: T.ink.base }}
          >
            {event.title}
          </p>
          {event.summary ? (
            <p
              className="mt-0.5 line-clamp-1 text-[12px]"
              style={{ color: T.ink.low }}
            >
              {event.summary}
            </p>
          ) : null}
          <p
            className="mt-1.5 text-[11px]"
            style={{ color: T.ink.faint, fontFamily: T.font.mono }}
          >
            {formatEventDate(event.startTime, event.endTime, event.allDay)}
          </p>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Type chip */}
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.low,
              borderColor: T.border.line,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Icon icon={typeIcon} className="size-2.5 shrink-0" />
            {typeLabel}
          </span>

          {/* Free / price chip */}
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: event.isFree ? T.accent.ok : T.accent.ember,
              borderColor: event.isFree
                ? "rgba(142,240,179,0.18)"
                : "rgba(255,184,138,0.18)",
              background: event.isFree
                ? "rgba(142,240,179,0.06)"
                : "rgba(255,184,138,0.06)",
            }}
          >
            {priceLabel}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex shrink-0 items-center self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Icon
          icon="mdi:arrow-top-right"
          className="size-4 text-(--t-accent-aurora)"
        />
      </div>
    </Link>
  )
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

const FILTER_TYPES = [
  { value: "", label: "All" },
  { value: "talk", label: "Talks" },
  { value: "workshop", label: "Workshops" },
  { value: "storytime", label: "Storytime" },
  { value: "book_club", label: "Book Clubs" },
  { value: "exhibition", label: "Exhibitions" },
  { value: "performance", label: "Performances" },
  { value: "screening", label: "Screenings" },
  { value: "reading_group", label: "Reading Groups" },
  { value: "tour", label: "Tours" },
  { value: "drop_in", label: "Drop-ins" },
]

// ── Main Component ─────────────────────────────────────────────────────────────

interface LibraryEventsProps {
  readonly entityRef: string | null | undefined
}

export function LibraryEvents({ entityRef }: LibraryEventsProps) {
  const [events, setEvents] = useState<LibraryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState("")
  const [freeOnly, setFreeOnly] = useState(false)

  useEffect(() => {
    if (!entityRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)

      return
    }

    setLoading(true)

    setError(null)

    const params = new URLSearchParams({ limit: "50" })
    if (typeFilter) params.set("type", typeFilter)
    if (freeOnly) params.set("isFree", "true")

    fetch(
      `/api/public-proxy/api/events/library/${encodeURIComponent(entityRef)}?${params}`
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)

        return r.json() as Promise<LibraryEvent[]>
      })
      .then((data) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load events")
        setLoading(false)
      })
  }, [entityRef, typeFilter, freeOnly])

  // ── Filter chips that have results ──────────────────────────────────────────
  const presentTypes = new Set(events.map((e) => e.eventType))
  const activeFilters = FILTER_TYPES.filter(
    (f) => f.value === "" || presentTypes.has(f.value)
  )

  // ── Filtered list (type filter applied client-side for instant feedback after
  //    initial load; server also filters for the initial fetch)
  const displayed = typeFilter
    ? events.filter((e) => e.eventType === typeFilter)
    : events

  return (
    <div>
      {/* Section header */}
      <div
        className="mb-6 flex items-center gap-3"
        style={{
          borderBottom: `1px solid ${T.border.line}`,
          paddingBottom: "16px",
        }}
      >
        <Icon
          icon="mdi:calendar-month-outline"
          className="size-4 text-(--t-ink-faint)"
        />
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Upcoming Events
        </span>
        {!loading && events.length > 0 ? (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.ghost,
            }}
          >
            {events.length}
          </span>
        ) : null}
      </div>

      {/* Filter bar */}
      {!loading && events.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className="rounded-full border px-3 py-1 text-[11px] transition-all duration-150"
              style={{
                fontFamily: T.font.mono,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                background:
                  typeFilter === f.value
                    ? "rgba(127,223,255,0.12)"
                    : "transparent",
                borderColor:
                  typeFilter === f.value
                    ? "rgba(127,223,255,0.35)"
                    : T.border.line,
                color: typeFilter === f.value ? T.accent.aurora : T.ink.low,
              }}
            >
              {f.label}
            </button>
          ))}

          <div
            className="ml-auto"
            style={{
              borderLeft: `1px solid ${T.border.line}`,
              paddingLeft: "10px",
            }}
          >
            <button
              type="button"
              onClick={() => setFreeOnly((v) => !v)}
              className="rounded-full border px-3 py-1 text-[11px] transition-all duration-150"
              style={{
                fontFamily: T.font.mono,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                background: freeOnly ? "rgba(142,240,179,0.1)" : "transparent",
                borderColor: freeOnly ? "rgba(142,240,179,0.3)" : T.border.line,
                color: freeOnly ? T.accent.ok : T.ink.low,
              }}
            >
              Free only
            </button>
          </div>
        </div>
      ) : null}

      {/* States */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Loading events…
          </span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <Icon
            icon="mdi:calendar-remove-outline"
            className="size-8 text-(--t-ink-ghost)"
          />
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              color: T.ink.faint,
            }}
          >
            Could not load events
          </p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Icon
            icon="mdi:calendar-blank-outline"
            className="size-10 text-(--t-ink-ghost)"
          />
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "18px",
              color: T.ink.dim,
            }}
          >
            No upcoming events
          </p>
          <p
            className="max-w-xs text-center text-sm"
            style={{ color: T.ink.faint }}
          >
            {typeFilter
              ? "No events of this type are currently scheduled."
              : "This library hasn't listed any upcoming events yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {displayed.map((event) => (
            <EventCard key={event.documentId} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

LibraryEvents.displayName = "LibraryEvents"

export default LibraryEvents

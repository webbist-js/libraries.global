"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { FilterState } from "@/components/events/EventsFilterBar"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { T } from "@/lib/design-tokens"

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimelineEvent {
  documentId: string
  title: string
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
  libraryEntityRef?: string | null
  status: string
}

// ── Date Scroll Picker ─────────────────────────────────────────────────────────

function buildDays(count = 7): Date[] {
  const days: Date[] = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(d)
  }

  return days
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function DateScrollPicker({
  selected,
  onSelect,
  count = 7,
}: {
  selected: Date
  onSelect: (d: Date) => void
  count?: number
}) {
  const days = buildDays(count)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {days.map((d) => {
        const isToday = d.getTime() === today.getTime()
        const isSelected = d.getTime() === selected.getTime()

        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onSelect(d)}
            className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2.5 transition-all duration-150"
            style={{
              background: isSelected
                ? "rgba(127,223,255,0.12)"
                : isToday
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
              border: isSelected
                ? "1px solid rgba(127,223,255,0.3)"
                : `1px solid ${T.border.line}`,
              minWidth: "44px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: isSelected ? T.accent.aurora : T.ink.ghost,
              }}
            >
              {DAY_LABELS[d.getDay()]}
            </span>
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "18px",
                lineHeight: 1.2,
                color: isSelected
                  ? T.accent.aurora
                  : isToday
                    ? T.ink.base
                    : T.ink.dim,
                fontWeight: 400,
                marginTop: "2px",
              }}
            >
              {d.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Timeline Row ───────────────────────────────────────────────────────────────

function TimelineRow({ event }: { event: TimelineEvent }) {
  const start = new Date(event.startTime)
  const end = event.endTime ? new Date(event.endTime) : null

  const startLabel = event.allDay
    ? "All day"
    : start.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
  const endLabel = end
    ? end.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null

  const linkUrl = event.registrationUrl ?? event.url

  return (
    <div
      className="group flex items-stretch gap-4 border-b py-4"
      style={{ borderColor: T.border.line }}
    >
      {/* Time column */}
      <div
        className="w-20 shrink-0 pt-0.5 text-right"
        style={{ fontFamily: T.font.mono }}
      >
        <p style={{ fontSize: "12px", color: T.ink.dim }}>{startLabel}</p>
        {endLabel ? (
          <p style={{ fontSize: "10px", color: T.ink.ghost, marginTop: "2px" }}>
            {endLabel}
          </p>
        ) : null}
      </div>

      {/* Type colour bar */}
      <div
        className="w-0.5 shrink-0 self-stretch rounded-full"
        style={{
          background:
            event.eventType === "talk"
              ? "#a390ff"
              : event.eventType === "storytime" ||
                  event.eventType === "book_club"
                ? "#ffb88a"
                : event.eventType === "workshop" ||
                    event.eventType === "drop_in"
                  ? "#8ef0b3"
                  : event.eventType === "exhibition"
                    ? "#7fdfff"
                    : "rgba(255,255,255,0.12)",
        }}
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeChip type={event.eventType} size="xs" />
          {event.libraryEntityRef ? (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".1em",
                color: T.ink.ghost,
              }}
            >
              {event.libraryEntityRef}
            </span>
          ) : null}
        </div>
        <a
          href={`/events/${event.documentId}`}
          className="text-sm leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: T.ink.base,
            textDecoration: "none",
          }}
        >
          {event.title}
        </a>
      </div>

      {/* Right: price + CTA */}
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <PriceBadge
          isFree={event.isFree}
          priceMin={event.priceMin}
          priceMax={event.priceMax}
          size="xs"
        />
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] transition-all duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
          style={{
            fontFamily: T.font.mono,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            borderColor: T.border.line,
            color: T.ink.low,
            textDecoration: "none",
          }}
        >
          {event.isFree ? "Drop in" : "Reserve"}
          <Icon icon="mdi:arrow-top-right" className="size-2.5" />
        </a>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface EventTimelineProps {
  readonly filters: FilterState
}

export function EventTimeline({ filters }: EventTimelineProps) {
  const [manualDate, setManualDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)

    return d
  })

  // Derive selected date from dateScope; manual selection only applies for "this-week"/"this-month"
  const selectedDate = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (filters.dateScope === "today") return today
    if (filters.dateScope === "tomorrow") {
      const d = new Date(today)
      d.setDate(today.getDate() + 1)

      return d
    }

    return manualDate
  }, [filters.dateScope, manualDate])

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = new Date(selectedDate)
    from.setHours(0, 0, 0, 0)
    const to = new Date(selectedDate)
    to.setHours(23, 59, 59, 999)

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: "100",
    })
    const firstType = filters.eventTypes?.[0]
    if (firstType) params.set("type", firstType)
    if (filters.priceScope === "free") params.set("isFree", "true")
    if (filters.priceScope === "paid") params.set("isFree", "false")

    fetch(`/api/public-proxy/api/events/global?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setEvents([])
        setLoading(false)
      })
  }, [selectedDate, filters])

  // Apply client-side search filter
  const q = filters.search.trim().toLowerCase()
  const visible = q
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.libraryEntityRef ?? "").toLowerCase().includes(q)
      )
    : events

  // Group by time
  const grouped = new Map<string, TimelineEvent[]>()
  for (const e of visible) {
    const key = e.allDay
      ? "All day"
      : new Date(e.startTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  return (
    <div>
      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            § 01 ·
          </span>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.5rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Today&rsquo;s{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>
              programme.
            </em>
          </h2>
        </div>
        {!loading && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.ghost,
            }}
          >
            {visible.length !== events.length
              ? `${visible.length} of ${events.length}`
              : `${events.length}`}{" "}
            events
          </span>
        )}
      </div>

      {/* Date picker — show more days for wider scopes */}
      <div className="mb-6">
        <DateScrollPicker
          selected={selectedDate}
          onSelect={setManualDate}
          count={
            filters.dateScope === "this-month"
              ? 30
              : filters.dateScope === "this-week"
                ? 14
                : 7
          }
        />
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Loading…
          </span>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <Icon
            icon="mdi:calendar-blank-outline"
            className="size-10 text-(--t-ink-ghost)"
          />
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.1rem",
              color: T.ink.faint,
              fontStyle: "italic",
            }}
          >
            {q
              ? `No events matching "${filters.search}"`
              : "No events scheduled for this day"}
          </p>
        </div>
      ) : (
        <div>
          {Array.from(grouped.entries()).map(([time, rowEvents]) => (
            <div key={time}>
              {rowEvents.map((e) => (
                <TimelineRow key={e.documentId} event={e} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

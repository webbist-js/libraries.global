"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { EventCard } from "@/components/events/EventCard"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { GlobalEventsResponse, GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

// ── DateScrollPicker ────────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function buildDays(count: number): Date[] {
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

// ── EventCardGrid ──────────────────────────────────────────────────────────────

// TODO: When dateScope is "this-week" or "this-month", the fetch still uses a
// single selectedDate day window (from 00:00 to 23:59). Consider expanding
// `to` to cover the full week/month range so the result count matches the
// scope label shown in the sidebar.

const PAGE_SIZE = 20

interface EventCardGridProps {
  readonly filters: FilterState
  readonly onFiltersChange: (next: FilterState) => void
}

export function EventCardGrid({
  filters,
  onFiltersChange,
}: EventCardGridProps) {
  // manualDate = date set by the DateScrollPicker
  const [manualDate, setManualDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)

    return d
  })

  // selectedDate is derived from dateScope filter + manual picker
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

  const [response, setResponse] = useState<GlobalEventsResponse>({
    events: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const from = new Date(selectedDate)
    from.setHours(0, 0, 0, 0)

    const to = new Date(selectedDate)
    if (filters.dateScope === "this-week") {
      to.setDate(to.getDate() + 6)
    } else if (filters.dateScope === "this-month") {
      to.setDate(to.getDate() + 29)
    }
    to.setHours(23, 59, 59, 999)

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: String(PAGE_SIZE),
      page: String(filters.page),
    })
    if (filters.eventTypes.length > 0)
      params.set("type", filters.eventTypes.join(","))
    if (filters.priceScope === "free") params.set("isFree", "true")
    if (filters.priceScope === "paid") params.set("isFree", "false")
    // TODO: countryCode/regionSlug filtering requires countryBreakdown to be
    // reworked via the library relation join — removed from API for now.

    fetch(`/api/public-proxy/api/events/global?${params}`)
      .then((r) => r.json())
      .then((data: GlobalEventsResponse) => {
        setResponse(data)
        setLoading(false)
      })
      .catch(() => {
        setResponse({ events: [], total: 0, page: 1, pageSize: PAGE_SIZE })
        setLoading(false)
      })
  }, [selectedDate, filters])

  const filtered = applyClientFilters(response.events, filters)

  const totalPages = Math.ceil(response.total / PAGE_SIZE)

  const handlePageChange = (p: number) => {
    onFiltersChange({ ...filters, page: p })
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef}>
      {/* Date picker */}
      <div style={{ marginBottom: "20px" }}>
        <DateScrollPicker
          selected={selectedDate}
          onSelect={(d) => {
            setManualDate(d)
            onFiltersChange({ ...filters, page: 1 })
          }}
          count={
            filters.dateScope === "this-month"
              ? 30
              : filters.dateScope === "this-week"
                ? 14
                : 7
          }
        />
      </div>

      {/* Result count */}
      {!loading && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.ghost,
            marginBottom: "16px",
          }}
        >
          {filtered.length < response.total
            ? `${filtered.length} of ${response.total}`
            : response.total}{" "}
          events
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            fontFamily: T.font.serif,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: T.ink.faint,
            border: `1px solid ${T.border.line}`,
            borderRadius: "16px",
          }}
        >
          No events match your filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
          className="sm:grid-cols-2"
        >
          {filtered.map((event) => (
            <EventCard key={event.documentId} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <IndexPager
        page={filters.page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

// ── Client-side filter helpers ─────────────────────────────────────────────────

function getHourSlot(
  iso: string
): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date(iso).getHours()
  if (h >= 6 && h < 12) return "morning"
  if (h >= 12 && h < 18) return "afternoon"
  if (h >= 18 && h < 22) return "evening"

  return "night"
}

const DIRECT_PROVIDERS = new Set([
  "ical",
  "custom_ical",
  "aspen",
  "solus",
  "spydus",
])

function applyClientFilters(
  events: GridEvent[],
  filters: FilterState
): GridEvent[] {
  let result = events

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.libraryName ?? "").toLowerCase().includes(q)
    )
  }

  if (filters.eventTypes.length > 0) {
    result = result.filter((e) => filters.eventTypes.includes(e.eventType))
  }

  if (filters.timeOfDay.length > 0) {
    result = result.filter(
      (e) => !e.allDay && filters.timeOfDay.includes(getHourSlot(e.startTime))
    )
  }

  if (filters.libraryDirect) {
    result = result.filter(
      (e) => e.libraryName != null && DIRECT_PROVIDERS.has(e.sourceProvider)
    )
  }

  return result
}

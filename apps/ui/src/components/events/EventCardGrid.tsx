"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { EventCard } from "@/components/events/EventCard"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { GlobalEventsResponse, GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

// ── EventCardGrid ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

interface EventCardGridProps {
  readonly filters: FilterState
  readonly onFiltersChange: (next: FilterState) => void
}

export function EventCardGrid({
  filters,
  onFiltersChange,
}: EventCardGridProps) {
  const [response, setResponse] = useState<GlobalEventsResponse>({
    events: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let from: Date
    let to: Date

    if (filters.calendarDate) {
      // Specific day selected from calendar
      const [y, m, d] = filters.calendarDate.split("-").map(Number)
      from = new Date(y, m - 1, d, 0, 0, 0, 0)
      to = new Date(y, m - 1, d, 23, 59, 59, 999)
    } else {
      from = new Date(today)
      to = new Date(today)
      switch (filters.dateScope) {
        case "tomorrow":
          from.setDate(from.getDate() + 1)
          to.setDate(to.getDate() + 1)

          break

        case "this-week":
          to.setDate(to.getDate() + 6)

          break

        case "this-month":
          to.setDate(to.getDate() + 29)

          break

        // No default
      }
      to.setHours(23, 59, 59, 999)
    }

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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
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
  }, [filters])

  const filtered = applyClientFilters(response.events, filters)

  const totalPages = Math.ceil(response.total / PAGE_SIZE)

  const handlePageChange = (p: number) => {
    onFiltersChange({ ...filters, page: p })
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef}>
      {/* Header row */}
      {!loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            {response.total > 0
              ? (() => {
                  const start = (filters.page - 1) * PAGE_SIZE + 1
                  const end = Math.min(filters.page * PAGE_SIZE, response.total)
                  const pages = Math.ceil(response.total / PAGE_SIZE)

                  return `Showing ${start}–${end} of ${response.total} · Page ${filters.page} of ${pages}`
                })()
              : "No events"}
          </p>
          {}
          <a
            href="/api/events/ics"
            download
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Subscribe to ICS
            <Icon icon="mdi:arrow-top-right" className="size-3" />
          </a>
        </div>
      )}

      {/* List */}
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
        <div className="ecards">
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

  return result
}

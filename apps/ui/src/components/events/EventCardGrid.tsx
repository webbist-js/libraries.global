"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { EventCard } from "@/components/events/EventCard"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { searchEvents, type EventSearchHit } from "@/lib/meilisearch"

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
  const [hits, setHits] = useState<EventSearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let from: Date
    let to: Date

    if (filters.calendarDate) {
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

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    searchEvents({
      query: filters.search,
      eventTypes: filters.eventTypes,
      isFree:
        filters.priceScope === "free"
          ? true
          : filters.priceScope === "paid"
            ? false
            : undefined,
      fromTimestamp: Math.floor(from.getTime() / 1000),
      toTimestamp: Math.floor(to.getTime() / 1000),
      countryCode: filters.countryCode || undefined,
      page: filters.page - 1, // FilterState is 1-based
      hitsPerPage: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return
        setHits(result.hits)
        const t = (result as any).totalHits ?? result.estimatedTotalHits ?? 0
        setTotal(t)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setHits([])
        setTotal(0)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters])

  // timeOfDay is still client-side (hour-of-day not stored as filterable attribute)
  const displayed = applyTimeOfDayFilter(hits, filters)

  const totalPages = Math.ceil(total / PAGE_SIZE)

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
            {total > 0
              ? (() => {
                  const start = (filters.page - 1) * PAGE_SIZE + 1
                  const end = Math.min(filters.page * PAGE_SIZE, total)
                  const pages = Math.ceil(total / PAGE_SIZE)

                  return `Showing ${start}–${end} of ${total} · Page ${filters.page} of ${pages}`
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
      ) : displayed.length === 0 ? (
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
          {displayed.map((hit) => (
            <EventCard key={hit.documentId} event={hitToGridEvent(hit)} />
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function hitToGridEvent(hit: EventSearchHit): GridEvent {
  return {
    documentId: hit.documentId,
    title: hit.title,
    url: hit.url,
    imageUrl: hit.imageUrl ?? null,
    startTime: hit.startTime,
    endTime: hit.endTime ?? null,
    allDay: hit.allDay,
    timezone: hit.timezone,
    eventType: hit.eventType,
    sourceProvider: hit.sourceProvider ?? "",
    isFree: hit.isFree,
    priceMin: hit.priceMin ?? null,
    priceMax: hit.priceMax ?? null,
    libraryName: hit.library_name ?? null,
    librarySlug: hit.library_slug ?? null,
    status: hit.status,
  }
}

function getHourSlot(
  iso: string
): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date(iso).getHours()
  if (h >= 6 && h < 12) return "morning"
  if (h >= 12 && h < 18) return "afternoon"
  if (h >= 18 && h < 22) return "evening"

  return "night"
}

// timeOfDay is client-side only — MeiliSearch doesn't store hour-of-day
function applyTimeOfDayFilter(
  hits: EventSearchHit[],
  filters: FilterState
): EventSearchHit[] {
  if (filters.timeOfDay.length === 0) return hits

  return hits.filter(
    (e) => !e.allDay && filters.timeOfDay.includes(getHourSlot(e.startTime))
  )
}

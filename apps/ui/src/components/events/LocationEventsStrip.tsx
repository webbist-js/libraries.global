"use client"

import { Icon } from "@iconify/react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { T } from "@/lib/design-tokens"

interface StripEvent {
  documentId: string
  title: string
  startTime: string
  allDay: boolean
  eventType: string
  isFree: boolean
  libraryEntityRef?: string | null
}

interface LocationEventsStripProps {
  countryCode?: string
  regionSlug?: string
  locationLabel: string
}

export function LocationEventsStrip({
  countryCode,
  regionSlug,
  locationLabel,
}: LocationEventsStripProps) {
  const [events, setEvents] = useState<StripEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      limit: "6",
    })
    if (countryCode) params.set("countryCode", countryCode)
    if (regionSlug) params.set("regionSlug", regionSlug)

    fetch(`/api/public-proxy/api/events/global?${params.toString()}`)
      .then((r) => r.json())
      .then((data: StripEvent[]) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [countryCode, regionSlug])

  if (loading || events.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Upcoming
          </span>
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.3rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Events in{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>
              {locationLabel}.
            </em>
          </h3>
        </div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-(--t-accent-aurora)"
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.faint,
            textDecoration: "none",
          }}
        >
          Programme
          <Icon icon="mdi:arrow-right" className="size-3" />
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.documentId}
            href={`/events/${event.documentId}`}
            className="group flex flex-col gap-2 rounded-xl border p-4 transition-colors duration-150 hover:border-(--t-border-hi)"
            style={{ borderColor: T.border.line, textDecoration: "none" }}
          >
            <div className="flex items-center gap-2">
              <EventTypeChip type={event.eventType} size="xs" />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".1em",
                  color: T.ink.faint,
                }}
              >
                {event.isFree ? "Free" : "Ticketed"}
              </span>
            </div>
            <p
              className="line-clamp-2 leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
              style={{
                fontFamily: T.font.serif,
                fontSize: "0.95rem",
                fontStyle: "italic",
                color: T.ink.base,
              }}
            >
              {event.title}
            </p>
            {event.libraryEntityRef ? (
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                {event.libraryEntityRef}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  )
}

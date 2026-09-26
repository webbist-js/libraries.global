"use client"

import { Icon } from "@iconify/react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { T } from "@/lib/design-tokens"

interface WidgetEvent {
  documentId: string
  title: string
  startTime: string
  allDay: boolean
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryEntityRef?: string | null
}

function formatEventDate(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(d)
  eventDay.setHours(0, 0, 0, 0)

  const label =
    eventDay.getTime() === today.getTime()
      ? "Today"
      : eventDay.getTime() === tomorrow.getTime()
        ? "Tomorrow"
        : d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })

  if (allDay) return label

  return `${label} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`
}

export function UpcomingEventsWidget() {
  const [events, setEvents] = useState<WidgetEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = new Date().toISOString()
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    fetch(`/api/public-proxy/api/events/global?from=${from}&to=${to}&limit=5`)
      .then((r) => r.json())
      .then((data: WidgetEvent[]) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (events.length === 0) return null

  return (
    <div>
      {/* Header */}
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
            Coming up
          </span>
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.3rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Events this week
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
          View all
          <Icon icon="mdi:arrow-right" className="size-3" />
        </Link>
      </div>

      {/* Event list */}
      <div className="flex flex-col gap-0">
        {events.map((event) => (
          <Link
            key={event.documentId}
            href={`/events/${event.documentId}`}
            className="group flex items-center gap-4 border-b py-3.5 transition-colors duration-150 hover:border-(--t-border-hi)"
            style={{ borderColor: T.border.line, textDecoration: "none" }}
          >
            {/* Type bar */}
            <div
              className="h-8 w-0.5 shrink-0 rounded-full"
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
                          ? "var(--t-accent-primary)"
                          : "rgba(255,255,255,0.12)",
              }}
            />

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <EventTypeChip type={event.eventType} size="xs" />
                {event.libraryEntityRef ? (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      letterSpacing: ".1em",
                      color: T.ink.faint,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.libraryEntityRef}
                  </span>
                ) : null}
              </div>
              <p
                className="truncate leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "1rem",
                  fontStyle: "italic",
                  color: T.ink.base,
                }}
              >
                {event.title}
              </p>
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".1em",
                  color: T.ink.faint,
                }}
              >
                {formatEventDate(event.startTime, event.allDay)}
              </p>
            </div>

            {/* Price */}
            <div className="shrink-0">
              <PriceBadge
                isFree={event.isFree}
                priceMin={event.priceMin}
                priceMax={event.priceMax}
                size="xs"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

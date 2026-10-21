"use client"

import { Icon } from "@iconify/react"
import type { GlobalEventsResponse, GridEvent } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface LocationEventsStripProps {
  countryCode?: string
  countrySlug?: string
  regionSlug?: string
  locationLabel: string
}

export function LocationEventsStrip({
  countryCode,
  countrySlug,
  regionSlug,
  locationLabel,
}: LocationEventsStripProps) {
  const tUi = useUiTranslations("ui")

  const t = useUiTranslations("eventBrowse")
  const [events, setEvents] = useState<GridEvent[]>([])
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setEvents([])
    setError(false)
    const params = new URLSearchParams({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      limit: "6",
    })
    if (countrySlug) params.set("country", countrySlug)
    else if (countryCode) params.set("countryCode", countryCode)
    if (regionSlug) params.set("regionSlug", regionSlug)

    fetch(`/api/public-proxy/api/events/global?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Events unavailable")
        const data = (await response.json()) as GlobalEventsResponse
        if (!Array.isArray(data.events))
          throw new Error("Invalid events response")
        if (!controller.signal.aborted) setEvents(data.events)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [countryCode, countrySlug, regionSlug, revision])

  if (error)
    return (
      <div role="status" className="text-muted-foreground text-sm">
        {t("loadError")}{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setRevision((value) => value + 1)}
        >
          {t("retry")}
        </button>
      </div>
    )
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
            {t("upcoming")}
          </span>
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.3rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            {t("inLocation", { location: locationLabel })}
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
          {t("programme")}
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
                {event.isFree ? tUi("free") : t("ticketed")}
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
            {event.libraryName ? (
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                {event.libraryName}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  )
}

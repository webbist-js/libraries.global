"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import { useEventModal } from "@/components/events/EventModalContext"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { SaveEventButton } from "@/components/events/SaveEventButton"
import {
  analyticsAttributes,
  captureAnalyticsEvent,
} from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"

interface ModalEvent {
  documentId: string
  title: string
  description?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  libraryEntityRef?: string | null
  tags?: string[] | null
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay)
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  return (
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )
}

export function EventModal() {
  const tUi = useUiTranslations("ui")

  const { activeDocumentId, closeModal } = useEventModal()
  const [event, setEvent] = useState<ModalEvent | null>(null)
  const [loading, setLoading] = useState(false)
  // Escape, focus trap, focus restore and scroll lock are handled by Radix.

  // Fetch event when documentId changes
  useEffect(() => {
    if (!activeDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvent(null)

      return
    }
    const controller = new AbortController()
    const measured = captureAnalyticsEvent("select_content", {
      interaction_source: "event_modal",
      content_type: "event",
      content_id: activeDocumentId,
    })
    setLoading(true)
    fetch(
      `/api/public-proxy/api/events/event/${encodeURIComponent(activeDocumentId)}`,
      { signal: controller.signal }
    )
      .then(async (r) => {
        if (!r.ok) return null
        const item = (await r.json()) as ModalEvent
        if (!controller.signal.aborted) measured()

        return item
      })
      .then((data) => {
        setEvent(data)
        setLoading(false)
      })
      .catch(() => {
        // Ignore aborts from a newer selection; they are not failures.
        if (controller.signal.aborted) return
        setEvent(null)
        setLoading(false)
      })

    return () => controller.abort()
  }, [activeDocumentId])

  if (!activeDocumentId) return null

  const linkUrl = event?.registrationUrl ?? event?.url

  return (
    <Drawer
      titleId="event-details-heading"
      title={loading ? "Loading event" : (event?.title ?? "Event details")}
      onClose={closeModal}
      size="md"
    >
      {/* Image */}
      {!loading && event?.imageUrl ? (
        <div className="relative h-48 w-full shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      {/* Content */}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              {tUi("loading")}{" "}
            </span>
          </div>
        ) : event ? (
          <>
            {/* Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <EventTypeChip type={event.eventType} size="xs" />
              {event.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "999px",
                    padding: "2px 8px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Date/time */}
            <div className="flex items-center gap-2">
              <Icon
                icon="mdi:calendar-outline"
                className="size-4 shrink-0"
                style={{ color: T.ink.faint }}
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: T.ink.dim,
                }}
              >
                {formatDateTime(event.startTime, event.allDay)}
              </span>
            </div>

            {/* Library */}
            {event.libraryEntityRef && (
              <div className="flex items-center gap-2">
                <Icon
                  icon="mdi:library-outline"
                  className="size-4 shrink-0"
                  style={{ color: T.ink.faint }}
                />
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: T.ink.dim,
                  }}
                >
                  {event.libraryEntityRef}
                </span>
              </div>
            )}

            <PriceBadge
              isFree={event.isFree}
              priceMin={event.priceMin}
              priceMax={event.priceMax}
            />

            {/* Description */}
            {event.description && (
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: T.ink.low }}
              >
                {event.description}
              </p>
            )}

            {/* CTAs */}
            <div
              className="mt-auto flex flex-wrap items-center gap-3 border-t pt-5"
              style={{ borderColor: T.border.line }}
            >
              <SaveEventButton documentId={event.documentId} size="sm" />

              {linkUrl && (
                <a
                  href={linkUrl}
                  {...analyticsAttributes("event_action", {
                    interaction_source: "event_modal",
                    action_type: "registration_handoff",
                    content_id: event.documentId,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-accent-primary-hover)"
                  style={{
                    background: T.accent.primary,
                    color: "white",
                    textDecoration: "none",
                  }}
                >
                  <Icon icon="mdi:ticket-outline" className="size-4" />
                  {event.isFree ? "Register" : "Get tickets"}
                </a>
              )}
              <a
                href={`/events/${event.documentId}`}
                {...analyticsAttributes("select_content", {
                  interaction_source: "event_modal",
                  content_type: "event",
                  content_id: event.documentId,
                })}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface)"
                style={{
                  borderColor: T.border.line,
                  color: T.ink.dim,
                  textDecoration: "none",
                }}
              >
                Full details
                <Icon icon="mdi:arrow-right" className="size-4" />
              </a>
            </div>
          </>
        ) : (
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "1rem",
              color: T.ink.faint,
              fontStyle: "italic",
            }}
          >
            Event not found.
          </p>
        )}
      </div>
    </Drawer>
  )
}

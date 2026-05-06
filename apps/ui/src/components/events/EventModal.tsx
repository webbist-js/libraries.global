"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { useEventModal } from "@/components/events/EventModalContext"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { SaveEventButton } from "@/components/events/SaveEventButton"
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
  const { activeDocumentId, closeModal } = useEventModal()
  const [event, setEvent] = useState<ModalEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
    }
    window.addEventListener("keydown", handler)

    return () => window.removeEventListener("keydown", handler)
  }, [closeModal])

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = activeDocumentId ? "hidden" : ""

    return () => {
      document.body.style.overflow = ""
    }
  }, [activeDocumentId])

  // Fetch event when documentId changes
  useEffect(() => {
    if (!activeDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvent(null)

      return
    }
    setLoading(true)
    fetch(`/api/public-proxy/api/events/event/${activeDocumentId}`)
      .then((r) => r.json())
      .then((data: ModalEvent) => {
        setEvent(data)
        setLoading(false)
      })
      .catch(() => {
        setEvent(null)
        setLoading(false)
      })
  }, [activeDocumentId])

  if (!activeDocumentId) return null

  const linkUrl = event?.registrationUrl ?? event?.url

  return (
    // Backdrop
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(3,5,17,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) closeModal()
      }}
    >
      {/* Panel */}
      <div
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto"
        style={{
          background: T.bg.deep,
          borderLeft: `1px solid ${T.border.hi}`,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeModal}
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border transition-colors duration-150"
          style={{
            borderColor: T.border.line,
            color: T.ink.faint,
            background: T.bg.deep,
          }}
        >
          <Icon icon="mdi:close" className="size-4" />
        </button>

        {/* Image */}
        {event?.imageUrl ? (
          <div className="relative h-48 w-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 50%, rgba(7,11,30,0.9) 100%)",
              }}
            />
          </div>
        ) : (
          <div className="h-8 w-full shrink-0" />
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col gap-5 p-6 pt-5">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
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

              {/* Title */}
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
                  lineHeight: 1.15,
                  fontWeight: 400,
                  color: T.ink.base,
                }}
              >
                {event.title}
              </h2>

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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)]"
                    style={{
                      background: "rgba(127,223,255,0.1)",
                      border: "1px solid rgba(127,223,255,0.3)",
                      color: T.accent.aurora,
                      textDecoration: "none",
                    }}
                  >
                    <Icon icon="mdi:ticket-outline" className="size-4" />
                    {event.isFree ? "Register" : "Get tickets"}
                  </a>
                )}
                <a
                  href={`/events/${event.documentId}`}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors duration-150"
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
      </div>
    </div>
  )
}

"use client"

import { Icon } from "@iconify/react"
import * as Dialog from "@radix-ui/react-dialog"
import { useEffect, useState } from "react"

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
  // Escape, focus trap, focus restore and scroll lock are handled by Radix.

  // Fetch event when documentId changes
  useEffect(() => {
    if (!activeDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvent(null)

      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch(
      `/api/public-proxy/api/events/event/${encodeURIComponent(activeDocumentId)}`,
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? (r.json() as Promise<ModalEvent>) : null))
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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) closeModal()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{
            background: "rgba(23,22,43,0.45)",
            backdropFilter: "blur(4px)",
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto focus:outline-none"
          style={{
            background: T.bg.deep,
            borderLeft: `1px solid ${T.border.hi}`,
          }}
        >
          {/* Screen-reader title while loading / when not found; the visible
              h2 below becomes the title once the event has loaded. */}
          {event ? null : (
            <Dialog.Title className="sr-only">
              {loading ? "Loading event" : "Event not found"}
            </Dialog.Title>
          )}
          {/* Close button */}
          <Dialog.Close
            aria-label="Close event details"
            className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border transition-colors duration-150"
            style={{
              borderColor: T.border.line,
              color: T.ink.faint,
              background: T.bg.deep,
            }}
          >
            <Icon icon="mdi:close" className="size-4" aria-hidden="true" />
          </Dialog.Close>

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
                <Dialog.Title
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
                    lineHeight: 1.15,
                    fontWeight: 400,
                    color: T.ink.base,
                  }}
                >
                  {event.title}
                </Dialog.Title>

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
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all duration-150 hover:bg-[var(--t-aurora-soft)]"
                      style={{
                        background: "var(--t-aurora-soft)",
                        border: "1px solid var(--t-aurora-soft)",
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

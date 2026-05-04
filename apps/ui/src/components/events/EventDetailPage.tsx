// apps/ui/src/components/events/EventDetailPage.tsx
import { Icon } from "@iconify/react"
import Link from "next/link"

import { Container } from "@/components/elementary/Container"
import { CalendarSubscribeButton } from "@/components/events/CalendarSubscribeButton"
import { EventJsonLd } from "@/components/events/EventJsonLd"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { T } from "@/lib/design-tokens"

interface DetailEvent {
  documentId: string
  title: string
  description?: string | null
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
  tags?: string[] | null
  status: string
}

interface EventDetailPageProps {
  event: DetailEvent
  related: DetailEvent[]
  libraryName?: string | null
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)

  return {
    date: d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }
}

function RelatedEventCard({ event }: { event: DetailEvent }) {
  const { date, time } = formatDate(event.startTime)

  return (
    <Link
      href={`/events/${event.documentId}`}
      className="group flex gap-3 rounded-xl border p-4 transition-colors duration-150 hover:border-(--t-border-hi)"
      style={{ borderColor: T.border.line, textDecoration: "none" }}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <EventTypeChip type={event.eventType} size="xs" />
        </div>
        <p
          className="line-clamp-2 leading-snug"
          style={{
            fontFamily: T.font.serif,
            fontSize: "0.95rem",
            fontStyle: "italic",
            color: T.ink.base,
          }}
        >
          {event.title}
        </p>
        <p
          className="mt-1"
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".1em",
            color: T.ink.ghost,
          }}
        >
          {date} · {time}
        </p>
      </div>
      <Icon
        icon="mdi:arrow-top-right"
        className="mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: T.accent.aurora }}
      />
    </Link>
  )
}

export function EventDetailPage({
  event,
  related,
  libraryName,
}: EventDetailPageProps) {
  const { date, time } = formatDate(event.startTime)
  const endFormatted = event.endTime ? formatDate(event.endTime) : null
  const linkUrl = event.registrationUrl ?? event.url

  return (
    <>
      <EventJsonLd
        title={event.title}
        description={event.description}
        startTime={event.startTime}
        endTime={event.endTime}
        url={event.url}
        imageUrl={event.imageUrl}
        isFree={event.isFree}
        priceMin={event.priceMin}
        priceMax={event.priceMax}
        libraryName={libraryName}
      />

      {/* Hero image */}
      {event.imageUrl ? (
        <div className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-96">
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
                "linear-gradient(to bottom, transparent 40%, rgba(7,11,30,0.85) 100%)",
            }}
          />
        </div>
      ) : null}

      <Container className="py-10 sm:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2">
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-1.5">
              <Link
                href="/events"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.ghost,
                  textDecoration: "none",
                }}
              >
                Programme
              </Link>
              <span style={{ color: T.ink.faint, fontSize: "10px" }}>/</span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                Event
              </span>
            </nav>

            {/* Type chip + tags */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <EventTypeChip type={event.eventType} size="sm" />
              {event.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
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
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                fontWeight: 400,
                color: T.ink.base,
              }}
            >
              {event.title}
            </h1>

            {/* Meta row */}
            <div
              className="mt-6 flex flex-wrap items-center gap-5 border-t border-b py-4"
              style={{ borderColor: T.border.line }}
            >
              {/* Date */}
              <div className="flex items-center gap-2">
                <Icon
                  icon="mdi:calendar-outline"
                  className="size-4"
                  style={{ color: T.ink.ghost }}
                />
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: T.ink.dim,
                  }}
                >
                  {date}
                </span>
              </div>

              {/* Time */}
              {!event.allDay && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:clock-outline"
                    className="size-4"
                    style={{ color: T.ink.ghost }}
                  />
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.dim,
                    }}
                  >
                    {time}
                    {endFormatted ? ` – ${endFormatted.time}` : ""}
                  </span>
                </div>
              )}

              {/* Library */}
              {(libraryName ?? event.libraryEntityRef) && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:library-outline"
                    className="size-4"
                    style={{ color: T.ink.ghost }}
                  />
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.dim,
                    }}
                  >
                    {libraryName ?? event.libraryEntityRef}
                  </span>
                </div>
              )}

              <div className="flex-1" />
              <PriceBadge
                isFree={event.isFree}
                priceMin={event.priceMin}
                priceMax={event.priceMax}
              />
            </div>

            {/* Description */}
            {event.description ? (
              <div className="mt-8">
                <p
                  className="leading-relaxed whitespace-pre-line"
                  style={{ color: T.ink.dim, fontSize: "1rem" }}
                >
                  {event.description}
                </p>
              </div>
            ) : null}

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* External ticket/registration link — must be <a> with target="_blank" */}
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)]"
                style={{
                  background: "rgba(127,223,255,0.1)",
                  border: "1px solid rgba(127,223,255,0.3)",
                  color: T.accent.aurora,
                  textDecoration: "none",
                }}
              >
                <Icon icon="mdi:ticket-outline" className="size-4" />
                {event.isFree ? "Register free" : "Get tickets"}
              </a>
              <CalendarSubscribeButton
                icsUrl="/api/public-proxy/api/events/ics/global.ics"
                label="Add to calendar"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {related.length > 0 && (
              <div>
                <p
                  className="mb-4"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  More at this library
                </p>
                <div className="flex flex-col gap-3">
                  {related.map((r) => (
                    <RelatedEventCard key={r.documentId} event={r} />
                  ))}
                </div>
                <Link
                  href="/events"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] transition-colors duration-150 hover:text-(--t-accent-aurora)"
                  style={{
                    fontFamily: T.font.mono,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.ghost,
                    textDecoration: "none",
                  }}
                >
                  View all events
                  <Icon icon="mdi:arrow-right" className="size-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </Container>
    </>
  )
}

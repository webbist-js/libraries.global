import { Icon } from "@iconify/react"

import { CardImageBlock } from "@/components/ds"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import type { GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDuration(
  start: string,
  end: string | null | undefined
): string | null {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60

  return m ? `${h}h ${m}m` : `${h}h`
}

interface EventCardProps {
  readonly event: GridEvent
}

export function EventCard({ event }: EventCardProps) {
  const start = new Date(event.startTime)
  const dayNum = start.getDate()
  const dayLabel = start
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toUpperCase()
  const startTime = event.allDay ? "All day" : formatTime(event.startTime)
  const endTime = event.endTime ? formatTime(event.endTime) : null
  const duration = formatDuration(event.startTime, event.endTime)
  const link = event.registrationUrl ?? event.url

  // TODO: /events/[documentId] individual event detail page does not exist yet.
  // The card title should link there once the route is built. For now it points
  // to a 404. Consider temporarily linking to `event.url` (the external source)
  // until the detail page is implemented.
  return (
    <a
      href={`/events/${event.documentId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      className="event-card group"
    >
      <div
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: "16px",
          overflow: "hidden",
          transition: "transform 150ms, border-color 150ms",
        }}
        className="event-card-inner"
      >
        {/* Image */}
        <CardImageBlock
          imageUrl={event.imageUrl}
          alt={event.title}
          aspectRatio="4/3"
          maxHeight={180}
          topLeft={<EventTypeChip type={event.eventType} size="xs" />}
          topRight={
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".14em",
                  color: T.ink.faint,
                  textTransform: "uppercase",
                }}
              >
                {dayLabel}
              </div>
              <div
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "48px",
                  lineHeight: 0.9,
                  color: T.ink.base,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                }}
              >
                {dayNum}
              </div>
            </div>
          }
        />

        {/* Content */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.05rem",
              fontStyle: "italic",
              fontWeight: 400,
              color: T.ink.base,
              margin: 0,
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {event.title}
          </h3>

          {event.libraryEntityRef ? (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                color: T.ink.ghost,
                letterSpacing: ".1em",
                margin: 0,
              }}
            >
              {event.libraryEntityRef}
            </p>
          ) : null}

          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.low,
              letterSpacing: ".06em",
              margin: 0,
            }}
          >
            {startTime}
            {endTime ? ` – ${endTime}` : ""}
            {duration ? ` · ${duration}` : ""}
          </p>

          {/* Bottom row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "4px",
            }}
          >
            <PriceBadge
              isFree={event.isFree}
              priceMin={event.priceMin}
              priceMax={event.priceMax}
              size="xs"
            />
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] transition-all duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
              style={{
                fontFamily: T.font.mono,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                borderColor: T.border.line,
                color: T.ink.low,
                textDecoration: "none",
              }}
            >
              {event.isFree ? "Drop in" : "Reserve"}
              <Icon icon="mdi:arrow-top-right" className="size-2.5" />
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .event-card:hover .event-card-inner {
          transform: translateY(-2px);
          border-color: var(--t-border-hi);
        }
      `}</style>
    </a>
  )
}

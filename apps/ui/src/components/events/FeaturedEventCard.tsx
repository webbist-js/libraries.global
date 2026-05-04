import { Icon } from "@iconify/react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import type { FeaturedEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

function formatFeaturedDate(
  startTime: string,
  endTime?: string | null
): {
  day: string
  monthYear: string
  timeRange: string
} {
  const s = new Date(startTime)

  return {
    day: s.toLocaleDateString("en-GB", { day: "numeric" }),
    monthYear: s.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    }),
    timeRange: endTime
      ? `${s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })} – ${new Date(endTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`
      : s.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
  }
}

export function FeaturedEventCard({ event }: { event: FeaturedEvent }) {
  const { day, monthYear, timeRange } = formatFeaturedDate(
    event.startTime,
    event.endTime
  )
  const linkUrl = event.registrationUrl ?? event.url

  return (
    <div
      className="overflow-hidden rounded-3xl border border-(--t-border-hi)"
      style={{ background: T.bg.deep }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Left: image panel */}
        <div className="relative lg:col-span-2">
          {event.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.imageUrl}
                alt={event.title}
                className="h-56 w-full object-cover lg:h-full"
                style={{ minHeight: "280px" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, rgba(7,11,30,0) 60%, rgba(7,11,30,0.8) 100%)",
                }}
              />
            </>
          ) : (
            // No-image placeholder
            <div
              className="flex h-56 w-full items-center justify-center lg:h-full"
              style={{
                minHeight: "280px",
                background: `
                  radial-gradient(600px 400px at 30% 60%, rgba(127,223,255,0.08), transparent),
                  ${T.bg.deep}
                `,
              }}
            >
              <Icon
                icon="mdi:calendar-star"
                className="size-16 opacity-10"
                style={{ color: T.accent.aurora }}
              />
            </div>
          )}
        </div>

        {/* Right: details */}
        <div className="flex flex-col justify-between gap-6 p-7 lg:col-span-3 lg:p-10">
          {/* Top: chips + date */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  background: "rgba(127,223,255,0.08)",
                  border: "1px solid rgba(127,223,255,0.2)",
                  borderRadius: "999px",
                  padding: "2px 8px",
                }}
              >
                Featured
              </span>
              <EventTypeChip type={event.eventType} size="xs" />
              {(event.tags as string[] | null | undefined)
                ?.slice(0, 2)
                .map((tag) => (
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

            {/* Date block */}
            <div className="shrink-0 text-right">
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "3.5rem",
                  lineHeight: 1,
                  color: T.accent.aurora,
                  fontWeight: 400,
                }}
              >
                {day}
              </p>
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  marginTop: "2px",
                }}
              >
                {monthYear}
              </p>
            </div>
          </div>

          {/* Title */}
          <div>
            <a
              href={`/events/${event.documentId}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  color: T.ink.base,
                  fontWeight: 400,
                }}
              >
                {event.title}
              </h2>
            </a>
            {event.description ? (
              <p
                className="mt-3 line-clamp-3 text-sm leading-relaxed"
                style={{ color: T.ink.low }}
              >
                {event.description}
              </p>
            ) : null}
          </div>

          {/* Meta row */}
          <div
            className="flex flex-wrap items-center gap-4 border-t pt-5"
            style={{ borderColor: T.border.line }}
          >
            {/* Time */}
            <div className="flex items-center gap-1.5">
              <Icon
                icon="mdi:clock-outline"
                className="size-3.5 text-(--t-ink-ghost)"
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: T.ink.dim,
                }}
              >
                {timeRange}
              </span>
            </div>

            {/* Library ref */}
            {event.libraryEntityRef ? (
              <div className="flex items-center gap-1.5">
                <Icon
                  icon="mdi:library-outline"
                  className="size-3.5 text-(--t-ink-ghost)"
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
            ) : null}

            <div className="flex-1" />

            <PriceBadge
              isFree={event.isFree}
              priceMin={event.priceMin}
              priceMax={event.priceMax}
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)]"
              style={{
                background: "rgba(127,223,255,0.1)",
                border: "1px solid rgba(127,223,255,0.3)",
                color: T.accent.aurora,
                textDecoration: "none",
              }}
            >
              <Icon icon="mdi:ticket-outline" className="size-4" />
              Reserve
            </a>
            <a
              href={`data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${encodeURIComponent(event.title)}%0ADTSTART:${new Date(event.startTime).toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z%0AURL:${encodeURIComponent(event.url)}%0AEND:VEVENT%0AEND:VCALENDAR`}
              download="event.ics"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
              style={{
                borderColor: T.border.line,
                color: T.ink.dim,
                textDecoration: "none",
              }}
            >
              <Icon icon="mdi:calendar-plus-outline" className="size-4" />
              Add to calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

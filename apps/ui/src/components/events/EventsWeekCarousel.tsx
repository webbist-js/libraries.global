"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import {
  addToCalendarUrl,
  formatTime,
  libraryPathOf,
  providerLabel,
} from "@/components/events/event-display"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { EventSearchHit } from "@/lib/meilisearch"

function KeyValueTile({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div
      className="rounded-[12px] px-4 py-3"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
        {label}
      </p>
      <p
        className="m-0 mt-0.5 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        {value}
      </p>
    </div>
  )
}

function FeaturedWeekCard({ event }: { readonly event: EventSearchHit }) {
  const start = new Date(event.startTime)
  const month = start.toLocaleDateString("en-GB", { month: "short" })
  const weekday = start.toLocaleDateString("en-GB", { weekday: "short" })
  const when = event.allDay
    ? `${weekday} ${start.getDate()} ${month}, all day`
    : `${weekday} ${start.getDate()} ${month}, ${formatTime(event.startTime)} (${event.timezone.split("/")[0] === "Europe" ? "UK time" : event.timezone})`
  const provider = providerLabel(event.sourceProvider)
  const libraryPath = libraryPathOf(event)

  return (
    <article
      className="grid grid-cols-1 gap-6 rounded-[24px] border p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:p-6"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      {/* Image — real photo or an honest placeholder */}
      {event.imageUrl ? (
        <div
          className="min-h-[240px] rounded-[16px] bg-cover bg-center"
          style={{ backgroundImage: `url(${event.imageUrl})` }}
          role="img"
          aria-label=""
        />
      ) : (
        <div
          className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed text-center"
          style={{ borderColor: T.border.hi, color: T.ink.low }}
        >
          <Icon
            icon="mdi:image-outline"
            className="size-6"
            aria-hidden="true"
          />
          <p className="m-0 max-w-[26ch] text-[14px]">
            Event photo from the organiser
          </p>
        </div>
      )}

      {/* Details */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-start gap-4">
          <div
            className="flex shrink-0 flex-col items-center rounded-[14px] border px-3.5 py-2"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            <span
              className="text-[13px] font-semibold"
              style={{ color: T.accent.ember }}
            >
              {month}
            </span>
            <span
              className="text-[30px] leading-none"
              style={{ fontFamily: T.font.serif, color: T.ink.base }}
            >
              {start.getDate()}
            </span>
            <span className="text-[12px]" style={{ color: T.ink.dim }}>
              {weekday}
            </span>
          </div>

          <div className="min-w-0">
            <EventTypeChip type={event.eventType} />
            <h3
              className="m-0 mt-1.5 text-[26px] leading-[1.15]"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              {event.title}
            </h3>
            {event.library_name ? (
              <p className="m-0 mt-1 text-[15px]" style={{ color: T.ink.dim }}>
                at{" "}
                {libraryPath ? (
                  <GlobalLink
                    href={libraryPath}
                    className="underline underline-offset-[3px]"
                    style={{ color: T.accent.primary }}
                  >
                    {event.library_name}
                  </GlobalLink>
                ) : (
                  <span style={{ color: T.ink.base }}>
                    {event.library_name}
                  </span>
                )}
                {event.library_city ? `, ${event.library_city}` : null}
              </p>
            ) : null}
          </div>
        </div>

        {event.summary ? (
          <p
            className="m-0 text-[15px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            {event.summary}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <KeyValueTile label="When" value={when} />
          <KeyValueTile
            label="Price"
            value={
              event.isFree
                ? "Free"
                : event.priceMin != null
                  ? `£${event.priceMin}`
                  : "See website"
            }
          />
          <KeyValueTile label="Format" value="In person" />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[15px] font-semibold text-white transition-colors"
            style={{ background: T.accent.primary }}
          >
            Book on {provider}
            <Icon
              icon="mdi:arrow-top-right"
              className="size-4"
              aria-hidden="true"
            />
          </a>
          <a
            href={addToCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted)"
            style={{
              borderColor: T.border.hi,
              background: T.bg.deep,
              color: T.ink.base,
            }}
          >
            <Icon
              icon="mdi:calendar-plus-outline"
              className="size-4"
              aria-hidden="true"
            />
            Add to calendar
          </a>
          <span className="text-[14px]" style={{ color: T.ink.low }}>
            Listing from {provider}
          </span>
        </div>
      </div>
    </article>
  )
}

export function EventsWeekCarousel({
  events,
}: {
  readonly events: EventSearchHit[]
}) {
  const [index, setIndex] = useState(0)
  if (events.length === 0) return null
  const current = events[Math.min(index, events.length - 1)]!

  return (
    <section aria-labelledby="events-week-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="events-week-heading"
          className="m-0 text-[28px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          Coming up this week
        </h2>
        {events.length > 1 ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              {index + 1} of {events.length}
            </span>
            <button
              type="button"
              aria-label="Previous event"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-(--t-bg-muted) disabled:opacity-40"
              style={{
                borderColor: T.border.hi,
                background: T.bg.deep,
                color: T.ink.base,
              }}
            >
              <Icon icon="mdi:chevron-left" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next event"
              disabled={index >= events.length - 1}
              onClick={() =>
                setIndex((i) => Math.min(events.length - 1, i + 1))
              }
              className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-(--t-bg-muted) disabled:opacity-40"
              style={{
                borderColor: T.border.hi,
                background: T.bg.deep,
                color: T.ink.base,
              }}
            >
              <Icon icon="mdi:chevron-right" className="size-5" />
            </button>
          </div>
        ) : null}
      </div>

      <FeaturedWeekCard event={current} />
    </section>
  )
}

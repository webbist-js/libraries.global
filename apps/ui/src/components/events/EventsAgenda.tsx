"use client"

import { Icon } from "@iconify/react"

import {
  agendaGroupLabel,
  eventTypeTint,
  formatTime,
  groupByDate,
  libraryPathOf,
  providerLabel,
} from "@/components/events/event-display"
import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { EventSearchHit } from "@/lib/meilisearch"

function Chip({
  children,
  bg,
  fg,
}: {
  readonly children: React.ReactNode
  readonly bg: string
  readonly fg: string
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-[2px] text-[12.5px] font-semibold"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

function AgendaRow({ event }: { readonly event: EventSearchHit }) {
  const meta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other!
  const tint = eventTypeTint(event.eventType)
  const libraryPath = libraryPathOf(event)

  return (
    <li className="flex items-start gap-4 px-5 py-4 sm:px-6">
      {/* Time */}
      <span
        className="w-[52px] shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums"
        style={{ color: T.ink.base }}
      >
        {event.allDay ? "All day" : formatTime(event.startTime)}
      </span>

      {/* Type icon */}
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: tint.bg, color: tint.fg }}
      >
        <Icon icon={meta.icon} className="size-4.5" />
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[16px] leading-snug font-semibold">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
            style={{ color: T.ink.base }}
          >
            {event.title}
          </a>
        </p>
        {event.library_name ? (
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            {libraryPath ? (
              <GlobalLink
                href={libraryPath}
                className="underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                {event.library_name}
              </GlobalLink>
            ) : (
              event.library_name
            )}
            {event.library_city ? `, ${event.library_city}` : null}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip bg={tint.bg} fg={tint.fg}>
            {meta.label}
          </Chip>
          <Chip bg="var(--t-bg-muted)" fg="var(--t-ink-dim)">
            {event.isFree
              ? "Free"
              : event.priceMin != null
                ? `£${event.priceMin}`
                : "See website"}
          </Chip>
          <Chip bg="var(--t-bg-muted)" fg="var(--t-ink-dim)">
            In person
          </Chip>
        </div>
      </div>

      {/* Provider */}
      <span
        className="hidden shrink-0 pt-0.5 text-[13px] sm:block"
        style={{ color: T.ink.low }}
      >
        via {providerLabel(event.sourceProvider)}
      </span>
    </li>
  )
}

export function EventsAgenda({
  events,
  loading,
  now,
  totalUnfiltered,
}: {
  readonly events: EventSearchHit[]
  readonly loading: boolean
  readonly now: Date
  readonly totalUnfiltered: number
}) {
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-[18px]"
            style={{
              background: T.bg.muted,
              border: `1px solid ${T.border.line}`,
            }}
          />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div
        className="rounded-[24px] border px-8 py-14 text-center"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <h3
          className="m-0 text-[26px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {totalUnfiltered === 0
            ? "No upcoming events yet"
            : "No events match these filters"}
        </h3>
        <p
          className="mx-auto mt-2 mb-0 max-w-[48ch] text-[16px]"
          style={{ color: T.ink.dim }}
        >
          {totalUnfiltered === 0
            ? "Events appear here as libraries connect their calendars and ticketing feeds."
            : "Try widening the date range or clearing a filter."}
        </p>
      </div>
    )
  }

  const groups = groupByDate(events)

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={agendaGroupLabel(group.key, now)}>
          <h3
            className="m-0 mb-2.5 text-[22px]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            {agendaGroupLabel(group.key, now)}
          </h3>
          <ul
            className="m-0 list-none divide-y divide-(--t-divider) rounded-[18px] border p-0"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            {group.events.map((event) => (
              <AgendaRow key={event.documentId} event={event} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

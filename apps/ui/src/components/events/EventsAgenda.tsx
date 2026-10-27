"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"

import {
  agendaGroupLabel,
  eventTypeTint,
  formatTime,
  groupByDate,
  libraryPathOf,
  providerLabel,
} from "@/components/events/event-display"
import {
  EVENT_TYPE_META,
  eventTypeKey,
} from "@/components/events/EventTypeChip"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { EventSearchHit } from "@/lib/meilisearch"

/** Only http(s) links become anchors: an event URL comes from a third-party feed. */
const isHttpUrl = (url: unknown): url is string =>
  typeof url === "string" && /^https?:\/\//i.test(url.trim())

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
      className="inline-flex items-center rounded-full px-2.5 py-[2px] text-sm font-semibold"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

function AgendaRow({ event }: { readonly event: EventSearchHit }) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("eventListing")
  const locale = useLocale()

  const meta = EVENT_TYPE_META[eventTypeKey(event.eventType)]
  const tint = eventTypeTint(event.eventType)
  const libraryPath = libraryPathOf(event)

  return (
    <li className="flex items-start gap-4 px-5 py-4 sm:px-6">
      {/* Time */}
      <span
        className="w-[52px] shrink-0 pt-0.5 text-sm font-semibold tabular-nums"
        style={{ color: T.ink.base }}
      >
        {event.allDay
          ? t("allday")
          : formatTime(event.startTime, locale, event.timezone)}
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
        <p className="m-0 text-base leading-snug font-semibold">
          {isHttpUrl(event.url) ? (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
              style={{ color: T.ink.base }}
            >
              {event.title}
            </a>
          ) : (
            <span style={{ color: T.ink.base }}>{event.title}</span>
          )}
        </p>
        {event.library_name ? (
          <p className="m-0 mt-0.5 text-sm" style={{ color: T.ink.dim }}>
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
            {t(`types.${eventTypeKey(event.eventType)}`)}
          </Chip>
          <Chip bg="var(--t-bg-muted)" fg="var(--t-ink-dim)">
            {event.isFree ? tUi("free") : t("seeWebsite")}
          </Chip>
        </div>
      </div>

      {/* Provider */}
      <span
        className="hidden shrink-0 pt-0.5 text-sm sm:block"
        style={{ color: T.ink.low }}
      >
        {t("via", {
          provider:
            providerLabel(event.sourceProvider) === "Library calendar"
              ? t("libraryCalendar")
              : providerLabel(event.sourceProvider),
        })}
      </span>
    </li>
  )
}

export function EventsAgenda({
  events,
  loading,
  now,
  totalUnfiltered,
  onReset,
}: {
  readonly events: EventSearchHit[]
  readonly loading: boolean
  readonly now: Date
  readonly totalUnfiltered: number
  readonly onReset?: () => void
}) {
  const t = useUiTranslations("eventListing")
  const locale = useLocale()
  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-[18px] motion-reduce:animate-none"
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
        <span
          aria-hidden="true"
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-(--t-accent-chip) text-(--t-accent-primary)"
        >
          <Icon icon="mdi:calendar-plus-outline" width={27} />
        </span>
        <h3
          className="type-h3 m-0 text-balance"
          style={{
            color: T.ink.base,
          }}
        >
          {totalUnfiltered === 0 ? t("emptyTitle") : t("noMatches")}
        </h3>
        <p
          className="mx-auto mt-2 mb-0 max-w-[48ch] text-base"
          style={{ color: T.ink.dim }}
        >
          {totalUnfiltered === 0 ? t("emptyLead") : t("widen")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {totalUnfiltered === 0 ? (
            <>
              <GlobalLink
                href="/knowledge/events/event-feeds"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
              >
                {t("feedGuide")}
                <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
              </GlobalLink>
              <GlobalLink
                href="/contribute"
                className="inline-flex min-h-11 items-center rounded-full border border-(--t-border-hi) px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted)"
              >
                {t("contribute")}
              </GlobalLink>
            </>
          ) : onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="min-h-11 cursor-pointer rounded-full border border-(--t-border-hi) px-5 py-2.5 text-sm font-semibold text-(--t-accent-primary) hover:bg-(--t-bg-muted)"
            >
              {t("reset")}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const groups = groupByDate(events)

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section
          key={group.key}
          aria-label={agendaGroupLabel(group.key, now, locale)}
        >
          <h3
            className="type-h3 m-0 mb-2.5"
            style={{
              color: T.ink.base,
            }}
          >
            {agendaGroupLabel(group.key, now, locale)}
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

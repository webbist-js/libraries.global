"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import {
  FilterDrawer,
  FilterShowButton,
  FilterSidebar,
  FilterToggleButton,
  SearchField,
  useFilterSidebar,
} from "@/components/ds"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import {
  type EventsFilters,
  type TimeSlot,
  DEFAULT_EVENTS_FILTERS,
  inWhenScope,
  matchesSearch,
  timeSlotOf,
} from "@/components/events/event-display"
import { EventsAgenda } from "@/components/events/EventsAgenda"
import {
  activeEventsFilterCount,
  EventsFilterPanel,
} from "@/components/events/EventsFilterPanel"
import { EventsWeekCarousel } from "@/components/events/EventsWeekCarousel"
import { T } from "@/lib/design-tokens"
import { getCountryName } from "@/lib/iso-continent"
import { searchEvents, type EventSearchHit } from "@/lib/meilisearch"

type LoadState = "loading" | "ready" | "error"

function statLine(events: EventSearchHit[]): string {
  const libraries = new Set(
    events.map((e) => e.library_slug ?? e.library_name).filter(Boolean)
  )
  const countries = new Set(
    events.map((e) => e.library_country_code).filter(Boolean)
  )
  const eventNoun = events.length === 1 ? "event" : "events"
  const libraryNoun = libraries.size === 1 ? "library" : "libraries"
  let where = ""
  if (countries.size === 1) {
    const name = getCountryName([...countries][0]!.toLowerCase())
    where = name
      ? `, all in ${name === "United Kingdom" ? "the UK" : name} so far`
      : ""
  }

  return `${events.length} upcoming ${eventNoun} at ${libraries.size} ${libraryNoun}${where}`
}

function SourceStep({
  index,
  title,
  children,
}: {
  readonly index: number
  readonly title: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex gap-3.5">
      <span
        aria-hidden="true"
        className="text-[26px] leading-none"
        style={{ fontFamily: T.font.serif, color: T.accent.primary }}
      >
        {index}
      </span>
      <div>
        <h3
          className="m-0 text-[16px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {title}
        </h3>
        <p
          className="m-0 mt-1 text-[14.5px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {children}
        </p>
      </div>
    </div>
  )
}

export function EventsPageClient() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("eventListing")

  const [upcoming, setUpcoming] = useState<EventSearchHit[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [retry, setRetry] = useState(0)
  const [filters, setFilters] = useState<EventsFilters>(DEFAULT_EVENTS_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterSidebar = useFilterSidebar("events")
  const [now] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    searchEvents({
      fromTimestamp: Math.floor(Date.now() / 1000),
      hitsPerPage: 300,
    })
      .then((result) => {
        if (cancelled) return
        setUpcoming(result.hits)
        setState("ready")
      })
      .catch(() => {
        if (!cancelled) setState("error")
      })

    return () => {
      cancelled = true
    }
  }, [retry])

  // Events in the next 7 days for the carousel
  const thisWeek = useMemo(
    () => upcoming.filter((e) => inWhenScope(e, "7d", now)).slice(0, 4),
    [upcoming, now]
  )

  // Filtered agenda + facet counts. Counts for each group exclude that
  // group's own selection, so options stay discoverable.
  const { filtered, typeCounts, timeCounts, freeCount } = useMemo(() => {
    const base = upcoming.filter(
      (e) =>
        inWhenScope(e, filters.when, now) && matchesSearch(e, filters.search)
    )
    const byType = (e: EventSearchHit) =>
      filters.types.length === 0 || filters.types.includes(e.eventType)
    const byTime = (e: EventSearchHit) =>
      filters.times.length === 0 || filters.times.includes(timeSlotOf(e))
    const byPrice = (e: EventSearchHit) => !filters.freeOnly || e.isFree

    const counts = new Map<string, number>()
    const slots = new Map<TimeSlot, number>()
    let free = 0
    for (const e of base) {
      if (byTime(e) && byPrice(e)) {
        counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1)
      }
      if (byType(e) && byPrice(e)) {
        const slot = timeSlotOf(e)
        slots.set(slot, (slots.get(slot) ?? 0) + 1)
      }
      if (byType(e) && byTime(e) && e.isFree) free += 1
    }

    return {
      filtered: base.filter((e) => byType(e) && byTime(e) && byPrice(e)),
      typeCounts: counts,
      timeCounts: slots,
      freeCount: free,
    }
  }, [upcoming, filters, now])

  const filterPanel = (withHide: boolean) => (
    <EventsFilterPanel
      filters={filters}
      onChange={setFilters}
      typeCounts={typeCounts}
      timeCounts={timeCounts}
      freeCount={freeCount}
      sidebar={withHide ? filterSidebar : undefined}
    />
  )

  return (
    <main className="relative z-10 flex-1">
      <PageHero
        breadcrumb={[
          { label: tUi("home"), href: "/" },
          { label: tUi("events") },
        ]}
        eyebrow="Events"
        eyebrowIcon="mdi:calendar-blank-outline"
        lead="Author talks, exhibitions, classes, storytime and archive tours, gathered from library calendars and ticketing sites."
        title="What’s on at the world’s *libraries*"
      >
        <SearchField
          id="events-search"
          label={tUi("search_events_by_title_library_or_topic")}
          placeholder={tUi("search_events_by_title_library_or_topic")}
          onClear={() => setFilters({ ...filters, search: "" })}
          inputProps={{
            value: filters.search,
            onChange: (e) => setFilters({ ...filters, search: e.target.value }),
            autoComplete: "off",
          }}
        />
        {state === "ready" ? (
          <p
            aria-live="polite"
            className="m-0 flex items-center gap-2 text-[14.5px] font-semibold"
            style={{ color: T.ink.base }}
          >
            <Icon
              icon="mdi:calendar-blank-outline"
              className="size-4 shrink-0"
              style={{ color: T.ink.dim }}
              aria-hidden="true"
            />
            {upcoming.length === 0
              ? "No upcoming events yet — they appear as libraries connect their calendars"
              : statLine(upcoming)}
          </p>
        ) : null}
      </PageHero>

      <Container className="pt-8 pb-16 sm:pb-20">
        {/* Coming up this week */}
        {thisWeek.length > 0 ? (
          <div className="mb-10">
            <EventsWeekCarousel events={thisWeek} />
          </div>
        ) : null}

        {/* Filters + agenda */}
        <div className="flex items-start gap-8">
          {/* Sidebar — sticky on desktop, can be hidden */}
          <FilterSidebar sidebar={filterSidebar}>
            {filterPanel(true)}
          </FilterSidebar>

          {/* Sidebar — drawer on mobile */}
          <FilterDrawer
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            showLabel={`Show ${filtered.length} ${filtered.length === 1 ? "event" : "events"}`}
          >
            {filterPanel(false)}
          </FilterDrawer>

          <section aria-label={tUi("events")} className="min-w-0 flex-1">
            <div className="mb-4 flex min-h-11 flex-wrap items-center gap-3">
              <FilterToggleButton
                onClick={() => setFiltersOpen(true)}
                expanded={filtersOpen}
                activeCount={activeEventsFilterCount(filters)}
              />
              <FilterShowButton
                sidebar={filterSidebar}
                activeCount={activeEventsFilterCount(filters)}
              />
              <h2
                aria-live="polite"
                className="m-0 flex-1 text-[18px] font-semibold"
                style={{ color: T.ink.base }}
              >
                {state === "loading"
                  ? "Loading events…"
                  : state === "error"
                    ? t("errorTitle")
                    : `${filtered.length} ${filtered.length === 1 ? "event" : "events"}`}
              </h2>
              {state === "ready" && upcoming.length > 0 ? (
                <a
                  href="/api/events/ics"
                  download
                  className="text-[14.5px] font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  Subscribe to this calendar (.ics)
                </a>
              ) : null}
            </div>

            {state === "error" ? (
              <div
                role="alert"
                className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) px-7 py-8"
              >
                <p
                  className="m-0 text-[17px] font-bold"
                  style={{ color: T.ink.base }}
                >
                  {t("errorTitle")}
                </p>
                <p
                  className="m-0 mt-1 text-[15px]"
                  style={{ color: T.ink.base }}
                >
                  {t("errorLead")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setState("loading")
                    setRetry((attempt) => attempt + 1)
                  }}
                  className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) px-5 py-2.5 text-sm font-semibold text-(--t-accent-primary) hover:bg-(--t-bg-muted)"
                >
                  <Icon aria-hidden="true" icon="mdi:refresh" width={18} />
                  {t("retry")}
                </button>
              </div>
            ) : (
              <EventsAgenda
                events={filtered}
                loading={state === "loading"}
                now={now}
                totalUnfiltered={upcoming.length}
                onReset={() => setFilters(DEFAULT_EVENTS_FILTERS)}
              />
            )}
          </section>
        </div>

        {/* Where these events come from */}
        <section
          aria-labelledby="events-sources-heading"
          className="mt-14 rounded-[24px] border px-6 py-8 sm:px-10 sm:py-10"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <h2
            id="events-sources-heading"
            className="m-0 text-[28px]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            Where these events come from
          </h2>
          <p className="mt-1.5 mb-0 text-[15.5px]" style={{ color: T.ink.dim }}>
            We don&rsquo;t sell tickets. Every listing links back to the
            organiser.
          </p>

          <div className="mt-7 grid grid-cols-1 gap-7 md:grid-cols-3">
            <SourceStep index={1} title={tUi("collect")}>
              We check library calendars and ticketing sites like Eventbrite and
              TicketSource every 30 minutes.
            </SourceStep>
            <SourceStep index={2} title={tUi("match")}>
              Duplicates are merged. When sources disagree, the library&rsquo;s
              own calendar wins.
            </SourceStep>
            <SourceStep index={3} title={tUi("publish")}>
              Events appear here and in the open API, each labelled with its
              source.
            </SourceStep>
          </div>
        </section>
      </Container>
    </main>
  )
}

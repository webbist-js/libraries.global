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
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import {
  type EventsFilters,
  type TimeSlot,
  DEFAULT_EVENTS_FILTERS,
  inWhenScope,
} from "@/components/events/event-display"
import { EventsAgenda } from "@/components/events/EventsAgenda"
import {
  activeEventsFilterCount,
  EventsFilterPanel,
} from "@/components/events/EventsFilterPanel"
import { EventsWeekCarousel } from "@/components/events/EventsWeekCarousel"
import { T } from "@/lib/design-tokens"
import { searchEvents, type EventSearchHit } from "@/lib/meilisearch"

import {
  eventSearchParams,
  readEventBrowse,
  writeEventBrowse,
} from "./event-browse"

type LoadState = "loading" | "ready" | "error"

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
  const [{ filters, page }, setBrowse] = useState({
    filters: DEFAULT_EVENTS_FILTERS,
    page: 1,
  })
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [typeCounts, setTypeCounts] = useState(new Map<string, number>())
  const [timeCounts, setTimeCounts] = useState(new Map<TimeSlot, number>())
  const [freeCount, setFreeCount] = useState(0)
  const changeBrowse = (nextFilters: EventsFilters, nextPage = 1) => {
    const query = writeEventBrowse(
      new URLSearchParams(window.location.search),
      nextFilters,
      nextPage
    )
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    )
    setBrowse({ filters: nextFilters, page: nextPage })
  }
  const setFilters = (next: EventsFilters) => changeBrowse(next)
  useEffect(() => {
    const restore = () => {
      const next = readEventBrowse(new URLSearchParams(window.location.search))
      setBrowse((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next
      )
    }
    restore()
    window.addEventListener("popstate", restore)

    return () => window.removeEventListener("popstate", restore)
  }, [])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterSidebar = useFilterSidebar("events")
  const [now] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    // Reset the external request state when its identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading")
    const timer = setTimeout(() => {
      const params = eventSearchParams(filters, page, now)
      Promise.all([
        searchEvents(params),
        searchEvents({
          ...params,
          eventTypes: [],
          page: 0,
          hitsPerPage: 1,
          facets: ["eventType"],
        }),
        searchEvents({
          ...params,
          timeSlots: [],
          page: 0,
          hitsPerPage: 1,
          facets: ["timeSlot"],
        }),
        searchEvents({
          ...params,
          isFree: undefined,
          page: 0,
          hitsPerPage: 1,
          facets: ["isFree"],
        }),
      ])
        .then(([result, types, times, price]) => {
          if (cancelled) return
          setUpcoming(result.hits)
          setTotal(result.totalHits ?? result.hits.length)
          setPages(result.totalPages ?? Math.ceil(result.hits.length / 30))
          setTypeCounts(
            new Map(Object.entries(types.facetDistribution?.eventType ?? {}))
          )
          setTimeCounts(
            new Map(
              Object.entries(times.facetDistribution?.timeSlot ?? {}) as [
                TimeSlot,
                number,
              ][]
            )
          )
          setFreeCount(price.facetDistribution?.isFree?.true ?? 0)
          setState("ready")
        })
        .catch(() => {
          if (!cancelled) setState("error")
        })
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [filters, page, now, retry])

  // Events in the next 7 days for the carousel
  const thisWeek = useMemo(
    () => upcoming.filter((e) => inWhenScope(e, "7d", now)).slice(0, 4),
    [upcoming, now]
  )

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
    <MainContent className="relative z-10 flex-1">
      <PageHero
        breadcrumb={[
          { label: tUi("home"), href: "/" },
          { label: tUi("events") },
        ]}
        eyebrow={tUi("events")}
        eyebrowIcon="mdi:calendar-blank-outline"
        lead={t("lead")}
        title={t("title")}
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
              ? t("noUpcoming")
              : t("matchingEvents", { count: total })}
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
            showLabel={t("showCount", { count: total })}
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
                  ? t("loading")
                  : state === "error"
                    ? t("errorTitle")
                    : t("matchingEvents", { count: total })}
              </h2>
              {state === "ready" && upcoming.length > 0 ? (
                <a
                  href="/api/events/ics"
                  download
                  className="text-[14.5px] font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  {t("subscribe")}
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
                events={upcoming}
                loading={state === "loading"}
                now={now}
                totalUnfiltered={
                  total ||
                  (activeEventsFilterCount(filters) || filters.search ? 1 : 0)
                }
                onReset={() => setFilters(DEFAULT_EVENTS_FILTERS)}
              />
            )}
            {state === "ready" && pages > 1 ? (
              <nav
                aria-label={t("pagination")}
                className="mt-6 flex items-center justify-between gap-4"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  className="min-h-11 rounded-full border px-5 disabled:opacity-40"
                  onClick={() => changeBrowse(filters, page - 1)}
                >
                  {t("previous")}
                </button>
                <span aria-live="polite">{t("pageOf", { page, pages })}</span>
                <button
                  type="button"
                  disabled={page >= pages}
                  className="min-h-11 rounded-full border px-5 disabled:opacity-40"
                  onClick={() => changeBrowse(filters, page + 1)}
                >
                  {t("next")}
                </button>
              </nav>
            ) : null}
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
            {t("sourcesTitle")}
          </h2>
          <p className="mt-1.5 mb-0 text-[15.5px]" style={{ color: T.ink.dim }}>
            {t("sourcesLead")}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-7 md:grid-cols-3">
            <SourceStep index={1} title={tUi("collect")}>
              {t("collectLead")}
            </SourceStep>
            <SourceStep index={2} title={tUi("match")}>
              {t("matchLead")}
            </SourceStep>
            <SourceStep index={3} title={tUi("publish")}>
              {t("publishLead")}
            </SourceStep>
          </div>
        </section>
      </Container>
    </MainContent>
  )
}

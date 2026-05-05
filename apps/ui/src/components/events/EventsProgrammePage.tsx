"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { SectionHeader } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { AggregationExplainer } from "@/components/events/AggregationExplainer"
import { EventCardGrid } from "@/components/events/EventCardGrid"
import { EventCategoryBreakdown } from "@/components/events/EventCategoryBreakdown"
import { EventsBrowseElsewhere } from "@/components/events/EventsBrowseElsewhere"
import { EventsDailyVolumeChart } from "@/components/events/EventsDailyVolumeChart"
import type { FilterState } from "@/components/events/EventsFilterBar"
import { EventsGeoFilterBar } from "@/components/events/EventsGeoFilterBar"
import { EventsHero } from "@/components/events/EventsHero"
import { EventsSidebar } from "@/components/events/EventsSidebar"
import { FeaturedEventsCarousel } from "@/components/events/FeaturedEventsCarousel"
import { MostBookedLibraries } from "@/components/events/MostBookedLibraries"
import { ProviderBreakdownBar } from "@/components/events/ProviderBreakdownBar"
import { TimeOfDayHeatmap } from "@/components/events/TimeOfDayHeatmap"
import type { EventsProgrammeData } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { getCountryName } from "@/lib/iso-continent"

const DEFAULT_FILTERS: FilterState = {
  dateScope: "today",
  priceScope: "all",
  eventTypes: [],
  search: "",
  timeOfDay: [],
  libraryDirect: false,
  countryCode: "",
  regionSlug: "",
  page: 1,
}

function SectionDivider() {
  return (
    <div className="my-2" style={{ borderTop: `1px solid ${T.border.line}` }} />
  )
}

interface EventsProgrammePageProps {
  readonly data: EventsProgrammeData
}

export function EventsProgrammePage({ data }: EventsProgrammePageProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Derive topCountryName from country breakdown
  // TODO: topCountryName is used in the hero stat label ("In [Country]") but
  // shows the country with the most events globally, not the user's locale.
  // Consider using IP geolocation or browser locale as a more personalised fallback.
  const topCountryName = data.countryBreakdown[0]
    ? getCountryName(data.countryBreakdown[0].countryCode)
    : null

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <EventsHero stats={data.stats} topCountryName={topCountryName} />

      {/* Featured carousel */}
      {/* TODO: Featured events are returned by /api/events/featured?count=6.
          The Strapi `featured` flag needs to be set manually on event records in
          the admin panel. Until events are seeded and flagged, this section will
          not render. */}
      {data.featured.length > 0 && (
        <FeaturedEventsCarousel events={data.featured} />
      )}

      <SectionDivider />

      {/* Geo filter bar */}
      <EventsGeoFilterBar
        filters={filters}
        onChange={setFilters}
        countryBreakdown={data.countryBreakdown}
      />

      {/* Timeline section — sidebar + main on desktop */}
      <Container className="py-8 sm:py-10">
        {/* Mobile: filter toggle button */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Today&rsquo;s{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>
              programme.
            </em>
          </h2>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              borderColor: sidebarOpen
                ? "rgba(127,223,255,0.3)"
                : T.border.line,
              background: sidebarOpen
                ? "rgba(127,223,255,0.08)"
                : "transparent",
              color: sidebarOpen ? T.accent.aurora : T.ink.dim,
            }}
          >
            <Icon icon="mdi:tune" className="size-3.5" />
            Filters
          </button>
        </div>

        {sidebarOpen && (
          <div
            className="mb-6 rounded-2xl border p-5 lg:hidden"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            <EventsSidebar filters={filters} onChange={setFilters} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px,1fr]">
          <div className="hidden lg:block">
            <div
              className="sticky rounded-2xl border p-5"
              style={{
                top: "calc(3.5rem + 16px)",
                borderColor: T.border.line,
                background: T.bg.deep,
              }}
            >
              <EventsSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          <div>
            <EventCardGrid filters={filters} onFiltersChange={setFilters} />
          </div>
        </div>
      </Container>

      <SectionDivider />

      {/* Analytics: The shape of the programme */}
      {/* TODO: All analytics charts (volume, categories, heatmap, providers)
          render empty/hidden when Strapi returns no event data. They will
          populate automatically once events are synced via the sync-worker. */}
      <Container className="py-8 sm:py-10">
        <div style={{ marginBottom: "32px" }}>
          <SectionHeader italic="programme.">The shape of the</SectionHeader>
        </div>

        {/* TODO: The design shows a "Where the shares are spent" geographic
            bubble/cluster map section here between the featured card and the
            analytics charts. This was not included in the implementation plan
            and requires a separate MapLibre or D3 visualisation. */}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Daily volume chart */}
          {data.dailyVolume.length > 1 && (
            <EventsDailyVolumeChart data={data.dailyVolume} />
          )}

          {/* Category breakdown */}
          <EventCategoryBreakdown categories={data.categories} />

          {/* Heatmap */}
          <TimeOfDayHeatmap cells={data.heatmap} />

          {/* Provider breakdown */}
          <ProviderBreakdownBar providers={data.providers} />
        </div>
      </Container>

      <SectionDivider />

      {/* Most active libraries */}
      <Container className="py-8 sm:py-10">
        <MostBookedLibraries libraries={data.topLibraries} />
      </Container>

      <SectionDivider />

      {/* Browse elsewhere */}
      <EventsBrowseElsewhere
        countryBreakdown={data.countryBreakdown}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <SectionDivider />

      {/* Aggregation explainer */}
      <Container className="py-8 pb-16 sm:py-10 sm:pb-20">
        <AggregationExplainer />
      </Container>
    </main>
  )
}

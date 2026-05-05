"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { Container } from "@/components/elementary/Container"
import { AggregationExplainer } from "@/components/events/AggregationExplainer"
import { EventCategoryBreakdown } from "@/components/events/EventCategoryBreakdown"
import type { FilterState } from "@/components/events/EventsFilterBar"
import { EventsHero } from "@/components/events/EventsHero"
import { EventsSidebar } from "@/components/events/EventsSidebar"
import { EventsStatsBar } from "@/components/events/EventsStatsBar"
import { EventTimeline } from "@/components/events/EventTimeline"
import { FeaturedEventCard } from "@/components/events/FeaturedEventCard"
import { MostBookedLibraries } from "@/components/events/MostBookedLibraries"
import { ProviderBreakdownBar } from "@/components/events/ProviderBreakdownBar"
import { TimeOfDayHeatmap } from "@/components/events/TimeOfDayHeatmap"
import type { EventsProgrammeData } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

interface EventsProgrammePageProps {
  readonly data: EventsProgrammeData
}

function SectionDivider() {
  return (
    <div className="my-2" style={{ borderTop: `1px solid ${T.border.line}` }} />
  )
}

export function EventsProgrammePage({ data }: EventsProgrammePageProps) {
  const [filters, setFilters] = useState<FilterState>({
    dateScope: "today",
    priceScope: "all",
    eventType: "",
    search: "",
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <EventsHero stats={data.stats} />

      {/* Stats bar */}
      <EventsStatsBar stats={data.stats} />

      {/* Featured event */}
      {data.featured ? (
        <Container className="py-8 sm:py-10">
          <FeaturedEventCard event={data.featured} />
        </Container>
      ) : null}

      <SectionDivider />

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

        {/* Mobile: collapsible sidebar */}
        {sidebarOpen && (
          <div
            className="mb-6 rounded-2xl border p-5 lg:hidden"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            <EventsSidebar filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Desktop: 2-column layout */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px,1fr]">
          {/* Sidebar — sticky on desktop */}
          <div className="hidden lg:block">
            <div
              className="sticky rounded-2xl border p-5"
              style={{
                top: "calc(3.5rem + 16px)", // below global header
                borderColor: T.border.line,
                background: T.bg.deep,
              }}
            >
              <EventsSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          {/* Timeline */}
          <div>
            <EventTimeline filters={filters} />
          </div>
        </div>
      </Container>

      <SectionDivider />

      {/* Analytics row: heatmap + category breakdown */}
      <Container className="py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <TimeOfDayHeatmap cells={data.heatmap} />
          <EventCategoryBreakdown categories={data.categories} />
        </div>
      </Container>

      <SectionDivider />

      {/* Sources row: provider breakdown + most active libraries */}
      <Container className="py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <ProviderBreakdownBar providers={data.providers} />
          <MostBookedLibraries libraries={data.topLibraries} />
        </div>
      </Container>

      <SectionDivider />

      {/* Aggregation explainer */}
      <Container className="py-8 pb-16 sm:py-10 sm:pb-20">
        <AggregationExplainer />
      </Container>
    </main>
  )
}

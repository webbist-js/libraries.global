"use client"

import { useState } from "react"

import { Container } from "@/components/elementary/Container"
import { AggregationExplainer } from "@/components/events/AggregationExplainer"
import { EventCategoryBreakdown } from "@/components/events/EventCategoryBreakdown"
import {
  EventsFilterBar,
  type FilterState,
} from "@/components/events/EventsFilterBar"
import { EventsHero } from "@/components/events/EventsHero"
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
  })

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <EventsHero
        totalThisWeek={data.stats.totalThisWeek}
        providers={data.providers}
      />

      {/* Filter bar — sticky below the global header */}
      <EventsFilterBar filters={filters} onChange={setFilters} />

      {/* Stats bar */}
      <EventsStatsBar stats={data.stats} />

      {/* Featured event */}
      {data.featured ? (
        <Container className="py-8 sm:py-10">
          <FeaturedEventCard event={data.featured} />
        </Container>
      ) : null}

      <SectionDivider />

      {/* Timeline — the core interactive section */}
      <Container className="py-8 sm:py-10">
        <EventTimeline filters={filters} />
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

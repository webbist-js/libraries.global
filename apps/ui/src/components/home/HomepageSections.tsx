import type { Locale } from "next-intl"

import type { HomepageContent } from "@/components/home/homepage.content"
import type {
  ContributionTask,
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import AtlasSection from "@/components/home/sections/AtlasSection"
import ClosingSection from "@/components/home/sections/ClosingSection"
import ContributeSection from "@/components/home/sections/ContributeSection"
import CoverageSection, {
  type CountryBreakdown,
} from "@/components/home/sections/CoverageSection"
import EventsSection from "@/components/home/sections/EventsSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import JournalSection from "@/components/home/sections/JournalSection"
import JourneysSection from "@/components/home/sections/JourneysSection"
import KnowledgeSection from "@/components/home/sections/KnowledgeSection"
import PlansSection from "@/components/home/sections/PlansSection"
import type { DriveView } from "@/lib/drives/drive-view"
import type { JournalTopStories } from "@/lib/journal-landing"
import type { EventSearchHit } from "@/lib/meilisearch"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

/**
 * Homepage narrative, below the hero: offer the three journeys, something
 * small to do, a moment of discovery, then what the atlas shows,
 * how far we've got and what's free. Last, what's on, what to
 * read and learn, and the ask.
 */
export function HomepageSections({
  content,
  stats,
  tasks,
  featuredDrive,
  globeMarkers,
  featuredLibraries,
  continents,
  countryBreakdown,
  events,
  journal,
  locale,
  viewerPlan,
}: {
  readonly content: HomepageContent
  readonly stats: HomepageStats | null
  readonly tasks: readonly ContributionTask[]
  /** A pinned or featured open drive; replaces the task rows when set. */
  readonly featuredDrive?: DriveView | null
  readonly globeMarkers: readonly LibraryMarker[]
  readonly featuredLibraries?: PopulatedFeaturedLibraryData[] | null
  readonly continents: HomepageContinentSummary[]
  readonly countryBreakdown?: CountryBreakdown
  /** The next few events; the section is left out when there are none. */
  readonly events: readonly EventSearchHit[]
  readonly journal: JournalTopStories
  readonly locale: Locale
  /** The signed-in viewer's plan key; undefined for a visitor. */
  readonly viewerPlan?: string
}) {
  return (
    <div id="homepage-content">
      <JourneysSection
        intro={content.journeysIntro}
        journeys={content.journeys}
      />
      <ContributeSection
        band={content.communityBand}
        steps={content.communitySteps}
        tasksIntro={content.tasksIntro}
        tasks={tasks}
        featuredDrive={featuredDrive}
      />
      <FeaturedLibrariesSection
        libraries={featuredLibraries}
        intro={content.featuredIntro}
        total={stats?.libraries}
      />
      <AtlasSection band={content.atlasBand} markers={globeMarkers} />
      <CoverageSection
        intro={content.coverageIntro}
        continents={continents}
        countryBreakdown={countryBreakdown}
      />
      <PlansSection intro={content.plansIntro} viewerPlan={viewerPlan} />
      <EventsSection intro={content.eventsIntro} events={events} />
      <JournalSection
        intro={content.journalIntro}
        stories={journal}
        locale={locale}
      />
      <KnowledgeSection
        band={content.knowledgeBand}
        links={content.knowledgeLinks}
      />
      <ClosingSection
        band={content.finalCta}
        steps={content.finalBenefits}
        signedIn={viewerPlan !== undefined}
        openIntro={content.openIntro}
        openLinks={content.openLinks}
      />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections

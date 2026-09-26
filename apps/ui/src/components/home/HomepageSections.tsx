import ContributeBand from "@/components/home/ContributeBand"
import type { HomepageContent } from "@/components/home/homepage.content"
import type {
  ContributionTask,
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import CoverageSection, {
  type CountryBreakdown,
} from "@/components/home/sections/CoverageSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import FinalCtaSection from "@/components/home/sections/FinalCtaSection"
import JournalSection from "@/components/home/sections/JournalSection"
import JourneysSection from "@/components/home/sections/JourneysSection"
import OpenByDesignSection from "@/components/home/sections/OpenByDesignSection"
import ProofStrip from "@/components/home/sections/ProofStrip"
import StewardBand from "@/components/home/sections/StewardBand"
import TasksSection from "@/components/home/sections/TasksSection"
import type {
  BlogArticleSummary,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"

/**
 * Homepage narrative, below the hero: prove it's a shared project, offer the
 * three journeys, give a moment of discovery, then hand the visitor something
 * small to do — and close on how the community model works.
 */
export function HomepageSections({
  content,
  stats,
  tasks,
  featuredLibraries,
  continents,
  countryBreakdown,
  totalCountriesByContinent,
  blogArticles,
}: {
  readonly content: HomepageContent
  readonly stats: HomepageStats | null
  readonly tasks: readonly ContributionTask[]
  readonly featuredLibraries?: PopulatedFeaturedLibraryData[] | null
  readonly continents: HomepageContinentSummary[]
  readonly countryBreakdown?: CountryBreakdown
  readonly totalCountriesByContinent?: Record<string, number>
  readonly blogArticles: BlogArticleSummary[]
}) {
  return (
    <div id="homepage-content">
      <ProofStrip
        intro={content.proofIntro}
        definition={content.openDataDefinition}
        stats={stats}
      />
      <JourneysSection
        intro={content.journeysIntro}
        journeys={content.journeys}
      />
      <FeaturedLibrariesSection
        libraries={featuredLibraries}
        intro={content.featuredIntro}
        prompt={content.featuredPrompt}
      />
      <TasksSection intro={content.tasksIntro} tasks={tasks} />
      <StewardBand band={content.stewardBand} />
      <CoverageSection
        intro={content.coverageIntro}
        stats={stats}
        continents={continents}
        countryBreakdown={countryBreakdown}
        totalCountriesByContinent={totalCountriesByContinent}
      />
      <JournalSection intro={content.journalIntro} articles={blogArticles} />
      <ContributeBand
        band={content.communityBand}
        steps={content.communitySteps}
      />
      <OpenByDesignSection
        intro={content.openIntro}
        links={content.openLinks}
      />
      <FinalCtaSection
        band={content.finalCta}
        benefitsTitle={content.finalBenefitsTitle}
        benefits={content.finalBenefits}
        progression={content.finalProgression}
      />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections

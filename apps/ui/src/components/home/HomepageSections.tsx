import type { HomepageContent } from "@/components/home/homepage.content"
import type {
  ContributionTask,
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import AtlasSection from "@/components/home/sections/AtlasSection"
import ContributeSection from "@/components/home/sections/ContributeSection"
import CoverageSection, {
  type CountryBreakdown,
} from "@/components/home/sections/CoverageSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import FinalCtaSection from "@/components/home/sections/FinalCtaSection"
import JournalCard from "@/components/home/sections/JournalCard"
import JourneysSection from "@/components/home/sections/JourneysSection"
import OpenByDesignSection from "@/components/home/sections/OpenByDesignSection"
import PlansSection from "@/components/home/sections/PlansSection"
import StatsStrip from "@/components/home/sections/StatsStrip"
import StewardCard from "@/components/home/sections/StewardCard"
import type {
  BlogArticleSummary,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"

/**
 * Homepage narrative, below the hero: prove the index is real, offer the
 * three journeys, a moment of discovery, then something small to do. After
 * that, what the atlas and plans add, how far we've got, and the ask.
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
  viewerPlan,
}: {
  readonly content: HomepageContent
  readonly stats: HomepageStats | null
  readonly tasks: readonly ContributionTask[]
  readonly featuredLibraries?: PopulatedFeaturedLibraryData[] | null
  readonly continents: HomepageContinentSummary[]
  readonly countryBreakdown?: CountryBreakdown
  readonly totalCountriesByContinent?: Record<string, number>
  readonly blogArticles: BlogArticleSummary[]
  /** The signed-in viewer's plan key; undefined for a visitor. */
  readonly viewerPlan?: string
}) {
  const latestArticle = blogArticles[0]

  return (
    <div id="homepage-content">
      <StatsStrip stats={stats} />
      <JourneysSection
        intro={content.journeysIntro}
        journeys={content.journeys}
      />
      <FeaturedLibrariesSection
        libraries={featuredLibraries}
        intro={content.featuredIntro}
        total={stats?.libraries}
      />
      <ContributeSection
        band={content.communityBand}
        steps={content.communitySteps}
        tasksIntro={content.tasksIntro}
        tasks={tasks}
      />
      <AtlasSection band={content.atlasBand} />
      <PlansSection intro={content.plansIntro} viewerPlan={viewerPlan} />
      <CoverageSection
        intro={content.coverageIntro}
        continents={continents}
        countryBreakdown={countryBreakdown}
        totalCountriesByContinent={totalCountriesByContinent}
      />
      <div
        className={`mx-auto grid w-full max-w-[1360px] gap-5 px-4 pt-[clamp(64px,8vw,104px)] sm:px-8 ${
          latestArticle ? "lg:grid-cols-2" : ""
        }`}
      >
        <StewardCard band={content.stewardBand} />
        {latestArticle ? (
          <JournalCard intro={content.journalIntro} article={latestArticle} />
        ) : null}
      </div>
      <FinalCtaSection
        band={content.finalCta}
        benefits={content.finalBenefits}
        signedIn={viewerPlan !== undefined}
      />
      <OpenByDesignSection
        intro={content.openIntro}
        links={content.openLinks}
      />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections

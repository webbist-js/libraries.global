import ContributeBand from "@/components/home/ContributeBand"
import type {
  HomepageContinentSummary,
  HomepageData,
} from "@/components/home/homepage.types"
import CoverageSection from "@/components/home/sections/CoverageSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import JournalSection from "@/components/home/sections/JournalSection"
import OpenByDesignSection from "@/components/home/sections/OpenByDesignSection"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

export function HomepageSections({
  continents,
  homepage,
  blogArticles,
}: {
  readonly continents: HomepageContinentSummary[]
  readonly homepage: HomepageData
  readonly blogArticles: BlogArticleSummary[]
}) {
  return (
    <div id="homepage-content">
      <FeaturedLibrariesSection libraries={homepage?.featuredLibraries} />
      <CoverageSection continents={continents} />
      <JournalSection articles={blogArticles} />
      <ContributeBand />
      <OpenByDesignSection />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections

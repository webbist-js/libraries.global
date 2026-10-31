import type { NetworkSummary } from "@repo/shared-data"
import type { Locale } from "next-intl"

import type { HomepageContent } from "@/components/home/homepage.content"
import type {
  ContributionTask,
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import { HomepageFeatures } from "@/components/home/HomepageFeatures"
import AtlasSection from "@/components/home/sections/AtlasSection"
import ClosingSection from "@/components/home/sections/ClosingSection"
import ContributeSection from "@/components/home/sections/ContributeSection"
import { DiscoverySection } from "@/components/home/sections/DiscoverySection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import { HomeEditorialSection } from "@/components/home/sections/HomeEditorialSection"
import { LibraryStaffSection } from "@/components/home/sections/LibraryStaffSection"
import type { DriveView } from "@/lib/drives/drive-view"
import type { JournalTopStories } from "@/lib/journal-landing"
import type { EventSearchHit } from "@/lib/meilisearch"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

/** Discover → understand → contribute → manage → read → trust and support. */
export function HomepageSections({
  content,
  stats,
  tasks,
  drives,
  featuredLibraries,
  continents,
  networks,
  events,
  journal,
  locale,
  atlasImage,
}: {
  readonly content: HomepageContent
  readonly stats: HomepageStats | null
  readonly tasks: readonly ContributionTask[]
  readonly drives: readonly DriveView[]
  readonly featuredLibraries: PopulatedFeaturedLibraryData[]
  readonly continents: HomepageContinentSummary[]
  readonly networks: readonly NetworkSummary[]
  readonly events: readonly EventSearchHit[]
  readonly journal: JournalTopStories
  readonly locale: Locale
  readonly atlasImage?: {
    url?: string | null
    alternativeText?: string | null
  } | null
}) {
  return (
    <div id="homepage-content" className="home-flow">
      <FeaturedLibrariesSection
        libraries={featuredLibraries}
        intro={content.featuredIntro}
        total={stats?.libraries}
      />
      <DiscoverySection
        continents={continents}
        networks={networks}
        events={events}
        locale={locale}
      />
      <AtlasSection band={content.atlasBand} image={atlasImage} />
      <HomepageFeatures />
      <ContributeSection
        band={content.communityBand}
        steps={content.communitySteps}
        tasksIntro={content.tasksIntro}
        tasks={tasks}
        drives={drives}
      />
      <LibraryStaffSection
        band={content.libraryBand}
        tools={content.libraryTools}
      />
      <HomeEditorialSection
        intro={content.journalIntro}
        stories={journal}
        links={content.knowledgeLinks}
        locale={locale}
      />
      <ClosingSection
        band={content.finalCta}
        trustItems={content.trustItems}
        openLinks={content.openLinks}
        plansIntro={content.plansIntro}
      />
    </div>
  )
}

export default HomepageSections

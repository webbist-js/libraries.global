import type { Locale } from "next-intl"
import { Suspense, use } from "react"

import { MainContent } from "@/components/ds/MainContent"
import { HomeFooter } from "@/components/home/HomeFooter"
import { resolveHomepageContent } from "@/components/home/homepage.content"
import {
  HomepageContentLoading,
  HomepageFrame,
} from "@/components/home/HomepageFrame"
import HomepageHero from "@/components/home/HomepageHero"
import HomepageSections from "@/components/home/HomepageSections"
import { pickTasks } from "@/components/home/sections/ContributeSection"
import StatsStrip from "@/components/home/sections/StatsStrip"
import StrapiStructuredData from "@/components/page-builder/components/seo-utilities/StrapiStructuredData"
import { fetchHomepageDriveViews } from "@/lib/drives/drive-view-server"
import { loadJournalTopStories } from "@/lib/journal-landing"
import { fetchGlobeMarkers, fetchUpcomingEvents } from "@/lib/meilisearch"
import { publicNetworkList } from "@/lib/networks/server"
import {
  fetchFooter,
  fetchHomepage,
  fetchHomepageContinents,
  fetchHomepageStats,
  fetchHomepagePillars,
  fetchIncompleteLibraries,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"

import "@/components/home/homepage.css"

export function LibraryHomePage({ locale }: { readonly locale: Locale }) {
  return (
    <HomepageFrame>
      <Suspense fallback={<HomepageContentLoading />}>
        <HomepageContent locale={locale} />
      </Suspense>
    </HomepageFrame>
  )
}

function HomepageContent({ locale }: { readonly locale: Locale }) {
  const homepagePromise = fetchHomepage(locale)
  const pillarsPromise = fetchHomepagePillars(locale)
  const networksPromise = publicNetworkList(new URLSearchParams()).catch(
    () => null
  )
  const continentSummariesPromise = fetchHomepageContinents(locale)
  const footerPromise = fetchFooter(locale)
  const legalDocumentsPromise = fetchLegalDocuments(locale, "published")
  const journalPromise = loadJournalTopStories(locale)
  // The next four events in the coming month; none means no events section.
  const eventsPromise = fetchUpcomingEvents({ days: 30, limit: 3 }).catch(
    () => []
  )

  const statsPromise = fetchHomepageStats()
  const incompletePromise = fetchIncompleteLibraries()
  const drivesPromise = fetchHomepageDriveViews(locale)

  // One marker per 1° cell with libraries, plus each featured library.
  const globeMarkersPromise = fetchGlobeMarkers(locale).catch(() => [])

  const homepage = use(homepagePromise)?.data
  const continentSummaries = use(continentSummariesPromise)?.data ?? []
  const footer = use(footerPromise)?.data
  const legalDocuments = use(legalDocumentsPromise).data
  const journal = use(journalPromise)
  const events = use(eventsPromise)
  const stats = use(statsPromise)
  const tasks = pickTasks(use(incompletePromise), 3)
  const drives = use(drivesPromise)
  const content = resolveHomepageContent(homepage)
  const globeMarkers = use(globeMarkersPromise)
  const pillars = use(pillarsPromise)
  const networks = use(networksPromise)?.networks ?? []

  return (
    <div data-homepage="true">
      <StrapiStructuredData structuredData={homepage?.seo?.structuredData} />

      <MainContent className="relative z-0 flex-1">
        <HomepageHero
          eyebrow={content.heroEyebrow}
          title={content.heroTitle}
          text={content.heroText}
          markers={globeMarkers}
        />

        {stats ? (
          <div className="home-hero-stats relative z-10 w-full">
            <StatsStrip stats={stats} appearance="hero" />
          </div>
        ) : null}

        <HomepageSections
          content={content}
          stats={stats}
          tasks={tasks}
          drives={drives}
          featuredLibraries={pillars}
          continents={continentSummaries}
          networks={networks}
          atlasImage={homepage?.atlasImage}
          events={events}
          journal={journal}
          locale={locale}
        />
      </MainContent>

      <HomeFooter footer={footer} legalDocuments={legalDocuments} />
    </div>
  )
}

LibraryHomePage.displayName = "LibraryHomePage"

export default LibraryHomePage

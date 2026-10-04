import type { Locale } from "next-intl"
import { use } from "react"

import GlobalFooter from "@/components/global/GlobalFooter"
import GlobalHeader from "@/components/global/GlobalHeader"
import { resolveHomepageContent } from "@/components/home/homepage.content"
import HomepageHero from "@/components/home/HomepageHero"
import HomepageSections from "@/components/home/HomepageSections"
import { pickTasks } from "@/components/home/sections/ContributeSection"
import StrapiStructuredData from "@/components/page-builder/components/seo-utilities/StrapiStructuredData"
import { T } from "@/lib/design-tokens"
import { loadJournalTopStories } from "@/lib/journal-landing"
import { fetchGlobeMarkers, fetchUpcomingEvents } from "@/lib/meilisearch"
import {
  fetchFooter,
  fetchHomepage,
  fetchHomepageContinents,
  fetchHomepageStats,
  fetchIncompleteLibraries,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"

export function LibraryHomePage({
  locale,
  viewerPlan,
}: {
  readonly locale: Locale
  /** The signed-in viewer's plan key; undefined for a visitor. */
  readonly viewerPlan?: string
}) {
  const homepagePromise = fetchHomepage(locale)
  const continentSummariesPromise = fetchHomepageContinents(locale)
  const footerPromise = fetchFooter(locale)
  const legalDocumentsPromise = fetchLegalDocuments(locale, "published")
  const journalPromise = loadJournalTopStories(locale)
  // The next four events in the coming month; none means no events section.
  const eventsPromise = fetchUpcomingEvents({ days: 30, limit: 4 })

  const statsPromise = fetchHomepageStats()
  const incompletePromise = fetchIncompleteLibraries()

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
  const content = resolveHomepageContent(homepage)
  const globeMarkers = use(globeMarkersPromise)

  // Per-continent country breakdown for the coverage section, counted in
  // Strapi over every published library.
  const countryBreakdown: Record<string, { name: string; count: number }[]> =
    Object.fromEntries(
      continentSummaries.flatMap((c) =>
        c.slug && c.countries?.length
          ? [
              [
                c.slug,
                c.countries.map(({ name, libraryCount }) => ({
                  name,
                  count: libraryCount,
                })),
              ],
            ]
          : []
      )
    )

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <div data-homepage="true">
        <StrapiStructuredData structuredData={homepage?.seo?.structuredData} />

        <GlobalHeader locale={locale} />

        <main className="relative z-10 flex-1">
          <HomepageHero
            eyebrow={content.heroEyebrow}
            title={content.heroTitle}
            text={content.heroText}
            markers={globeMarkers}
          />

          <HomepageSections
            content={content}
            stats={stats}
            tasks={tasks}
            atlasImage={homepage?.atlasImage}
            featuredLibraries={homepage?.featuredLibraries}
            continents={continentSummaries}
            countryBreakdown={countryBreakdown}
            events={events}
            journal={journal}
            locale={locale}
            viewerPlan={viewerPlan}
          />
        </main>

        <GlobalFooter
          footer={footer}
          legalDocuments={legalDocuments}
          locale={locale}
        />
      </div>
    </div>
  )
}

LibraryHomePage.displayName = "LibraryHomePage"

export default LibraryHomePage

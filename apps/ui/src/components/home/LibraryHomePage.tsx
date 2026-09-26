import type { Locale } from "next-intl"
import { use } from "react"

import GlobalFooter from "@/components/global/GlobalFooter"
import GlobalHeader from "@/components/global/GlobalHeader"
import { resolveHomepageContent } from "@/components/home/homepage.content"
import HomepageHero from "@/components/home/HomepageHero"
import HomepageSections from "@/components/home/HomepageSections"
import { pickTasks } from "@/components/home/sections/TasksSection"
import StrapiStructuredData from "@/components/page-builder/components/seo-utilities/StrapiStructuredData"
import { T } from "@/lib/design-tokens"
import {
  fetchFooter,
  fetchHomepage,
  fetchHomepageContinents,
  fetchHomepageStats,
  fetchIncompleteLibraries,
  fetchRecentBlogArticles,
} from "@/lib/strapi-api/content/server"

export function LibraryHomePage({ locale }: { readonly locale: Locale }) {
  const homepagePromise = fetchHomepage(locale)
  const continentSummariesPromise = fetchHomepageContinents(locale)
  const footerPromise = fetchFooter(locale)
  const blogArticlesPromise = fetchRecentBlogArticles(locale)
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

  const statsPromise = fetchHomepageStats()
  const incompletePromise = fetchIncompleteLibraries()

  // Every published record with coordinates — plotted on the hero globe and
  // aggregated for the coverage breakdown.
  const markersPromise = fetch(
    `${STRAPI}/api/libraries?pagination[pageSize]=500&fields[0]=location&fields[1]=featured&populate[country][fields][0]=name&populate[continent][fields][0]=slug&status=published`,
    { next: { revalidate: 300 } }
  )
    .then((r) => r.json())
    .catch(() => null)

  const homepage = use(homepagePromise)?.data
  const continentSummaries = use(continentSummariesPromise)?.data ?? []
  const footer = use(footerPromise)?.data
  const blogArticles = use(blogArticlesPromise)?.data ?? []
  const stats = use(statsPromise)
  const tasks = pickTasks(use(incompletePromise), 3)
  const content = resolveHomepageContent(homepage)
  const markersJson = use(markersPromise) as {
    data?: {
      location?: { lat?: number | string; lng?: number | string } | null
      featured?: boolean | null
      country?: { name?: string | null } | null
      continent?: { slug?: string | null } | null
    }[]
  } | null

  const records = markersJson?.data ?? []
  const globeMarkers = records
    .map((entry) => ({
      lat: Number(entry.location?.lat),
      lng: Number(entry.location?.lng),
      featured: entry.featured === true,
    }))
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))

  // Per-continent country breakdown for the coverage section.
  const countryBreakdown: Record<string, { name: string; count: number }[]> = {}
  for (const entry of records) {
    const cSlug = entry.continent?.slug
    const countryName = entry.country?.name
    if (!cSlug || !countryName) continue
    countryBreakdown[cSlug] ??= []
    const bucket = countryBreakdown[cSlug]
    const existing = bucket.find((c) => c.name === countryName)
    if (existing) existing.count += 1
    else bucket.push({ name: countryName, count: 1 })
  }
  for (const bucket of Object.values(countryBreakdown)) {
    bucket.sort((a, b) => b.count - a.count)
  }

  // Total country count per continent-with-records ("39 more countries: none yet")
  const totalCountriesByContinent: Record<string, number> = {}
  const continentSlugs = Object.keys(countryBreakdown)
  const countryTotals = use(
    Promise.all(
      continentSlugs.map((slug) =>
        fetch(
          `${STRAPI}/api/countries?filters[continent][slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1&fields[0]=id`,
          { next: { revalidate: 3600 } }
        )
          .then((r) => r.json())
          .then((j) => j?.meta?.pagination?.total ?? null)
          .catch(() => null)
      )
    )
  )
  continentSlugs.forEach((slug, i) => {
    const total = countryTotals[i]
    if (typeof total === "number") totalCountriesByContinent[slug] = total
  })

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
            featuredLibraries={homepage?.featuredLibraries}
            continents={continentSummaries}
            countryBreakdown={countryBreakdown}
            totalCountriesByContinent={totalCountriesByContinent}
            blogArticles={blogArticles}
          />
        </main>

        <GlobalFooter locale={locale} footer={footer} />
      </div>
    </div>
  )
}

LibraryHomePage.displayName = "LibraryHomePage"

export default LibraryHomePage

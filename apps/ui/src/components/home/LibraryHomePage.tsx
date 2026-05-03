import type { Locale } from "next-intl"
import { use } from "react"

import { PageShell } from "@/components/ds"
import GlobalFooter from "@/components/global/GlobalFooter"
import GlobalHeader from "@/components/global/GlobalHeader"
import HomepageHero from "@/components/home/HomepageHero"
import HomepageSections from "@/components/home/HomepageSections"
import StrapiStructuredData from "@/components/page-builder/components/seo-utilities/StrapiStructuredData"
import {
  fetchFooter,
  fetchHomepage,
  fetchHomepageContinents,
  fetchNavbar,
  fetchRecentBlogArticles,
} from "@/lib/strapi-api/content/server"

export function LibraryHomePage({ locale }: { readonly locale: Locale }) {
  const homepagePromise = fetchHomepage(locale)
  const continentSummariesPromise = fetchHomepageContinents(locale)
  const navbarPromise = fetchNavbar(locale)
  const footerPromise = fetchFooter(locale)
  const blogArticlesPromise = fetchRecentBlogArticles(locale)
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

  const statsPromise = fetch(
    `${STRAPI}/api/libraries?pagination[pageSize]=1&fields[0]=id&status=published`,
    { next: { revalidate: 300 } }
  )
    .then((r) => r.json())
    .catch(() => null)

  const contributeStatsPromise = fetch(
    `${STRAPI}/api/content-moderation/submissions/stats`,
    { next: { revalidate: 3600 } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)

  const homepage = use(homepagePromise)?.data
  const continentSummaries = use(continentSummariesPromise)?.data ?? []
  const navbar = use(navbarPromise)?.data
  const footer = use(footerPromise)?.data
  const blogArticles = use(blogArticlesPromise)?.data ?? []
  const stats = use(statsPromise)
  const contributeStats = use(contributeStatsPromise)?.data ?? null

  const libraryCount: number | null = stats?.meta?.pagination?.total ?? null
  const contributorCount: number | null =
    contributeStats?.totalContributors ?? null
  const languageCount: number | null =
    contributeStats?.totalLanguages > 0 ? contributeStats.totalLanguages : null

  return (
    <PageShell className="relative isolate flex min-h-screen w-full flex-col overflow-hidden">
      <div data-homepage="true">
        <StrapiStructuredData structuredData={homepage?.seo?.structuredData} />

        <GlobalHeader locale={locale} navbar={navbar} />

        <main className="relative z-10 flex-1">
          <HomepageHero
            heroEyebrow={homepage?.heroEyebrow}
            heroTitle={homepage?.heroTitle}
            heroText={homepage?.heroText}
            libraryCount={libraryCount}
            contributorCount={contributorCount}
            languageCount={languageCount}
          />

          <HomepageSections
            continents={continentSummaries}
            homepage={homepage}
            locale={locale}
            blogArticles={blogArticles}
          />
        </main>

        <GlobalFooter locale={locale} footer={footer} />
      </div>
    </PageShell>
  )
}

LibraryHomePage.displayName = "LibraryHomePage"

export default LibraryHomePage

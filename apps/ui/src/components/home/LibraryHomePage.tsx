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
  const statsPromise = fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/libraries?pagination[pageSize]=1&fields[0]=id&status=published`,
    { next: { revalidate: 300 } }
  )
    .then((r) => r.json())
    .catch(() => null)

  const homepage = use(homepagePromise)?.data
  const continentSummaries = use(continentSummariesPromise)?.data ?? []
  const navbar = use(navbarPromise)?.data
  const footer = use(footerPromise)?.data
  const blogArticles = use(blogArticlesPromise)?.data ?? []
  const stats = use(statsPromise)

  const libraryCount: number | null = stats?.meta?.pagination?.total ?? null

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

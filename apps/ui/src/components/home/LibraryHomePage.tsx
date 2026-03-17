import type { Locale } from "next-intl"
import { use } from "react"

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
} from "@/lib/strapi-api/content/server"

export function LibraryHomePage({ locale }: { readonly locale: Locale }) {
  const homepagePromise = fetchHomepage(locale)
  const continentSummariesPromise = fetchHomepageContinents(locale)
  const navbarPromise = fetchNavbar(locale)
  const footerPromise = fetchFooter(locale)

  const homepage = use(homepagePromise)?.data
  const continentSummaries = use(continentSummariesPromise)?.data ?? []
  const navbar = use(navbarPromise)?.data
  const footer = use(footerPromise)?.data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-[#050816] text-white"
      data-homepage="true"
    >
      <StrapiStructuredData structuredData={homepage?.seo?.structuredData} />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,149,255,0.18),transparent_34%),radial-gradient(circle_at_70%_58%,rgba(103,221,255,0.12),transparent_22%),linear-gradient(180deg,#060914_0%,#050816_54%,#070b16_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0)_18%,rgba(255,255,255,0)_82%,rgba(255,255,255,0.03)_100%)] opacity-70" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        <HomepageHero
          heroEyebrow={homepage?.heroEyebrow}
          heroTitle={homepage?.heroTitle}
          heroText={homepage?.heroText}
        />

        <HomepageSections
          continents={continentSummaries}
          homepage={homepage}
          locale={locale}
        />
      </main>

      <GlobalFooter locale={locale} footer={footer} />
    </div>
  )
}

LibraryHomePage.displayName = "LibraryHomePage"

export default LibraryHomePage

import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale, getTranslations } from "next-intl/server"

import { AboutExperience } from "@/components/about/AboutExperience"
import { InformationPage } from "@/components/dashboard/InformationPage"
import { withMessages } from "@/i18n/scoped-messages"
import {
  fetchAboutGlobeCountries,
  fetchAboutLibraries,
} from "@/lib/about-server"
import { fetchGlobeMarkers } from "@/lib/meilisearch"
import { buildMetadata } from "@/lib/seo/metadata"
import {
  fetchHomepageContinents,
  fetchHomepageStats,
} from "@/lib/strapi-api/content/server"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "About Libraries Global",
    description:
      "Learn about Libraries Global, the independent, open project documenting the world's libraries, how records are built and how to contribute.",
    path: "about",
    locale,
  })
}

async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const tStatic = await getTranslations("staticUi")
  const tExisting = await getTranslations()
  const continentsPromise = fetchHomepageContinents(locale)
  const [markers, stats, continentResponse, libraries, countries] =
    await Promise.all([
      fetchGlobeMarkers(locale, true).catch(() => []),
      fetchHomepageStats(),
      continentsPromise,
      fetchAboutLibraries(locale),
      fetchAboutGlobeCountries(
        locale,
        continentsPromise.then((response) => response?.data ?? [])
      ),
    ])

  return (
    <InformationPage
      title={tStatic("common.aboutLibrariesGlobal")}
      links={[
        { href: "#shared-purpose", label: "Libraries around the world" },
        {
          href: "#our-purpose",
          label: tExisting("staticUi.about.our_purpose"),
        },
        {
          href: "#what-we-include",
          label: tExisting("staticUi.about.what_we_include"),
        },
        {
          href: "#how-we-build-it",
          label: tExisting("staticUi.about.how_records_are_built"),
        },
        { href: "#where-we-are", label: "Our coverage" },
        {
          href: "#open-by-design",
          label: tExisting("staticUi.home.openDesign"),
        },
        { href: "#take-part", label: "Take part" },
      ]}
    >
      <AboutExperience
        markers={markers}
        countries={countries}
        stats={stats}
        continents={continentResponse?.data ?? []}
        libraries={libraries}
      />
    </InformationPage>
  )
}

export default withMessages(AboutPage, "[locale]/(dashboard)/about/page")

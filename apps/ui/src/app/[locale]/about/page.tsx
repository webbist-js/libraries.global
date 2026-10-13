import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { AboutExperience } from "@/components/about/AboutExperience"
import GlobalHeader from "@/components/global/GlobalHeader"
import { fetchAboutLibraries } from "@/lib/about-server"
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

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const [markers, stats, continentResponse, libraries] = await Promise.all([
    fetchGlobeMarkers(locale).catch(() => []),
    fetchHomepageStats(),
    fetchHomepageContinents(locale),
    fetchAboutLibraries(locale),
  ])

  return (
    <>
      <GlobalHeader locale={locale} />
      <AboutExperience
        markers={markers}
        stats={stats}
        continents={continentResponse?.data ?? []}
        libraries={libraries}
      />
    </>
  )
}

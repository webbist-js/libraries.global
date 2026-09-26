import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import FullMapPage from "@/components/map/FullMapPage"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/map">): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "World library map",
    description:
      "Explore libraries worldwide on an interactive map. Drill down from continents to individual library locations.",
    path: "map",
    locale,
  })
}

export default async function MapPage({
  params,
  searchParams,
}: PageProps<"/[locale]/map">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const { q } = (await searchParams) as { q?: string }

  return <FullMapPage locale={locale} initialQuery={q} />
}

import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { AtlasExplorer } from "@/components/atlas/AtlasExplorer"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/map">): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Atlas: map of the world's libraries",
    description:
      "Find libraries anywhere on one interactive map. Filter by type, opening hours and facilities, and add data layers such as library density and record completeness.",
    path: "map",
    locale,
  })
}

export default async function MapPage({ params }: PageProps<"/[locale]/map">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return <AtlasExplorer />
}

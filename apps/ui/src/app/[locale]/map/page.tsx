import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import FullMapPage from "@/components/map/FullMapPage"

export const metadata: Metadata = {
  title: "World Library Map",
  description:
    "Explore libraries worldwide on an interactive map. Drill down from continents to individual library locations.",
  robots: "index, follow",
  alternates: { canonical: "/map" },
  openGraph: {
    title: "World Library Map",
    description:
      "Explore libraries worldwide on an interactive map. Drill down from continents to individual library locations.",
    type: "website",
    url: "/map",
  },
  twitter: {
    card: "summary",
    title: "World Library Map",
    description:
      "Explore libraries worldwide on an interactive map. Drill down from continents to individual library locations.",
  },
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

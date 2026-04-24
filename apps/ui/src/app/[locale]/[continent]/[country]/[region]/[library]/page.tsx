import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import LibraryDetailPage from "@/components/library/LibraryDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllLibraries,
  fetchLibrary,
  fetchNearbyLibraries,
  fetchNavbar,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) return []
  const result = await fetchAllLibraries(locale as Locale)

  return result.data
    .filter((l) => l.continent?.slug && l.country?.slug && l.region?.slug)
    .map((library) => ({
      continent: library.continent!.slug,
      country: library.country!.slug,
      region: library.region!.slug,
      library: library.slug,
    }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
    library: string
  }>
}): Promise<Metadata> {
  const { locale, library: librarySlug } = await params
  const res = await fetchLibrary(librarySlug, locale as Locale)
  const library = res?.data

  if (!library) return { title: "Library not found" }

  const seo = library.seo
  const title = seo?.metaTitle ?? library.name
  const description =
    seo?.metaDescription ??
    library.summary ??
    `View details for ${library.name}.`

  return {
    title,
    description,
    openGraph: {
      title: seo?.openGraph?.ogTitle ?? title,
      description: seo?.openGraph?.ogDescription ?? description,
      type: seo?.openGraph?.ogType ?? "website",
      images: seo?.metaImage?.url ? [{ url: seo.metaImage.url }] : undefined,
    },
    robots: seo?.metaRobots ?? undefined,
  }
}

export default function LibraryRoutePage(props: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
    library: string
  }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const librarySlug = params.library

  const libraryRes = use(fetchLibrary(librarySlug, locale))
  const library = libraryRes?.data

  if (!library) {
    notFound()
  }

  const navbar = use(fetchNavbar(locale))?.data
  const nearbyLibraries = use(
    fetchNearbyLibraries(librarySlug, library.region?.slug)
  )

  return (
    <LibraryDetailPage
      library={library}
      navbar={navbar}
      locale={locale}
      nearbyLibraries={nearbyLibraries}
    />
  )
}

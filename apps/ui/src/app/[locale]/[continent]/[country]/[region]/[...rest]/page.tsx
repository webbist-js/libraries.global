import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import AreaDetailPage from "@/components/area/AreaDetailPage"
import LibraryDetailPage from "@/components/library/LibraryDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllAreaSlugs,
  fetchAllLibraries,
  fetchArea,
  fetchLibrary,
  fetchNavbar,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) {
    return [
      {
        continent: "europe",
        country: "england",
        region: "greater-london",
        rest: ["british-library"],
      },
    ]
  }

  const [libraryResult, areaResult] = await Promise.all([
    fetchAllLibraries(locale as Locale),
    fetchAllAreaSlugs(locale as Locale),
  ])

  const libraryParams =
    libraryResult?.data
      .filter(
        (library) =>
          library.continent?.slug &&
          library.country?.slug &&
          library.region?.slug
      )
      .map((library) => ({
        continent: library.continent!.slug,
        country: library.country!.slug,
        region: library.region!.slug,
        rest: [library.slug],
      })) ?? []

  const areaParams =
    areaResult.data
      .filter((area) => area.region?.slug && area.country?.slug)
      .map((area) => ({
        region: area.region!.slug,
        rest: [area.slug],
      })) ?? []

  return [...libraryParams, ...areaParams]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
    rest: string[]
  }>
}): Promise<Metadata> {
  const { locale, rest } = await params
  const lastSlug = rest.at(-1)!

  const library = (await fetchLibrary(lastSlug, locale as Locale))?.data
  if (library) {
    const seo = library.seo
    const title = seo?.metaTitle ?? library.name ?? "Library"
    const description =
      seo?.metaDescription ??
      library.summary ??
      `Explore ${library.name} — opening hours, services, amenities and accessibility information.`
    const heroImageUrl = library.heroImage?.url
      ? formatStrapiMediaUrl(library.heroImage.url)
      : undefined
    const ogImageUrl = seo?.metaImage?.url
      ? formatStrapiMediaUrl(seo.metaImage.url)
      : heroImageUrl

    return {
      title,
      description,
      ...(seo?.keywords ? { keywords: seo.keywords } : {}),
      openGraph: {
        title,
        description,
        type: "website",
        ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
      },
    }
  }

  const area = (await fetchArea(rest[0]!, locale as Locale))?.data
  if (area) {
    const title = area.seo?.metaTitle ?? area.name
    const description =
      area.seo?.metaDescription ??
      area.summary ??
      `Explore libraries in ${area.name}.`
    const ogImageUrl = area.seo?.metaImage?.url
      ? formatStrapiMediaUrl(area.seo.metaImage.url)
      : undefined

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
      },
    }
  }

  return { title: "Not found" }
}

export default function RestPage(props: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
    rest: string[]
  }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const {
    continent: continentSlug,
    country: countrySlug,
    region: regionSlug,
    rest,
  } = params

  // Compute slugs before any use() calls so they're stable
  // rest = [slug]          → single segment: area or library
  // rest = [area, library] → two segments: library inside an area
  const areaSlugToFetch = rest[0] ?? ""
  const librarySlugToFetch =
    rest.length === 2 ? (rest[1] ?? "") : (rest[0] ?? "")

  // All use() calls at the top level — consistent count on every render
  const navbar = use(fetchNavbar(locale))?.data
  const areaResult = use(fetchArea(areaSlugToFetch, locale))
  const libraryResult = use(fetchLibrary(librarySlugToFetch, locale))

  const areaData = areaResult?.data ?? null
  const libraryData = libraryResult?.data ?? null

  // Unsupported depth
  if (rest.length === 0 || rest.length > 2) notFound()

  // Two segments: [areaSlug, librarySlug] — render library
  if (rest.length === 2) {
    if (!libraryData) notFound()

    return (
      <LibraryDetailPage
        library={libraryData}
        navbar={navbar}
        locale={locale}
      />
    )
  }

  // Single segment: area takes priority, then library
  if (areaData) {
    return (
      <AreaDetailPage
        area={areaData}
        navbar={navbar}
        locale={locale}
        slug={areaSlugToFetch}
        regionSlug={regionSlug}
        countrySlug={countrySlug}
        continentSlug={continentSlug}
      />
    )
  }

  if (libraryData) {
    return (
      <LibraryDetailPage
        library={libraryData}
        navbar={navbar}
        locale={locale}
      />
    )
  }

  notFound()
}

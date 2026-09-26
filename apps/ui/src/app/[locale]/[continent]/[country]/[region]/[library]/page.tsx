import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import LibraryDetailPage from "@/components/library/LibraryDetailPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { buildBreadcrumbSchema, buildLibrarySchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata"
import {
  fetchAllLibraries,
  fetchLibrary,
  fetchLibraryRevisions,
  fetchNearbyLibraries,
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

/** Canonical path from the library's own relations (falls back to URL params). */
function libraryPath(
  library: NonNullable<
    NonNullable<Awaited<ReturnType<typeof fetchLibrary>>>["data"]
  >,
  fallback: { continent: string; country: string; region: string }
) {
  const continent = library.continent?.slug ?? fallback.continent
  const country = library.country?.slug ?? fallback.country
  const region = library.region?.slug ?? fallback.region

  return {
    continent,
    country,
    region,
    path: `${continent}/${country}/${region}/${library.slug}`,
  }
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : v

  return typeof n === "number" && Number.isFinite(n) ? n : null
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
  const {
    locale,
    continent,
    country,
    region,
    library: librarySlug,
  } = await params
  const res = await fetchLibrary(librarySlug, locale as Locale)
  const library = res?.data

  if (!library) return { title: "Library not found", robots: { index: false } }

  const seo = library.seo
  const name = library.name ?? "Library"
  const place = [library.city, library.country?.name].filter(Boolean).join(", ")
  const title = seo?.metaTitle ?? (place ? `${name}, ${place}` : name)
  const description =
    seo?.metaDescription ??
    library.summary ??
    `${name}${place ? ` in ${place}` : ""} — opening hours, collections, location, services and accessibility.`
  const image = formatStrapiMediaUrl(
    seo?.openGraph?.ogImage?.url ??
      seo?.metaImage?.url ??
      library.heroImage?.url
  )
  const { path } = libraryPath(library, { continent, country, region })

  return buildMetadata({
    title,
    description,
    path,
    locale,
    image,
    imageAlt: library.heroImage?.alternativeText ?? name,
    robots: seo?.metaRobots?.replaceAll(" ", "").startsWith("noindex")
      ? "noindex"
      : "index",
  })
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

  const nearbyLibraries = use(
    fetchNearbyLibraries(
      librarySlug,
      library.region?.slug,
      library.location as { lat?: unknown; lng?: unknown } | null
    )
  )
  const revisions = use(fetchLibraryRevisions(library.documentId))

  const crumbs = libraryPath(library, {
    continent: params.continent,
    country: params.country,
    region: params.region,
  })
  const url = absoluteUrl(crumbs.path, locale)
  const location = library.location as { lat?: unknown; lng?: unknown } | null

  return (
    <>
      <JsonLd
        data={[
          buildLibrarySchema({
            name: library.name ?? librarySlug,
            url,
            description: library.summary,
            alternateName: library.shortName,
            streetAddress: library.streetAddress,
            city: library.city,
            region: library.region?.name,
            postalCode: library.postalCode,
            countryCode: library.country?.iso2,
            phone: library.phone,
            email: library.email,
            website: library.website,
            wikidataId: library.wikidataId,
            latitude: toNumber(location?.lat),
            longitude: toNumber(location?.lng),
            imageUrl: formatStrapiMediaUrl(library.heroImage?.url),
            foundingDate: library.foundedYear,
            openingTimes: library.openingTimes as OpeningTimesValue | null,
          }),
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl("", locale) },
            {
              name: library.continent?.name ?? crumbs.continent,
              url: absoluteUrl(crumbs.continent, locale),
            },
            {
              name: library.country?.name ?? crumbs.country,
              url: absoluteUrl(`${crumbs.continent}/${crumbs.country}`, locale),
            },
            {
              name: library.region?.name ?? crumbs.region,
              url: absoluteUrl(
                `${crumbs.continent}/${crumbs.country}/${crumbs.region}`,
                locale
              ),
            },
            { name: library.name ?? librarySlug, url },
          ]),
        ]}
      />
      <LibraryDetailPage
        library={library}
        locale={locale}
        nearbyLibraries={nearbyLibraries}
        revisions={revisions}
      />
    </>
  )
}

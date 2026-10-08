import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import {
  type OpeningTimesValue,
  toLatLng,
} from "@/components/library/library-page.helpers"
import LibraryDetailPage from "@/components/library/LibraryDetailPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { isDevelopment } from "@/lib/general-helpers"
import { fetchPublicLibraryNotices } from "@/lib/library-notices"
import { buildBreadcrumbSchema, buildLibrarySchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata"
import { fetchDataset } from "@/lib/strapi-api/content/datasets"
import { fetchLibraryArea } from "@/lib/strapi-api/content/library-area"
import {
  fetchFeaturedLibraryPaths,
  fetchLibrary,
  fetchLibraryFollowerCount,
  fetchLibraryHistory,
  fetchLibraryHistoryStats,
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
  // Featured libraries only: prerendering every library would fan out a
  // request per page for the whole index at each build. The rest render on
  // first request (dynamicParams) and are then cached.
  const result = await fetchFeaturedLibraryPaths(locale as Locale)

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
    // A default-locale stand-in for a missing translation isn't indexed.
    robots: seo?.metaRobots?.replaceAll(" ", "").startsWith("noindex")
      ? "noindex"
      : res?.localeFallback
        ? "noindex-follow"
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

  // Start every dependent fetch before suspending on any of them, so they
  // run in parallel instead of one per render pass.
  const noticesPromise = fetchPublicLibraryNotices(library.documentId)
  const areaPromise = fetchLibraryArea({
    slug: librarySlug,
    regionSlug: library.region?.slug,
    location: toLatLng(library.location),
    openingTimes: library.openingTimes as OpeningTimesValue | null,
    locale,
  })
  // The page is static and shared, so history is fetched without values;
  // a viewer with `library.history` gets them from the history route.
  const historyPromise = fetchLibraryHistory(library.documentId, {
    values: false,
  })
  const historyStatsPromise = fetchLibraryHistoryStats(library.documentId)
  const datasetPromise = fetchDataset(library.source)
  const followersPromise = fetchLibraryFollowerCount(library.documentId)
  const localesPromise = fetchArticleLocales()

  const notices = use(noticesPromise)
  const area = use(areaPromise)
  const history = use(historyPromise)
  const historyStats = use(historyStatsPromise)
  const dataset = use(datasetPromise)
  const followers = use(followersPromise)
  const locales = use(localesPromise)

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
        notices={notices}
        locale={locale}
        area={area}
        history={history}
        historyStats={historyStats}
        dataset={dataset}
        canonicalUrl={url}
        followers={followers}
        untranslatedLocale={libraryRes?.localeFallback ? locale : null}
        translateLocales={locales}
      />
    </>
  )
}

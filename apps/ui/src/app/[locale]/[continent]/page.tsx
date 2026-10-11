import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import ContinentDetailPage from "@/components/continent/ContinentDetailPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { drivesHere } from "@/lib/drives/drives-here-server"
import { isDevelopment } from "@/lib/general-helpers"
import { placeGapInsights } from "@/lib/place-insights-server"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import {
  buildLibraryItemListSchema,
  buildLocationDescription,
  locationRobots,
  locationTitle,
} from "@/lib/seo/location"
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata"
import {
  fetchAllContinents,
  fetchContinent,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; continent: string }>
}): Promise<Metadata> {
  const { locale, continent: slug } = await params
  const res = await fetchContinent(slug, locale as Locale)
  const data = res?.data
  if (!data) return { title: "Continent not found", robots: { index: false } }

  const name = data.name ?? "Continent"

  return buildMetadata({
    seo: data.seo,
    alternateLocales: [locale],
    title: locationTitle(data.seo, `Libraries in ${name}`),
    description:
      data.summary ??
      buildLocationDescription({
        name,
        libraryCount: data.libraryCount,
        typeCounts: data.libraryTypeCounts,
        childLabel: "country",
      }),
    path: slug,
    locale,
    image: formatStrapiMediaUrl(data.seo?.metaImage?.url),
    robots: res?.localeFallback
      ? "noindex-follow"
      : locationRobots(data.libraryCount),
  })
}

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) {
    return [{ continent: "europe" }]
  }
  const results = await fetchAllContinents(locale as Locale)

  return results.data.map((c) => ({ continent: c.slug }))
}

export default function ContinentPage(props: {
  params: Promise<{ locale: string; continent: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  setRequestLocale(locale)
  const slug = params.continent

  const continentPromise = fetchContinent(slug, locale)
  const drivesPromise = drivesHere("continent", slug, locale)

  const continentRes = use(continentPromise)
  const continentData = continentRes?.data
  if (!continentData) notFound()
  const drives = use(drivesPromise)
  const gapRows = use(
    placeGapInsights(
      "continent",
      slug,
      continentData.libraryTypeCounts ?? [],
      locale
    )
  )

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: "Home", url: absoluteUrl("", locale) },
          { name: continentData.name ?? slug, url: absoluteUrl(slug, locale) },
        ])}
      />
      <JsonLd
        data={buildLibraryItemListSchema({
          name: `Notable libraries in ${continentData.name ?? slug}`,
          path: slug,
          locale,
          libraries: continentData.featuredLibraries,
        })}
      />
      <ContinentDetailPage
        continent={continentData}
        untranslatedLocale={continentRes?.localeFallback ? locale : null}
        locale={locale}
        slug={slug}
        gapRows={gapRows}
        drives={drives}
      />
    </>
  )
}

import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import { placeLabels } from "@/components/location/location-page.helpers"
import { RegionDetailPage } from "@/components/region/RegionDetailPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { drivesHere } from "@/lib/drives/drives-here-server"
import { placeGapCounts } from "@/lib/find-search"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import {
  buildLibraryItemListSchema,
  buildLocationDescription,
  locationRobots,
  locationTitle,
} from "@/lib/seo/location"
import { absoluteUrl, buildMetadata, localizedPath } from "@/lib/seo/metadata"
import { fetchRegion } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
  }>
}): Promise<Metadata> {
  const {
    locale,
    continent: continentSlug,
    country: countrySlug,
    region: slug,
  } = await params
  const data = (await fetchRegion(slug, locale as Locale))?.data
  if (!data) return { title: "Region not found", robots: { index: false } }

  const name = data.name ?? "Region"
  const countryName = data.country?.name
  const parentContinent =
    data.continent?.slug ?? data.country?.continent?.slug ?? continentSlug
  const parentCountry = data.country?.slug ?? countrySlug

  return buildMetadata({
    seo: data.seo,
    alternateLocales: [locale],
    title: locationTitle(
      data.seo,
      countryName
        ? `Libraries in ${name}, ${countryName}`
        : `Libraries in ${name}`
    ),
    description:
      data.summary ??
      buildLocationDescription({
        name: countryName ? `${name}, ${countryName}` : name,
        libraryCount: data.libraryCount,
        typeCounts: data.libraryTypeCounts,
        childLabel: data.areaCount
          ? placeLabels(data.country, data).area.singular
          : null,
      }),
    // Canonicalise to the entity's real parents, not whatever the URL said.
    path: `${parentContinent}/${parentCountry}/${slug}`,
    locale,
    image: formatStrapiMediaUrl(
      data.seo?.metaImage?.url ?? data.heroImage?.url
    ),
    imageAlt: data.heroImage?.alternativeText,
    robots: locationRobots(data.libraryCount),
  })
}

/** Regions are cached on demand, so build cost doesn't grow with global coverage. */
export function generateStaticParams() {
  return []
}

export default function RegionPage(props: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
  }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  setRequestLocale(locale)
  const continentSlug = params.continent
  const countrySlug = params.country
  const slug = params.region

  const regionPromise = fetchRegion(slug, locale)
  const gapCountsPromise = placeGapCounts("region", slug, locale)
  const drivesPromise = drivesHere("region", slug, locale)

  const regionData = use(regionPromise)?.data

  if (!regionData) notFound()
  const realContinent =
    regionData.continent?.slug ??
    regionData.country?.continent?.slug ??
    continentSlug
  const realCountry = regionData.country?.slug ?? countrySlug
  if (continentSlug !== realContinent || countrySlug !== realCountry) {
    permanentRedirect(
      localizedPath(`${realContinent}/${realCountry}/${slug}`, locale)
    )
  }
  const gapCounts = use(gapCountsPromise)
  const drives = use(drivesPromise)
  const parentContinent =
    regionData.continent?.slug ??
    regionData.country?.continent?.slug ??
    continentSlug
  const parentCountry = regionData.country?.slug ?? countrySlug

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: "Home", url: absoluteUrl("", locale) },
          {
            name:
              regionData.continent?.name ??
              regionData.country?.continent?.name ??
              parentContinent,
            url: absoluteUrl(parentContinent, locale),
          },
          {
            name: regionData.country?.name ?? parentCountry,
            url: absoluteUrl(`${parentContinent}/${parentCountry}`, locale),
          },
          {
            name: regionData.name ?? slug,
            url: absoluteUrl(
              `${parentContinent}/${parentCountry}/${slug}`,
              locale
            ),
          },
        ])}
      />
      <JsonLd
        data={buildLibraryItemListSchema({
          name: `Notable libraries in ${regionData.name ?? slug}`,
          path: `${parentContinent}/${parentCountry}/${slug}`,
          locale,
          libraries: regionData.featuredLibraries,
        })}
      />
      <RegionDetailPage
        region={regionData}
        locale={locale}
        slug={slug}
        countrySlug={countrySlug}
        continentSlug={continentSlug}
        gapCounts={gapCounts}
        drives={drives}
      />
    </>
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import { CountryDetailPage } from "@/components/country/CountryDetailPage"
import { placeLabels } from "@/components/location/location-page.helpers"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import {
  buildLibraryItemListSchema,
  buildLocationDescription,
  locationRobots,
  locationTitle,
} from "@/lib/seo/location"
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata"
import {
  fetchAllCountries,
  fetchCountry,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; continent: string; country: string }>
}): Promise<Metadata> {
  const { locale, continent: continentSlug, country: slug } = await params
  const data = (await fetchCountry(slug, locale as Locale))?.data
  if (!data) return { title: "Country not found", robots: { index: false } }

  const name = data.name ?? "Country"

  return buildMetadata({
    title: locationTitle(data.seo, `Libraries in ${name}`),
    description:
      data.seo?.metaDescription ??
      data.summary ??
      buildLocationDescription({
        name,
        libraryCount: data.libraryCount,
        typeCounts: data.libraryTypeCounts,
        childLabel: data.regions?.length
          ? placeLabels(data).region.singular
          : null,
      }),
    // Canonicalise to the entity's real parent, not whatever the URL said.
    path: `${data.continent?.slug ?? continentSlug}/${slug}`,
    locale,
    image: formatStrapiMediaUrl(
      data.seo?.metaImage?.url ?? data.heroImage?.url
    ),
    imageAlt: data.heroImage?.alternativeText,
    robots: locationRobots(data.libraryCount),
  })
}

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) {
    return [{ continent: "europe", country: "england" }]
  }
  // One row per country from /countries/slugs, not the whole library index.
  const results = await fetchAllCountries(locale as Locale)

  return results.data
    .filter((c) => c.slug && c.continent?.slug)
    .map((c) => ({ continent: c.continent!.slug, country: c.slug }))
}

export default function CountryPage(props: {
  params: Promise<{ locale: string; continent: string; country: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const continentSlug = params.continent
  const slug = params.country

  const countryData = use(fetchCountry(slug, locale))?.data

  if (!countryData) notFound()
  const parentSlug = countryData.continent?.slug ?? continentSlug

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: "Home", url: absoluteUrl("", locale) },
          {
            name: countryData.continent?.name ?? parentSlug,
            url: absoluteUrl(parentSlug, locale),
          },
          {
            name: countryData.name ?? slug,
            url: absoluteUrl(`${parentSlug}/${slug}`, locale),
          },
        ])}
      />
      <JsonLd
        data={buildLibraryItemListSchema({
          name: `Notable libraries in ${countryData.name ?? slug}`,
          path: `${parentSlug}/${slug}`,
          locale,
          libraries: countryData.featuredLibraries,
        })}
      />
      <CountryDetailPage
        country={countryData}
        locale={locale}
        slug={slug}
        continentSlug={continentSlug}
      />
    </>
  )
}

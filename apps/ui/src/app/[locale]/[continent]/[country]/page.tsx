import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import { CountryDetailPage } from "@/components/country/CountryDetailPage"
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
  fetchAllLibraries,
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
        childLabel: data.regions?.length ? data.regionTypeLabel : null,
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
  const results = await fetchAllLibraries(locale as Locale)
  const seen = new Set<string>()

  return results.data
    .filter((lib) => lib.continent?.slug && lib.country?.slug)
    .filter((lib) => {
      const key = `${lib.continent!.slug}/${lib.country!.slug}`
      if (seen.has(key)) return false
      seen.add(key)

      return true
    })
    .map((lib) => ({
      continent: lib.continent!.slug,
      country: lib.country!.slug,
    }))
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

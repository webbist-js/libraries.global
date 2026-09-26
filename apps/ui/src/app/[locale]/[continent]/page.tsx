import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import ContinentDetailPage from "@/components/continent/ContinentDetailPage"
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
  const data = (await fetchContinent(slug, locale as Locale))?.data
  if (!data) return { title: "Continent not found", robots: { index: false } }

  const name = data.name ?? "Continent"

  return buildMetadata({
    title: locationTitle(data.seo, `Libraries in ${name}`),
    description:
      data.seo?.metaDescription ??
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
    robots: locationRobots(data.libraryCount),
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
  const slug = params.continent

  const continentData = use(fetchContinent(slug, locale))?.data
  if (!continentData) notFound()

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
        locale={locale}
        slug={slug}
      />
    </>
  )
}

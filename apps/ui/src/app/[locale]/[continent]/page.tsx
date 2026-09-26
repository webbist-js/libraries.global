import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import ContinentDetailPage from "@/components/continent/ContinentDetailPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata"
import {
  fetchAllContinents,
  fetchContinent,
} from "@/lib/strapi-api/content/server"

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
    title: `Libraries in ${name}`,
    description:
      data.summary ??
      `Explore libraries across ${name} — national, public and academic institutions by country, with opening hours and services.`,
    path: slug,
    locale,
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
      <ContinentDetailPage
        continent={continentData}
        locale={locale}
        slug={slug}
      />
    </>
  )
}

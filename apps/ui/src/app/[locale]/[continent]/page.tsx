import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import ContinentDetailPage from "@/components/continent/ContinentDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
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
  if (!data) return { title: "Continent not found" }

  const seo = data.seo as
    | {
        metaTitle?: string | null
        metaDescription?: string | null
        metaImage?: { url?: string | null } | null
      }
    | null
    | undefined

  const title: string = seo?.metaTitle ?? data.name ?? "Continent"
  const description: string =
    seo?.metaDescription ??
    data.summary ??
    `Explore ${data.name ?? "this continent"}'s libraries — discover institutions, opening hours, and services.`
  const ogImageUrl = seo?.metaImage?.url
    ? formatStrapiMediaUrl(seo.metaImage.url)
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

  return (
    <ContinentDetailPage
      continent={continentData ?? null}
      locale={locale}
      slug={slug}
    />
  )
}

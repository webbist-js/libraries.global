import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import GlobalHeader from "@/components/global/GlobalHeader"
import { RegionDetailPage } from "@/components/region/RegionDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
import { fetchAllRegions, fetchRegion } from "@/lib/strapi-api/content/server"

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
  if (!data) return { title: "Region not found" }

  const title = data.name ?? "Region"
  const country = data.country as { name?: string } | null | undefined
  const description =
    data.summary ??
    `Browse libraries in ${data.name ?? "this region"}${country?.name ? `, ${country.name}` : ""} — hours, locations, services, and collections.`

  return {
    title,
    description,
    robots: "index, follow",
    alternates: {
      canonical: `/${continentSlug}/${countrySlug}/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  }
}

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) {
    return [
      { continent: "europe", country: "england", region: "greater-london" },
    ]
  }
  const results = await fetchAllRegions(locale as Locale)

  return results.data
    .filter((r) => r.continent?.slug && r.country?.slug && r.slug)
    .map((r) => ({
      continent: r.continent!.slug,
      country: r.country!.slug,
      region: r.slug,
    }))
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
  const continentSlug = params.continent
  const countrySlug = params.country
  const slug = params.region

  const regionData = use(fetchRegion(slug, locale))?.data

  if (!regionData) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: "var(--t-bg-space)", color: "var(--t-ink-base)" }}
      >
        <GlobalHeader locale={locale} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-(--t-ink-faint)">Region not found.</p>
        </main>
      </div>
    )
  }

  return (
    <RegionDetailPage
      region={regionData}
      locale={locale}
      slug={slug}
      countrySlug={countrySlug}
      continentSlug={continentSlug}
    />
  )
}

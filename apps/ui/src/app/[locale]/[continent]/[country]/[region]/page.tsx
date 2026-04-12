import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import GlobalHeader from "@/components/global/GlobalHeader"
import { RegionDetailPage } from "@/components/region/RegionDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllRegions,
  fetchNavbar,
  fetchRegion,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string }>
}): Promise<Metadata> {
  const { locale, region: slug } = await params
  const data = (await fetchRegion(slug, locale as Locale))?.data
  if (!data) return { title: "Region not found" }

  return {
    title: data.name,
    description: data.summary ?? `Explore libraries across ${data.name}.`,
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
  const navbar = use(fetchNavbar(locale))?.data

  if (!regionData) {
    return (
      <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-white/40">Region not found.</p>
        </main>
      </div>
    )
  }

  return (
    <RegionDetailPage
      region={regionData}
      navbar={navbar}
      locale={locale}
      slug={slug}
      countrySlug={countrySlug}
      continentSlug={continentSlug}
    />
  )
}

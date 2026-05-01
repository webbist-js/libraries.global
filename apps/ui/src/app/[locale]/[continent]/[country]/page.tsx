import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import { CountryDetailPage } from "@/components/country/CountryDetailPage"
import GlobalHeader from "@/components/global/GlobalHeader"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllLibraries,
  fetchCountry,
  fetchNavbar,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; continent: string; country: string }>
}): Promise<Metadata> {
  const { locale, country: slug } = await params
  const data = (await fetchCountry(slug, locale as Locale))?.data
  if (!data) return { title: "Country not found" }

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
  const navbar = use(fetchNavbar(locale))?.data

  if (!countryData) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: "var(--t-bg-space)", color: "var(--t-ink-base)" }}
      >
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-(--t-ink-faint)">Country not found.</p>
        </main>
      </div>
    )
  }

  return (
    <CountryDetailPage
      country={countryData}
      navbar={navbar}
      locale={locale}
      slug={slug}
      continentSlug={continentSlug}
    />
  )
}

import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import { publicNetworkList } from "@/lib/networks/server"
import { buildMetadata } from "@/lib/seo/metadata"
import { fetchCountry } from "@/lib/strapi-api/content/server"

export const dynamic = "force-dynamic"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; continent: string; country: string }>
}) {
  const { locale, continent, country } = await params

  return buildMetadata({
    title: "Library services and networks",
    description: "Explore library services and networks in this country.",
    path: `${continent}/${country}/library-services`,
    locale,
  })
}
export default async function CountryServices({
  params,
  searchParams,
}: {
  readonly params: Promise<{
    locale: string
    continent: string
    country: string
  }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, continent, country } = await params,
    place = await fetchCountry(country, locale as Locale)
  if (!place?.data || place.data.continent?.slug !== continent) notFound()
  const input = await searchParams,
    query = new URLSearchParams(
      Object.entries(input).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : []
      )
    )
  query.set("country", country)
  const data = await publicNetworkList(query)

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <MainContent>
        <PageHero
          title={`Services & networks in ${place.data.name}`}
          plainTitle
          breadcrumb={[
            {
              href: `/${continent}/${country}`,
              label: place.data.name ?? country,
            },
            { label: "Library services" },
          ]}
        />
        <Container className="py-10">
          {data ? (
            <NetworkDirectory
              data={data}
              query={query}
              basePath={`/${continent}/${country}/library-services`}
            />
          ) : (
            <p>The service directory is temporarily unavailable.</p>
          )}
        </Container>
      </MainContent>
    </>
  )
}

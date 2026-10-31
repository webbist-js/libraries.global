import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { PageHero } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import { Container } from "@/components/elementary/Container"
import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import { networkQuery } from "@/lib/networks/query"
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
  const query = networkQuery(await searchParams)
  query.set("country", country)
  const data = await publicNetworkList(query).catch(() => null)
  const identity = (
    <RecordContextIdentity
      title={`Services in ${place.data.name}`}
      parent={{
        href: `/${continent}/${country}`,
        label: place.data.name ?? country,
      }}
    />
  )
  const sections = [
    { href: "#network-overview", label: "Overview" },
    { href: "#network-results", label: "Browse the directory" },
  ]

  return (
    <DashboardPage
      routeKey={`/${continent}/${country}/library-services`}
      title={`Services in ${place.data.name}`}
      className="dashboard-network-page dashboard-network-directory dashboard-information-page"
      navigationHeading={identity}
      mobileNavigationHeading={identity}
      toolbar={
        <RecordToolbar
          items={[
            {
              href: `/${continent}/${country}`,
              label: place.data.name ?? country,
            },
            { label: "Services and networks" },
          ]}
        />
      }
      navigationFooter={
        <DashboardSidebarCta
          title="Connect your libraries"
          body="Represent a library service, university system or consortium and help keep its member records up to date."
          action={{ href: "/staff/networks", label: "Represent a network" }}
          secondary={{ href: "/plans#plan-team", label: "Explore Team plans" }}
        />
      }
      navigation={
        <InformationNavigation
          label="Browse"
          links={[
            ...sections,
            { href: "/library-networks", label: "All services and networks" },
          ]}
        />
      }
    >
      <MainContent>
        <div id="network-overview">
          <PageHero
            variant="card"
            lead="Find the services and organisations that connect libraries in this country. Filter the directory, then explore each network’s member libraries."
            title={`Services & networks in ${place.data.name}`}
            plainTitle
          />
        </div>
        <Container className="py-10">
          <div id="network-results">
            {data ? (
              <NetworkDirectory
                data={data}
                query={query}
                basePath={`/${continent}/${country}/library-services`}
              />
            ) : (
              <p>The service directory is temporarily unavailable.</p>
            )}
          </div>
        </Container>
      </MainContent>
    </DashboardPage>
  )
}

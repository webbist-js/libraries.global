import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import { networkQuery } from "@/lib/networks/query"
import { publicNetworkList } from "@/lib/networks/server"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return buildMetadata({
    title: "Library services and networks",
    description:
      "Explore library services, university systems and consortia, and the libraries they connect.",
    path: "library-networks",
    locale,
  })
}
export default async function NetworksPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = networkQuery(await searchParams)
  const data = await publicNetworkList(query).catch(() => null)
  const identity = (
    <RecordContextIdentity
      title="Services and networks"
      parent={{ href: "/libraries", label: "Find libraries" }}
    />
  )
  const sections = [
    { href: "#network-overview", label: "Overview" },
    { href: "#network-results", label: "Browse the directory" },
  ]

  return (
    <DashboardPage
      className="dashboard-network-page dashboard-network-directory dashboard-information-page"
      routeKey="/library-networks"
      title="Services and networks"
      navigationHeading={identity}
      mobileNavigationHeading={identity}
      toolbar={
        <RecordToolbar
          items={[
            { href: "/libraries", label: "Libraries" },
            { label: "Services and networks" },
          ]}
        />
      }
      navigationFooter={
        <DashboardSidebarCta
          title="Connect your libraries"
          body="Work for a service or university system? Request access to manage its library records together."
          action={{ href: "/staff/networks", label: "Represent a network" }}
          secondary={{ href: "/plans#plan-team", label: "Explore Team plans" }}
        />
      }
      navigation={
        <InformationNavigation label="On this page" links={sections} />
      }
    >
      <div id="network-overview">
        <PageHero
          variant="card"
          title="Library *services & networks*"
          eyebrow="Connected libraries"
          lead="A branch is part of a bigger picture. Explore the public services, university systems and consortia that connect libraries, then find the right branch for your visit."
        />
      </div>
      <Container className="py-8">
        <div id="network-results">
          {data ? (
            <NetworkDirectory data={data} query={query} />
          ) : (
            <p role="status">
              The service directory is temporarily unavailable.
            </p>
          )}
        </div>
      </Container>
    </DashboardPage>
  )
}

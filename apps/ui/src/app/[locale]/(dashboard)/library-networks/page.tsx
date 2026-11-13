import { getTranslations } from "next-intl/server"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import { withMessages } from "@/i18n/scoped-messages"
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
async function NetworksPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tStatic = await getTranslations("staticUi")

  const tExisting = await getTranslations()

  const query = networkQuery(await searchParams)
  const data = await publicNetworkList(query).catch(() => null)
  const identity = (
    <RecordContextIdentity
      title={tStatic("common.servicesNetworks")}
      parent={{ href: "/libraries", label: tExisting("ui.find_libraries") }}
    />
  )
  const sections = [
    { href: "#network-overview", label: tExisting("dashboard.overview") },
    {
      href: "#network-results",
      label: tStatic("networkModeration.browse_the_directory"),
    },
  ]

  return (
    <DashboardPage
      className="dashboard-network-page dashboard-network-directory dashboard-information-page"
      routeKey="/library-networks"
      title={tStatic("common.servicesNetworks")}
      navigationHeading={identity}
      mobileNavigationHeading={identity}
      toolbar={
        <RecordToolbar
          items={[
            { href: "/libraries", label: tExisting("ui.libraries") },
            { label: tStatic("common.servicesNetworks") },
          ]}
        />
      }
      navigationFooter={
        <DashboardSidebarCta
          title={tStatic("common.connectLibraries")}
          body="Work for a service or university system? Request access to manage its library records together."
          action={{
            href: "/staff/networks",
            label: tStatic("networkModeration.represent_a_network"),
          }}
          secondary={{
            href: "/staff/teams",
            label: tStatic("networkModeration.set_up_a_free_team_workspace"),
          }}
        />
      }
      navigation={
        <InformationNavigation
          label={tExisting("ui.on_this_page")}
          links={sections}
        />
      }
    >
      <div id="network-overview">
        <PageHero
          variant="card"
          title={tStatic("networkModeration.library_services_networks")}
          eyebrow="Connected libraries"
          lead={tStatic(
            "networkModeration.a_branch_is_part_of_a_bigger_picture_explore_the_public_services_university_systems_and_consort"
          )}
        />
      </div>
      <Container className="py-8">
        <div id="network-results">
          {data ? (
            <NetworkDirectory data={data} query={query} />
          ) : (
            <p role="status">{tStatic("common.serviceDirectoryUnavailable")}</p>
          )}
        </div>
      </Container>
    </DashboardPage>
  )
}

export default withMessages(
  NetworksPage,
  "[locale]/(dashboard)/library-networks/page"
)

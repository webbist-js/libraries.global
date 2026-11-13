import { NETWORK_KIND_LABELS, networkHref } from "@repo/shared-data"
import { ArrowUpRight, Globe2, Map, ShieldCheck } from "lucide-react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { PageHero } from "@/components/ds"
import { DirectoryPagination } from "@/components/networks/DirectoryPagination"
import { NetworkLibraryList } from "@/components/networks/NetworkLibraryList"
import { NetworkMemberFilters } from "@/components/networks/NetworkMemberFilters"
import { SearchResultsAnalytics } from "@/components/providers/SearchResultsAnalytics"
import { buttonVariants } from "@/components/ui/button"
import { withMessages } from "@/i18n/scoped-messages"
import { CONTACT_EMAIL } from "@/lib/constants"
import { Link } from "@/lib/navigation"
import { networkQuery } from "@/lib/networks/query"
import { publicNetworkDetail } from "@/lib/networks/server"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params,
    data = await publicNetworkDetail(slug)
  if (!data) return {}

  return buildMetadata({
    title: data.network.name,
    description:
      data.network.description || `Explore libraries in ${data.network.name}.`,
    path: `library-networks/${slug}`,
    locale,
  })
}
async function NetworkPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tStatic = await getTranslations("staticUi")

  const tExisting = await getTranslations()

  const { slug } = await params,
    query = networkQuery(await searchParams),
    data = await publicNetworkDetail(slug, query)
  if (!data) notFound()
  const { network, page: currentPage, pageSize } = data
  const total = data.total ?? network.libraryCount
  const sections = [
    {
      href: "#member-libraries",
      label: tStatic("networkModeration.member_libraries"),
    },
    {
      href: "#network-sources",
      label: tStatic("networkModeration.sources_and_responsibility"),
    },
    {
      href: "#network-represent",
      label: tStatic("networkModeration.work_for_this_service"),
    },
  ]
  const claim = `/staff/networks?network=${network.documentId}`

  return (
    <DashboardPage
      routeKey={`/library-networks/${slug}`}
      title={network.name}
      className="dashboard-network-page dashboard-record-page"
      navigationHeading={
        <RecordContextIdentity
          title={network.name}
          eyebrow={NETWORK_KIND_LABELS[network.kind]}
          parent={{
            href: "/library-networks",
            label: tStatic("common.servicesNetworks"),
          }}
        />
      }
      mobileSections={sections}
      toolbar={
        <RecordToolbar
          items={[
            {
              href: "/library-networks",
              label: tStatic("common.servicesNetworks"),
            },
            { label: network.name },
          ]}
        />
      }
      navigationFooter={
        <DashboardSidebarCta
          title={tStatic("networkModeration.work_for_this_network")}
          body="Verify your employment or request responsibility for a reviewed group of libraries."
          action={{
            href: claim,
            label: tStatic("networkModeration.represent_this_network"),
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
      <div
        className="network-detail-content"
        data-analytics-page="network"
        data-analytics-content-id={network.documentId}
        data-analytics-path={networkHref(slug)}
      >
        <PageHero
          variant="card"
          plainTitle
          title={network.name}
          eyebrow={NETWORK_KIND_LABELS[network.kind]}
          lead={
            network.description ||
            `${network.libraryCount.toLocaleString()} published libraries in this sourced network.`
          }
          meta={network.countries.map((c) => c.name).join(" · ")}
        >
          <div className="network-overview-facts">
            <div>
              <strong>{network.libraryCount.toLocaleString()}</strong>
              <span>published member libraries</span>
            </div>
            <div>
              <strong>{NETWORK_KIND_LABELS[network.kind]}</strong>
              <span>
                {tStatic(
                  "networkModeration.membership_is_recorded_from_public_sources"
                )}
              </span>
            </div>
          </div>
          <div className="network-hero-actions">
            <Link
              className={buttonVariants({ variant: "primary", size: "pill" })}
              href={`/map?network=${network.documentId}`}
            >
              <Map size={16} aria-hidden />
              {tStatic("networkModeration.explore_in_atlas")}
            </Link>
            {network.website ? (
              <a
                href={network.website}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "surface", size: "pill" })}
              >
                {tExisting("libraryPage.website")}
                <ArrowUpRight size={16} aria-hidden />
              </a>
            ) : null}
          </div>
        </PageHero>
        <div className="network-detail-sections">
          <section id="member-libraries" className="network-members-section">
            <SearchResultsAnalytics
              source="network_members"
              searchType="libraries"
              searchKey={query.get("q")?.trim() ? `${slug}:${query}` : ""}
              count={total}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="type-h2 m-0">
                {tStatic("networkModeration.libraries_in_this_network")}
              </h2>
              <p role="status" className="m-0 text-sm text-(--t-ink-dim)">
                {total.toLocaleString()} matching of{" "}
                {network.libraryCount.toLocaleString()} members
              </p>
            </div>
            <NetworkMemberFilters
              key={`filters:${query}`}
              data={data}
              query={query}
            />
            <NetworkLibraryList key={`results:${query}`} data={data} />
            <DirectoryPagination
              basePath={networkHref(slug)}
              query={query}
              page={currentPage}
              pageSize={pageSize}
              total={total}
              label={tStatic("networkModeration.member_library_pages")}
            />
          </section>
          <div className="network-support-grid">
            <section id="network-sources" className="network-support-card">
              <span className="network-section-icon">
                <Globe2 size={20} aria-hidden />
              </span>
              <h2 className="type-small-heading m-0">
                {tStatic("networkModeration.sources_and_responsibility")}
              </h2>
              <p>
                {tStatic(
                  "networkModeration.membership_is_checked_against_public_sources_facilities_hours_and_borrowing_rules_can_differ_be"
                )}
              </p>
              <dl className="network-source-details">
                <div>
                  <dt>{tStatic("networkModeration.membership_source")}</dt>
                  <dd>
                    {network.sourceUrl ? (
                      <a
                        className="network-page-link"
                        href={network.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tStatic("networkModeration.view_public_source")}
                        <ArrowUpRight size={14} aria-hidden />
                      </a>
                    ) : (
                      "Not recorded yet"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tStatic("networkModeration.last_checked")}</dt>
                  <dd>
                    {network.lastVerifiedAt
                      ? new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "medium",
                        }).format(new Date(network.lastVerifiedAt))
                      : "Not yet marked as checked"}
                  </dd>
                </div>
              </dl>
              <a
                className="network-page-link"
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Network correction: ${network.name}`)}`}
              >
                {tStatic("networkModeration.suggest_a_correction")}
              </a>
            </section>
            <section id="network-represent" className="network-support-card">
              <span className="network-section-icon">
                <ShieldCheck size={20} aria-hidden />
              </span>
              <h2 className="type-small-heading m-0">
                {tStatic("networkModeration.work_for_this_service")}
              </h2>
              <p>
                {tStatic(
                  "networkModeration.verify_your_affiliation_or_request_management_of_a_reviewed_group_of_libraries_a_team_workspace"
                )}
              </p>
              <nav
                aria-label={tStatic(
                  "networkModeration.service_and_team_access"
                )}
                className="network-service-links"
              >
                <Link href={claim}>
                  {tStatic("networkModeration.affiliation_and_service_access")}
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
                <Link href={`/staff/teams/new?network=${network.documentId}`}>
                  {tStatic("networkModeration.set_up_a_team_workspace")}
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
                <Link
                  href={`/staff/teams/widgets?network=${network.documentId}`}
                >
                  {tStatic("networkModeration.create_an_embeddable_widget")}
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
              </nav>
              <p className="network-responsibility-note">
                {tStatic(
                  "networkModeration.membership_describes_a_sourced_relationship_it_does_not_establish_ownership_or_staff_authority"
                )}
              </p>
            </section>
          </div>
        </div>
      </div>
    </DashboardPage>
  )
}

export default withMessages(
  NetworkPage,
  "[locale]/(dashboard)/library-networks/[slug]/page"
)

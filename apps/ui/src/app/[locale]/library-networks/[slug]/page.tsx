import { NETWORK_KIND_LABELS, networkHref } from "@repo/shared-data"
import { notFound } from "next/navigation"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NetworkLibraryList } from "@/components/networks/NetworkLibraryList"
import { STAFF_LINK, StaffPanel } from "@/components/staff/StaffPanel"
import { CONTACT_EMAIL } from "@/lib/constants"
import { Link } from "@/lib/navigation"
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
export default async function NetworkPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>
  readonly searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params,
    { page } = await searchParams,
    data = await publicNetworkDetail(slug, Math.max(1, Number(page) || 1))
  if (!data) notFound()
  const { network, libraries, page: currentPage, pageSize } = data
  const claim = `/staff/networks?network=${network.documentId}`

  return (
    <>
      <PageHero
        plainTitle
        title={network.name}
        eyebrow={NETWORK_KIND_LABELS[network.kind]}
        breadcrumb={[
          { href: "/library-networks", label: "Services and networks" },
          { label: network.name },
        ]}
        lead={
          network.description ||
          `${network.libraryCount.toLocaleString()} published libraries in this sourced network.`
        }
        meta={network.countries.map((c) => c.name).join(" · ")}
      />
      <Container className="space-y-8 py-10">
        <div className="flex flex-wrap gap-5">
          {network.website ? (
            <a
              href={network.website}
              rel="noopener noreferrer"
              className={STAFF_LINK}
            >
              Official website
            </a>
          ) : null}
          <Link
            className={STAFF_LINK}
            href={`/map?network=${network.documentId}`}
          >
            Explore in the Atlas
          </Link>
          <Link className={STAFF_LINK} href={claim}>
            Work for this service?
          </Link>
        </div>
        <StaffPanel title="Libraries in this network">
          <p>
            Showing {libraries.length} of{" "}
            {network.libraryCount.toLocaleString()} published records. Search
            and map controls apply to this page of results.
          </p>
          <NetworkLibraryList data={data} />
          <nav
            aria-label="Member library pages"
            className="flex justify-between"
          >
            {currentPage > 1 ? (
              <Link href={`${networkHref(slug)}?page=${currentPage - 1}`}>
                Previous libraries
              </Link>
            ) : (
              <span />
            )}
            {currentPage * pageSize < network.libraryCount ? (
              <Link href={`${networkHref(slug)}?page=${currentPage + 1}`}>
                More libraries
              </Link>
            ) : null}
          </nav>
        </StaffPanel>
        <StaffPanel title="Represent this service">
          <p>
            Verify your employment or request management of a reviewed group of
            libraries. Team membership and billing are managed separately.
          </p>
          <div className="flex flex-wrap gap-5">
            <Link className={STAFF_LINK} href={claim}>
              Affiliation and service access
            </Link>
            <Link
              className={STAFF_LINK}
              href={`/staff/teams/new?network=${network.documentId}`}
            >
              Set up a Team
            </Link>
            <Link
              className={STAFF_LINK}
              href={`/staff/teams/widgets?network=${network.documentId}`}
            >
              Create an embeddable widget
            </Link>
          </div>
        </StaffPanel>
        <aside className="text-base leading-relaxed text-(--t-ink-dim)">
          <p>
            Membership describes a sourced relationship. Consortium membership
            does not establish ownership or staff authority.
          </p>
          {network.sourceUrl ? (
            <p>
              <a href={network.sourceUrl} rel="noopener noreferrer">
                Membership source
              </a>
              {network.lastVerifiedAt
                ? ` · Checked ${network.lastVerifiedAt.slice(0, 10)}`
                : ""}
            </p>
          ) : null}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Network correction: ${network.name}`)}`}
          >
            Suggest a network correction
          </a>
        </aside>
      </Container>
    </>
  )
}

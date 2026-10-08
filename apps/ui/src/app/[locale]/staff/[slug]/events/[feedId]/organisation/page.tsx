import { notFound } from "next/navigation"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { OrganisationPicker } from "@/components/event-feeds/OrganisationPicker"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"

export const metadata = privateMetadata("Choose an organisation")

/** Eventbrite OAuth found several organisations: pick the library's. */
export default async function EventbriteOrganisationPage({
  params,
}: {
  params: Promise<{ slug: string; feedId: string }>
}) {
  const { slug, feedId } = await params
  if (!isDocumentIdParam(feedId)) notFound()
  const { user, documentId, overview } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const result = await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
    user
  )
  const entry = result.body?.data?.libraries?.find(
    (l) => l.library.documentId === documentId
  )
  const feed = entry?.feeds.find(
    (f) => f.documentId === feedId && f.status === "draft"
  )
  const orgs = (feed?.hints as Record<string, unknown> | undefined)
    ?.organizations
  if (!Array.isArray(orgs) || orgs.length === 0) notFound()

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <h2
        className="m-0 mb-2"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(26px,3vw,32px)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        Choose an Eventbrite organisation
      </h2>
      <p className="m-0 mb-6 text-[15px]" style={{ color: T.ink.dim }}>
        Your Eventbrite account has more than one organisation. Choose the one
        whose events this library should show.
      </p>
      <OrganisationPicker
        documentId={feedId}
        libraryDocumentId={documentId}
        librarySlug={overview.library.slug}
        organizations={orgs as { id: string; name: string }[]}
      />
    </div>
  )
}

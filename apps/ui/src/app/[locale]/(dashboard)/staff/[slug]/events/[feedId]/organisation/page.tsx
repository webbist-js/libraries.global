import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { OrganisationPicker } from "@/components/event-feeds/OrganisationPicker"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { withMessages } from "@/i18n/scoped-messages"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"

export const metadata = privateMetadata("Choose an organisation")

/** Eventbrite OAuth found several organisations: pick the library's. */
async function EventbriteOrganisationPage({
  params,
}: {
  params: Promise<{ slug: string; feedId: string }>
}) {
  const tStatic = await getTranslations("staticUi")

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
        className="type-h2 m-0 mb-2"
        style={{
          color: T.ink.base,
        }}
      >
        {tStatic("staffRoute.choose_an_eventbrite_organisation")}
      </h2>
      <p className="m-0 mb-6 text-base" style={{ color: T.ink.dim }}>
        {tStatic(
          "staffRoute.your_eventbrite_account_has_more_than_one_organisation_choose_the_one_whose_events_this_library_shou"
        )}
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

export default withMessages(
  EventbriteOrganisationPage,
  "[locale]/(dashboard)/staff/[slug]/events/[feedId]/organisation/page"
)

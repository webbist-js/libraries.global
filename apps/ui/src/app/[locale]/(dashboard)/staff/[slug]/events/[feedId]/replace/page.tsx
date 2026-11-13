import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { ReplaceFeedForm } from "@/components/event-feeds/ReplaceFeedForm"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { StaffBackLink } from "@/components/staff/StaffBackLink"
import { withMessages } from "@/i18n/scoped-messages"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { staffLibraryHref } from "@/lib/staff/paths"
import { loadStaffPage } from "@/lib/staff/server"

export const metadata = privateMetadata("Replace feed details")

/** Replace an active or paused feed's details; the feed must be this library's. */
async function ReplaceEventFeedPage({
  params,
}: {
  params: Promise<{ slug: string; feedId: string }>
}) {
  const tStatic = await getTranslations("staticUi")

  const tUi = await getTranslations("ui")

  const { slug, feedId } = await params
  if (!isDocumentIdParam(feedId)) notFound()
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const result = await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
    user
  )
  const entry = result.body?.data?.libraries?.find(
    (l) => l.library.documentId === documentId
  )
  const feed = entry?.feeds.find((f) => f.documentId === feedId)
  if (
    !feed ||
    feed.managedBy === "admin_group" ||
    (feed.status !== "active" && feed.status !== "paused")
  )
    notFound()

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <StaffBackLink
        href={staffLibraryHref(overview.library.slug, "/events")}
        label={tUi("event_feeds")}
      />
      <h2
        className="type-h2 m-0 mb-6"
        style={{
          color: T.ink.base,
        }}
      >
        {tStatic("staffRoute.replace_this_feed_s_details")}
      </h2>
      <ReplaceFeedForm
        feed={feed}
        libraryName={overview.library.name}
        libraryDocumentId={documentId}
        librarySlug={overview.library.slug}
      />
    </div>
  )
}

export default withMessages(
  ReplaceEventFeedPage,
  "[locale]/(dashboard)/staff/[slug]/events/[feedId]/replace/page"
)

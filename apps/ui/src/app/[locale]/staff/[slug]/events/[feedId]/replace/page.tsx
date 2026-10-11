import { notFound } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { ReplaceFeedForm } from "@/components/event-feeds/ReplaceFeedForm"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { StaffBackLink } from "@/components/staff/StaffBackLink"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { staffLibraryHref } from "@/lib/staff/paths"
import { loadStaffPage } from "@/lib/staff/server"

export const metadata = privateMetadata("Replace feed details")

/** Replace an active or paused feed's details; the feed must be this library's. */
export default async function ReplaceEventFeedPage({
  params,
}: {
  params: Promise<{ slug: string; feedId: string }>
}) {
  const tUi = await getUiTranslations("ui")

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
        className="m-0 mb-6"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(26px,3vw,32px)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        Replace this feed’s details
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

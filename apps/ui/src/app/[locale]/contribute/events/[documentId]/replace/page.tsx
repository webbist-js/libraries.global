import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { ReplaceFeedForm } from "@/components/event-feeds/ReplaceFeedForm"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Replace feed details")

export default async function ReplaceEventFeedPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  if (!isDocumentIdParam(documentId)) notFound()

  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=/contribute/events/${documentId}/replace`
    )
  const caps = (session.user as { capabilities?: string[] }).capabilities ?? []
  if (!caps.includes("events.feed")) notFound()

  const result = await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
    session.user
  )
  const libraries = result.body?.data?.libraries ?? []
  let libraryName: string | null = null
  const feed = libraries
    .flatMap((l) => l.feeds.map((f) => ({ feed: f, name: l.library.name })))
    .find((entry) => entry.feed.documentId === documentId)
  if (feed) libraryName = feed.name

  if (
    !feed ||
    feed.feed.managedBy === "admin_group" ||
    (feed.feed.status !== "active" && feed.feed.status !== "paused")
  )
    notFound()

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Replace feed details"
        title="Replace this feed's *details.*"
        back
      />
      <div className="mx-auto w-full max-w-[820px] px-4 pt-10 pb-20 sm:px-8">
        <ReplaceFeedForm feed={feed.feed} libraryName={libraryName ?? ""} />
      </div>
    </div>
  )
}

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { ConnectFeedForm } from "@/components/event-feeds/ConnectFeedForm"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import {
  fetchEventFeedProviders,
  fetchEventFeeds,
} from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"
import { ClaimFirst } from "../_components/ClaimFirst"

export const metadata = privateMetadata("Connect a feed")

export default async function ConnectEventFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string }>
}) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/contribute/events/connect")
  const caps = (session.user as { capabilities?: string[] }).capabilities ?? []
  const { library } = await searchParams

  let libraries: { documentId: string; name: string }[] = []
  let oauth = { eventbrite: false }
  if (caps.includes("events.feed")) {
    const [feeds, providers] = await Promise.all([
      fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(session.user),
      fetchEventFeedProviders(session.user),
    ])
    libraries = (feeds.body?.data?.libraries ?? []).map((l) => ({
      documentId: l.library.documentId,
      name: l.library.name,
    }))
    oauth = providers.body?.data?.oauth ?? { eventbrite: false }
  }

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        section="Connect a feed"
        title="Connect an *event feed.*"
        back
      />
      <div className="mx-auto w-full max-w-[820px] px-4 pt-10 pb-20 sm:px-8">
        {caps.includes("events.feed") && libraries.length > 0 ? (
          <ConnectFeedForm
            libraries={libraries}
            initialLibrary={library}
            oauth={oauth}
          />
        ) : (
          <ClaimFirst />
        )}
      </div>
    </div>
  )
}

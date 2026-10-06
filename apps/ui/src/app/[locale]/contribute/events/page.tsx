import {
  FEED_TEST_CODES,
  FEED_TEST_COPY,
  type FeedTestCode,
} from "@repo/shared-data"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { Notice, type NoticeTone } from "@/components/ds"
import { LibraryFeedsSection } from "@/components/event-feeds/LibraryFeedsSection"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { ClaimFirst } from "./_components/ClaimFirst"
import { FeedsAside } from "./_components/FeedsAside"

export const metadata = privateMetadata("Event feeds")

const OAUTH_NOTICE: Record<
  string,
  { tone: NoticeTone; icon: string; title: string; message: string }
> = {
  sent: {
    tone: "ok",
    icon: "mdi:check-circle-outline",
    title: "Sent for review",
    message: "Your Eventbrite feed was sent for review.",
  },
  failed: {
    tone: "warn",
    icon: "mdi:alert-circle-outline",
    title: "Sign-in didn't finish",
    message: "Eventbrite sign-in didn't finish. Try again.",
  },
  refused: {
    tone: "warn",
    icon: "mdi:alert-circle-outline",
    title: "Couldn't send for review",
    message:
      "Eventbrite connected, but we couldn't send it for review. Try again from the dashboard.",
  },
}

const isFeedTestCode = (v: unknown): v is FeedTestCode =>
  typeof v === "string" && (FEED_TEST_CODES as readonly string[]).includes(v)

export default async function ContributeEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string; oauth?: string; result?: string }>
}) {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/events")
  const caps = (session.user as { capabilities?: string[] }).capabilities ?? []
  const { library: highlight, oauth, result: testResult } = await searchParams
  const oauthNotice =
    oauth === "test_failed"
      ? {
          tone: "warn" as const,
          icon: "mdi:alert-circle-outline",
          title: "Connection test failed",
          message: isFeedTestCode(testResult)
            ? FEED_TEST_COPY[testResult]
            : FEED_TEST_COPY.auth_failed,
        }
      : oauth
        ? OAUTH_NOTICE[oauth]
        : undefined
  const result = caps.includes("events.feed")
    ? await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
        session.user
      )
    : null
  const libraries = result?.body?.data?.libraries ?? []

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Event feeds"
        title="Your library's *event feeds.*"
        lead="Connect the platform your library publishes events on. Every new connection is reviewed before we sync it."
      />
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-10 pb-20 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="flex max-w-[820px] min-w-0 flex-col gap-6">
            {oauthNotice && (
              <Notice
                icon={oauthNotice.icon}
                tone={oauthNotice.tone}
                title={oauthNotice.title}
              >
                <p className="m-0">{oauthNotice.message}</p>
              </Notice>
            )}
            {!caps.includes("events.feed") ? (
              <ClaimFirst />
            ) : result && result.status !== 200 ? (
              <p role="alert" style={{ color: T.accent.danger }}>
                We couldn&apos;t load your feeds. Try again in a minute.
              </p>
            ) : (
              libraries.map((l) => (
                <LibraryFeedsSection
                  key={l.library.documentId}
                  entry={l}
                  highlight={highlight === l.library.documentId}
                />
              ))
            )}
          </div>
          <FeedsAside />
        </div>
      </div>
    </div>
  )
}

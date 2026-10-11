import {
  FEED_TEST_CODES,
  FEED_TEST_COPY,
  type FeedTestCode,
} from "@repo/shared-data"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/staff/_lib/staff-pathname"
import { Notice, type NoticeTone } from "@/components/ds"
import { LibraryFeedsSection } from "@/components/event-feeds/LibraryFeedsSection"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"

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
      "Eventbrite connected, but we couldn't send it for review. Try again from this page.",
  },
}

const isFeedTestCode = (v: unknown): v is FeedTestCode =>
  typeof v === "string" && (FEED_TEST_CODES as readonly string[]).includes(v)

/** This library's event feeds: the dashboard, in the staff shell. */
export default async function StaffEventFeedsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ oauth?: string; result?: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ slug }, { oauth, result: testResult }] = await Promise.all([
    params,
    searchParams,
  ])
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
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
  const result = await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
    user
  )
  const entry: LibraryFeeds = result.body?.data?.libraries?.find(
    (l) => l.library.documentId === documentId
  ) ?? {
    library: {
      documentId,
      name: overview.library.name,
      slug: overview.library.slug,
    },
    feeds: [],
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
      <div className="flex min-w-0 flex-col gap-6">
        {oauthNotice ? (
          <Notice
            icon={oauthNotice.icon}
            tone={oauthNotice.tone}
            title={oauthNotice.title}
          >
            <p className="m-0">{oauthNotice.message}</p>
          </Notice>
        ) : null}
        {result.status !== 200 ? (
          <p role="alert" className="m-0" style={{ color: T.accent.danger }}>
            We couldn&apos;t load your feeds. Try again in a minute.
          </p>
        ) : (
          <LibraryFeedsSection
            entry={entry}
            heading={tUi("connected_feeds")}
            intro="Connect the platform your library publishes events on. Every new connection is reviewed before we sync it."
          />
        )}
      </div>
      <FeedsAside />
    </div>
  )
}

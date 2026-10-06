import { FEED_TEST_CODES, type FeedTestCode } from "@repo/shared-data"

import type { FeedView } from "./types"

/** Narrows an error's `result` string to a known test code, if it is one. */
export function isFeedTestCode(v: unknown): v is FeedTestCode {
  return (
    typeof v === "string" && (FEED_TEST_CODES as readonly string[]).includes(v)
  )
}

export function feedStatusOf(feed: FeedView) {
  // A draft feed is mid-OAuth (waiting on the organisation choice), not yet
  // sent for review, so it never carries a review: distinct copy from the
  // pending states below, which are.
  if (feed.status === "draft")
    return {
      key: "draft",
      label: "Finishing setup",
      icon: "mdi:progress-clock",
      tone: "info",
    } as const
  if (feed.status === "pending") {
    return feed.review?.status === "needs_info"
      ? ({
          key: "needs_changes",
          label: "Needs changes",
          icon: "mdi:message-alert-outline",
          tone: "warn",
        } as const)
      : ({
          key: "waiting",
          label: "Waiting for review",
          icon: "mdi:clock-outline",
          tone: "info",
        } as const)
  }
  if (feed.status === "paused")
    return feed.pausedReason === "sync_failures"
      ? ({
          key: "stopped",
          label: "Stopped working",
          icon: "mdi:alert-circle-outline",
          tone: "warn",
        } as const)
      : ({
          key: "paused",
          label: "Paused",
          icon: "mdi:pause-circle-outline",
          tone: "info",
        } as const)

  return {
    key: "active",
    label: "Active",
    icon: "mdi:check-circle-outline",
    tone: "ok",
  } as const
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
function ago(iso: string, now: Date): string {
  const mins = Math.round((Date.parse(iso) - now.getTime()) / 60_000)
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute")
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour")

  return rtf.format(Math.round(hours / 24), "day")
}

export function syncLine(feed: FeedView, now = new Date()): string {
  const when = feed.lastSyncAt
    ? `Last synced ${ago(feed.lastSyncAt, now)}`
    : "Not synced yet"
  const n = feed.upcomingEvents

  return `${when} · ${n} upcoming event${n === 1 ? "" : "s"}`
}

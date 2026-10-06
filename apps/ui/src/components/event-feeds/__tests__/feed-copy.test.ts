import { describe, expect, it } from "vitest"

import { feedStatusOf, syncLine } from "../feed-copy"

const base: any = {
  status: "active",
  pausedReason: null,
  review: null,
  lastSyncAt: null,
  upcomingEvents: 0,
  lastErrorCode: null,
}

describe("feedStatusOf", () => {
  it.each([
    [{ ...base }, "active", "Active"],
    [
      { ...base, status: "paused", pausedReason: "library" },
      "paused",
      "Paused",
    ],
    [
      { ...base, status: "paused", pausedReason: "sync_failures" },
      "stopped",
      "Stopped working",
    ],
    [{ ...base, status: "draft" }, "draft", "Finishing setup"],
    [
      {
        ...base,
        status: "pending",
        review: { status: "pending", kind: "connect" },
      },
      "waiting",
      "Waiting for review",
    ],
    [
      {
        ...base,
        status: "pending",
        review: { status: "needs_info", kind: "connect" },
      },
      "needs_changes",
      "Needs changes",
    ],
  ])("%o", (feed, key, label) => {
    expect(feedStatusOf(feed)).toMatchObject({ key, label })
  })
})

describe("syncLine", () => {
  it("says when it last synced and what's coming", () => {
    const now = new Date("2026-10-06T12:00:00Z")
    expect(
      syncLine(
        { ...base, lastSyncAt: "2026-10-06T09:00:00Z", upcomingEvents: 12 },
        now
      )
    ).toBe("Last synced 3 hours ago · 12 upcoming events")
    expect(syncLine({ ...base, upcomingEvents: 1 }, now)).toBe(
      "Not synced yet · 1 upcoming event"
    )
  })
})

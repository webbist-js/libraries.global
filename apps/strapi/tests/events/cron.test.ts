import { describe, expect, it, vi } from "vitest"

import {
  handleAutoPaused,
  purgeOAuthDrafts,
} from "../../src/plugins/events/server/cron"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"

describe("events cron", () => {
  it("handles each auto-paused feed once: flag, audit, email", async () => {
    const { strapi, store } = makeFakeStrapi({
      [CRED]: [
        {
          documentId: "c1",
          provider: "ical",
          status: "paused",
          pausedReason: "sync_failures",
          autoPauseNotifiedAt: null,
          lastErrorCode: "auth_failed",
          libraries: [{ documentId: "L1", name: "Central" }],
        },
        {
          documentId: "c2",
          provider: "ical",
          status: "paused",
          pausedReason: "library",
          autoPauseNotifiedAt: null,
          libraries: [],
        },
      ],
      "plugin::events.credential-event": [],
      "api::library.library": [{ documentId: "L1", hasActiveFeed: true }],
    })
    const syncLibraryFeedFlags = vi.fn()
    strapi.plugin = vi.fn(() => ({ service: () => ({ syncLibraryFeedFlags }) }))
    const notify = vi.fn()
    expect(await handleAutoPaused(strapi, { notify })).toEqual({ handled: 1 })
    expect(store[CRED]![0]!.autoPauseNotifiedAt).toBeTruthy()
    expect(syncLibraryFeedFlags).toHaveBeenCalledWith(["L1"])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store["plugin::events.credential-event"]![0]).toMatchObject({
      action: "auto_paused",
      actor: "system",
      resultCode: "auth_failed",
    })
    expect(await handleAutoPaused(strapi, { notify })).toEqual({ handled: 0 })
  })

  it("purges OAuth drafts older than an hour", async () => {
    const now = new Date("2026-10-06T12:00:00Z")
    const { strapi, store } = makeFakeStrapi({
      [CRED]: [
        {
          documentId: "old",
          status: "draft",
          createdAt: "2026-10-06T10:00:00Z",
        },
        {
          documentId: "new",
          status: "draft",
          createdAt: "2026-10-06T11:30:00Z",
        },
        {
          documentId: "act",
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    })
    expect(await purgeOAuthDrafts(strapi, now)).toEqual({ deleted: 1 })
    expect(store[CRED]!.map((c) => c.documentId)).toEqual(["new", "act"])
  })
})

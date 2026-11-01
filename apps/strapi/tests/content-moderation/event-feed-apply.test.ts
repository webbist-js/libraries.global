import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setNotificationScheduler } from "../../src/plugins/content-moderation/server/services/notifications"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import {
  adminReviewer,
  systemReviewer,
} from "../../src/plugins/content-moderation/server/utils/reviewer"
import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import feedsFactory from "../../src/plugins/events/server/services/feeds"
import {
  openValues,
  sealValues,
} from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const CRED = "plugin::events.event-credential"
const L1 = "lib00000000000000000001"
const CID = "cred00000000000000000001"
const REVIEWER = adminReviewer({ id: 1, email: "m@example.org" })

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "d".repeat(64)
})

function setup(
  kind: "connect" | "replace",
  opts: { claims?: string[]; bound?: boolean } = {}
) {
  const sub: any = {
    documentId: "sub00000000000000000001",
    submissionType: "event_feed",
    status: "pending",
    submittedByUserId: "ba-owner",
    targetEntityType: "library",
    targetDocumentId: L1,
    fields: {
      kind,
      credentialDocumentId: CID,
      provider: "ical",
      hints: {},
      test: { result: "ok" },
    },
  }
  sub.payloadHash = payloadHash(sub)
  const cred: any = {
    documentId: CID,
    id: 5,
    provider: "ical",
    scope: "library",
    status: kind === "connect" ? "pending" : "active",
    libraries: [{ documentId: L1 }],
    credentialsEncrypted: sealValues(
      { feedUrl: "https://a.example/old.ics" },
      CID,
      "current"
    ),
    hints: { feedUrl: "https://a.example/…" },
    pendingSubmissionDocumentId:
      opts.bound === false ? "other" : sub.documentId,
    ...(kind === "replace"
      ? {
          pendingCredentialsEncrypted: sealValues(
            { feedUrl: "https://a.example/new.ics" },
            CID,
            "pending"
          ),
          pendingHints: { feedUrl: "https://a.example/…" },
          pendingTestResult: "ok",
          consecutiveFailures: 3,
        }
      : {}),
  }
  const fake = makeFakeStrapi({
    [SUB]: [sub],
    [CRED]: [cred],
    "plugin::events.credential-event": [],
    "plugin::events.sync-command": [],
    "plugin::content-moderation.review-event": [],
    "api::library.library": [{ documentId: L1, hasActiveFeed: false }],
  })
  const { strapi } = fake
  const credentials = credentialsFactory({ strapi })
  const claims = new Set(opts.claims ?? [L1])
  const policy = {
    loadCapabilities: vi.fn(async () => ({
      caps: { claimedLibraryIds: claims, set: new Set(["events.feed"]) },
    })),
  }
  const award = vi.fn().mockResolvedValue({ awarded: true })
  const feeds = feedsFactory({ strapi })
  strapi.plugin = vi.fn((name: string) => ({
    service: (s: string) =>
      name === "rewards"
        ? { award }
        : name === "events"
          ? s === "feeds"
            ? feeds
            : credentials
          : s === "submission-policy"
            ? policy
            : undefined,
  }))

  // The seed is deep-cloned into the store (`makeFakeStrapi`), so the local
  // `cred`/`sub` objects above are not the ones `feeds.ts` reads and writes
  // through `strapi.documents()`. Return the live store rows instead, so
  // assertions on `cred` see the service's own mutations — the same
  // convention `tests/events/feeds.test.ts` uses (`row = store[CRED]![0]!`).
  return {
    ...fake,
    award,
    service: createService({ strapi }),
    cred: fake.store[CRED]![0]!,
    sub: fake.store[SUB]![0]!,
  }
}

describe("event_feed decisions", () => {
  it.each(["connect", "replace"] as const)(
    "rewards an accepted %s once at approval time",
    async (kind) => {
      const { service, award, sub } = setup(kind)
      const before = Date.now()
      await service.updateStatus(sub.documentId, "approved", REVIEWER)
      expect(award).toHaveBeenCalledWith(
        "ba-owner",
        "event_feed_accepted",
        5,
        { submissionId: sub.documentId, credentialDocumentId: CID },
        `${sub.documentId}:event_feed_accepted`,
        expect.any(Date)
      )
      expect(award.mock.calls[0][5].getTime()).toBeGreaterThanOrEqual(before)
      await service.updateStatus(sub.documentId, "approved", REVIEWER)
      expect(award).toHaveBeenCalledTimes(1)
    }
  )

  it("rolls back acceptance when its reward fails, allowing a retry", async () => {
    const { service, award, store, sub } = setup("connect")
    award.mockRejectedValueOnce(new Error("reward unavailable"))
    expect(
      await service.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toEqual({ error: "apply_failed" })
    expect(store[SUB]![0].status).toBe("pending")
    expect(store[CRED]![0].status).toBe("pending")
    expect(
      await service.updateStatus(sub.documentId, "approved", REVIEWER)
    ).toHaveProperty("data")
    expect(award).toHaveBeenCalledTimes(2)
  })

  it.each(["rejected", "needs_info"] as const)(
    "does not reward %s feeds",
    async (status) => {
      const { service, award, sub } = setup("connect")
      await service.updateStatus(
        sub.documentId,
        status,
        REVIEWER,
        "Please check"
      )
      expect(award).not.toHaveBeenCalled()
    }
  )

  it("approving a connection activates the credential and records the result", async () => {
    const { service, cred, store } = setup("connect")
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r.data).toBeDefined()
    expect(cred).toMatchObject({
      status: "active",
      submissionDocumentId: "sub00000000000000000001",
      pendingSubmissionDocumentId: null,
    })
    expect(store[SUB]![0]!.resultDocumentId).toBe(CID)
    expect(
      store["plugin::events.sync-command"]!.at(-1)!.credentialDocumentId
    ).toBe(CID)
    expect(store["plugin::events.credential-event"]!.at(-1)!.action).toBe(
      "approved"
    )
  })

  it("approving a replacement swaps the value into the current slot", async () => {
    const { service, cred } = setup("replace")
    await service.updateStatus("sub00000000000000000001", "approved", REVIEWER)
    expect(openValues(cred.credentialsEncrypted, CID, "current")).toEqual({
      feedUrl: "https://a.example/new.ics",
    })
    expect(cred.pendingCredentialsEncrypted).toBeNull()
    expect(cred.consecutiveFailures).toBe(0)
    expect(cred.lastTestResult).toBe("ok")
  })

  it("refuses approval when the submitter lost their claim, and stays pending", async () => {
    const { service, store } = setup("connect", { claims: [] })
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "claim_lost" })
    expect(store[SUB]![0]!.status).toBe("pending")
  })

  it("refuses approval when the credential isn't bound to this submission", async () => {
    const { service } = setup("connect", { bound: false })
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "feed_mismatch" })
  })

  it("rejecting a connection deletes the credential", async () => {
    const { service, store } = setup("connect")
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Wrong calendar"
    )
    expect(store[CRED]).toHaveLength(0)
  })

  it("rejecting a replacement clears the pending slot and keeps the feed", async () => {
    const { service, cred } = setup("replace")
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Not your account"
    )
    expect(cred.status).toBe("active")
    expect(cred.pendingCredentialsEncrypted).toBeNull()
  })

  it("needs_info changes nothing on the credential", async () => {
    const { service, cred } = setup("connect")
    const before = { ...cred }
    await service.updateStatus(
      "sub00000000000000000001",
      "needs_info",
      REVIEWER,
      "Which branch?"
    )
    expect(cred).toEqual(before)
  })

  // Finding 3: the credential audit log's `actor` used to record the
  // submitter (`ba:<submittedByUserId>`) on every decision, even one an
  // admin or Moderator made. It must record who decided it.
  it("records the reviewer, not the submitter, as the approval's actor", async () => {
    const { service, store } = setup("connect")
    await service.updateStatus("sub00000000000000000001", "approved", REVIEWER)
    const event = store["plugin::events.credential-event"]!.at(-1)!
    expect(event.action).toBe("approved")
    expect(event.actor).toBe(REVIEWER.id)
    expect(event.actor).not.toBe("ba:ba-owner")
  })

  it("records the reviewer as the rejection's actor, with the library tagged", async () => {
    const { service, store } = setup("connect")
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Wrong calendar"
    )
    const event = store["plugin::events.credential-event"]!.at(-1)!
    expect(event.action).toBe("rejected")
    expect(event.actor).toBe(REVIEWER.id)
    expect(event.libraryDocumentIds).toEqual([L1])
  })

  // Finding 12: a connect approval must still find the credential pending
  // review — not already active, still a draft, or anything else — even
  // though its `pendingSubmissionDocumentId` still happens to match.
  it("refuses a connect approval when the credential isn't pending any more", async () => {
    const { service, cred, store } = setup("connect")
    cred.status = "active"
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "feed_mismatch" })
    expect(store[SUB]![0]!.status).toBe("pending")
  })

  // Finding 1: Strapi loads each plugin from its own built `dist/`, so the
  // events plugin's `ApplyRefusedError` is a different *class* than
  // content-moderation's own import of the same source file — `instanceof`
  // across that boundary never matches. `isApplyRefusedError` (shape-based)
  // must recognise a refusal thrown by such a "foreign" class all the same.
  it("recognises a refusal thrown by a different ApplyRefusedError class as apply_refused (cross-bundle identity)", async () => {
    const { service, store, strapi } = setup("connect")

    class ForeignApplyRefusedError extends Error {
      readonly reason = "claim_lost"
      readonly uid = CRED
      readonly documentId = CID
      constructor() {
        super(`apply refused (claim_lost): ${CRED} ${CID}`)
        this.name = "ApplyRefusedError"
      }
    }

    const realFeeds = strapi.plugin("events").service("feeds")
    ;(strapi.plugin as any).mockImplementation((name: string) => ({
      service: (s: string) =>
        name === "rewards"
          ? { award }
          : name === "events"
            ? s === "feeds"
              ? {
                  ...realFeeds,
                  approveSubmission: async () => {
                    throw new ForeignApplyRefusedError()
                  },
                }
              : realFeeds
            : s === "submission-policy"
              ? {
                  loadCapabilities: async () => ({
                    caps: {
                      claimedLibraryIds: new Set([L1]),
                      set: new Set(["events.feed"]),
                    },
                  }),
                }
              : undefined,
    }))
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "claim_lost" })
    expect(store[SUB]![0]!.status).toBe("pending")
    expect(store[SUB]![0]!.reviewNote).toMatch(/no longer holds a claim/)
  })
})

describe("decision emails (Finding 11)", () => {
  afterEach(() => setNotificationScheduler())

  // `withdrawPending`/`disconnect` reject a Submission through
  // `systemReviewer()` — the library acting on its own feed, not a
  // moderator's decision. It must never queue the "your submission was
  // rejected" email a real review would.
  it("never schedules a decided email for a system reviewer's decision", async () => {
    const { service } = setup("connect")
    const tasks: (() => Promise<void>)[] = []
    setNotificationScheduler((task) => {
      tasks.push(task)
    })
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      systemReviewer(),
      "Withdrawn by the library"
    )
    expect(tasks).toHaveLength(0)
  })

  it("still schedules a decided email for a human reviewer's decision", async () => {
    const { service } = setup("connect")
    const tasks: (() => Promise<void>)[] = []
    setNotificationScheduler((task) => {
      tasks.push(task)
    })
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Wrong calendar"
    )
    expect(tasks).toHaveLength(1)
  })
})

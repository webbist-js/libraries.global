import { beforeEach, describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
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
  const feeds = feedsFactory({ strapi })
  strapi.plugin = vi.fn((name: string) => ({
    service: (s: string) =>
      name === "events"
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
    service: createService({ strapi }),
    cred: fake.store[CRED]![0]!,
    sub: fake.store[SUB]![0]!,
  }
}

describe("event_feed decisions", () => {
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
})

import { MAX_OPEN_FEED_SUBMISSIONS } from "@repo/shared-data"
import { beforeEach, describe, expect, it, vi } from "vitest"

import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import feedsFactory from "../../src/plugins/events/server/services/feeds"
import { openValues } from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const EVENTS = "plugin::events.credential-event"
const SUB = "plugin::content-moderation.submission"
const LIB = "api::library.library"
const L1 = "lib00000000000000000001"
const L2 = "lib00000000000000000002"
const USER = { id: "ba-owner", email: "o@lib.example", name: "Owner" }

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "c".repeat(64)
})

/**
 * `opts` is returned from `setup()` and read live by the fake `testFeed` on
 * every call, so a test can mutate `opts.test` or `opts.onTest` *between*
 * calls (e.g. after an initial `connect()` has already run) to change only
 * the next provider test's behaviour — including mutating the store from
 * inside `onTest`, to simulate a concurrent write landing while the
 * (~15 s in real life) provider test is in flight.
 */
type SetupOpts = {
  claims?: string[]
  test?: string
  policy?: any
  onTest?: () => void
}

function setup(opts: SetupOpts = {}) {
  const fake = makeFakeStrapi({
    [LIB]: [
      {
        documentId: L1,
        name: "Central Library",
        slug: "central",
        hasActiveFeed: false,
      },
      {
        documentId: L2,
        name: "Other Library",
        slug: "other",
        hasActiveFeed: false,
      },
    ],
    [CRED]: [],
    [EVENTS]: [],
    [SUB]: [],
    "plugin::events.sync-command": [],
    "plugin::events.event": [],
  })
  const { strapi } = fake
  const testFeed = vi.fn(async () => {
    opts.onTest?.()

    return { result: (opts.test ?? "ok") as any }
  })
  const credentials = credentialsFactory({ strapi, testFeed })
  const claims = new Set(opts.claims ?? [L1])
  const policy = {
    loadCapabilities: vi.fn(async () => ({
      caps: {
        claimedLibraryIds: claims,
        set: new Set(claims.size ? ["events.feed"] : []),
      },
    })),
    check: vi.fn(async () => opts.policy ?? { ok: true }),
  }
  // Decision 1: `create` is called with `notify: false` from inside this
  // service's own transaction, and `notifyPending` is called once it
  // resolves. The real submission service provides both (see
  // tests/content-moderation/notifications.test.ts); this fake only needs
  // to exist and not throw.
  const submissions = {
    create: vi.fn(async (data: any) => {
      const doc = await strapi
        .documents(SUB)
        .create({ data: { ...data, status: "pending" } })

      return doc
    }),
    notifyPending: vi.fn(),
  }
  strapi.plugin = vi.fn((name: string) => ({
    service: (s: string) =>
      name === "events" && s === "credentials"
        ? credentials
        : s === "submission-policy"
          ? policy
          : s === "submission"
            ? submissions
            : undefined,
  }))
  const feeds = feedsFactory({ strapi, testFeed })

  return { ...fake, feeds, policy, submissions, testFeed, opts }
}

const ICAL = { feedUrl: "https://cal.example.org/private/tok123456/basic.ics" }
const ICAL_NEW = {
  feedUrl: "https://cal.example.org/private/new999999/basic.ics",
}

async function connected(opts: SetupOpts = {}) {
  const s = setup(opts)
  const r: any = await s.feeds.connect(USER, {
    libraryDocumentId: L1,
    provider: "ical",
    values: ICAL,
  })
  const row = s.store[CRED]![0]!
  Object.assign(row, {
    status: "active",
    pendingSubmissionDocumentId: null,
    submissionDocumentId: r.submissionDocumentId,
  })

  return { ...s, row }
}

describe("feeds.connect", () => {
  it("stores the value encrypted on a pending row and opens a Submission without it", async () => {
    const { feeds, store, submissions } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.result).toBe("ok")
    const row = store[CRED]![0]!
    expect(row).toMatchObject({
      status: "pending",
      source: "library",
      connectedBy: "ba:ba-owner",
      scope: "library",
    })
    expect(
      openValues(row.credentialsEncrypted, row.documentId, "current")
    ).toEqual(ICAL)
    expect(row.pendingSubmissionDocumentId).toBe(r.submissionDocumentId)
    const sub = store[SUB]![0]!
    expect(sub.submissionType).toBe("event_feed")
    expect(sub.targetDocumentId).toBe(L1)
    expect(JSON.stringify(sub)).not.toContain("tok123456")
    expect(sub.fields).toMatchObject({
      kind: "connect",
      credentialDocumentId: row.documentId,
      provider: "ical",
      hints: { feedUrl: "https://cal.example.org/…" },
      test: { result: "ok" },
    })
    expect(store[EVENTS]!.map((e) => e.action)).toEqual(["connect_submitted"])
    // The submission was created with notify: false, and this service
    // schedules the alert itself, once the transaction has resolved.
    expect(submissions.create).toHaveBeenCalledWith(
      expect.objectContaining({ notify: false })
    )
    expect(submissions.notifyPending).toHaveBeenCalledTimes(1)
    expect(submissions.notifyPending.mock.calls[0]![0]).toMatchObject({
      documentId: r.submissionDocumentId,
    })
  })

  it("refuses a library the user hasn't claimed, with 404", async () => {
    const { feeds, store } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L2,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({
      status: 404,
      message: "Library not found.",
    })
    expect(store[CRED]).toHaveLength(0)
  })

  it("refuses a blocking test result and stores nothing", async () => {
    const { feeds, store } = setup({ test: "auth_failed" })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({
      status: 422,
      name: "test_failed",
      result: "auth_failed",
    })
    expect(store[CRED]).toHaveLength(0)
    expect(store[SUB]).toHaveLength(0)
  })

  it("lets a transient failure through and records it", async () => {
    const { feeds, store } = setup({ test: "unreachable" })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.result).toBe("unreachable")
    expect(store[SUB]![0]!.fields.test.result).toBe("unreachable")
  })

  it("refuses invalid values before testing", async () => {
    const { feeds, testFeed } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: { feedUrl: "nope" },
    })
    expect(r.error).toMatchObject({ status: 400, field: "feedUrl" })
    expect(testFeed).not.toHaveBeenCalled()
  })

  it("passes the policy's refusal through (quota, tier)", async () => {
    const { feeds } = setup({
      policy: { ok: false, status: 429, message: "Too many pending" },
    })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error.status).toBe(429)
  })

  it("refuses a sixth feed on one library", async () => {
    const { feeds, store } = setup()
    for (let i = 0; i < 5; i++)
      store[CRED]!.push({
        documentId: `credX00000000000000000${i}`,
        provider: "ical",
        status: "active",
        scope: "library",
        libraries: [{ documentId: L1 }],
      } as any)
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({ status: 409, name: "too_many_feeds" })
  })

  it(`refuses a connect once the user has ${MAX_OPEN_FEED_SUBMISSIONS} open feed submissions`, async () => {
    const { feeds, store } = setup()
    for (let i = 0; i < MAX_OPEN_FEED_SUBMISSIONS; i++)
      store[SUB]!.push({
        documentId: `subopen000000000000000${i}`,
        submissionType: "event_feed",
        submittedByUserId: USER.id,
        status: "pending",
      } as any)
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({ status: 429, name: "too_many_open" })
    expect(store[CRED]).toHaveLength(0)
  })
})

describe("feeds.replace", () => {
  it("writes the pending slot and keeps the current value", async () => {
    const { feeds, row, store, submissions } = await connected()
    const current = row.credentialsEncrypted
    const r: any = await feeds.replace(USER, row.documentId, {
      values: ICAL_NEW,
    })
    expect(row.credentialsEncrypted).toBe(current)
    expect(
      openValues(row.pendingCredentialsEncrypted, row.documentId, "pending")
    ).toEqual(ICAL_NEW)
    expect(row.pendingSubmissionDocumentId).toBe(r.submissionDocumentId)
    const submission = store[SUB]!.at(-1)!
    expect(submission.fields).toMatchObject({
      kind: "replace",
      previousHints: row.hints,
    })
    expect(submissions.notifyPending).toHaveBeenCalledTimes(2) // connect + replace
    // The new secret value never reaches the Submission or the audit log.
    expect(JSON.stringify(submission)).not.toContain("new999999")
    expect(JSON.stringify(store[EVENTS])).not.toContain("new999999")
  })

  it("refuses a second pending replacement", async () => {
    const { feeds, row } = await connected()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error).toMatchObject({ status: 409, name: "replacement_pending" })
  })

  it("answers 404 to someone without a claim on the feed's library", async () => {
    const { feeds, row, policy } = await connected()
    policy.loadCapabilities.mockResolvedValueOnce({
      caps: { claimedLibraryIds: new Set([L2]), set: new Set(["events.feed"]) },
    })
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error.status).toBe(404)
  })

  it("refuses group feeds", async () => {
    const { feeds, row } = await connected()
    row.scope = "group"
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error).toMatchObject({ status: 403, name: "group_feed" })
  })

  it("refuses a feed still waiting for its first review", async () => {
    const { feeds, row } = await connected()
    row.status = "pending"
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error).toMatchObject({ status: 409, name: "review_pending" })
  })

  it("refuses a blocking test result and stores nothing new", async () => {
    const { feeds, row, store, opts } = await connected()
    // Only this call's test should be blocking: `connected()`'s own
    // connect must succeed first, so the result is changed afterwards —
    // `opts` is read live by the fake `testFeed` on every call.
    opts.test = "auth_failed"
    const subCountBefore = store[SUB]!.length
    const r: any = await feeds.replace(USER, row.documentId, {
      values: ICAL_NEW,
    })
    expect(r.error).toMatchObject({
      status: 422,
      name: "test_failed",
      result: "auth_failed",
    })
    expect(row.pendingCredentialsEncrypted).toBeUndefined()
    expect(row.pendingSubmissionDocumentId).toBeNull()
    expect(store[SUB]!.length).toBe(subCountBefore)
  })

  it("returns 409 and creates no second Submission when a concurrent replace's Submission lands during the test", async () => {
    let rowId = ""
    const s = await connected({
      onTest: () => {
        if (!rowId) return
        const row = s.store[CRED]!.find((r: any) => r.documentId === rowId)
        if (row) row.pendingSubmissionDocumentId = "docintruder00000000001"
      },
    })
    rowId = s.row.documentId
    const subCountBefore = s.store[SUB]!.length
    const r: any = await s.feeds.replace(USER, s.row.documentId, {
      values: ICAL_NEW,
    })
    expect(r.error).toMatchObject({ status: 409, name: "replacement_pending" })
    expect(s.store[SUB]!.length).toBe(subCountBefore)
    // The intruding write is left exactly as it was: the aborted replace
    // didn't overwrite it.
    expect(s.row.pendingSubmissionDocumentId).toBe("docintruder00000000001")
  })

  it("returns 404 and creates no Submission when the feed is deleted during the test", async () => {
    let rowId = ""
    const s = await connected({
      onTest: () => {
        if (!rowId) return
        const idx = s.store[CRED]!.findIndex((r: any) => r.documentId === rowId)
        if (idx !== -1) s.store[CRED]!.splice(idx, 1)
      },
    })
    rowId = s.row.documentId
    const subCountBefore = s.store[SUB]!.length
    const r: any = await s.feeds.replace(USER, s.row.documentId, {
      values: ICAL_NEW,
    })
    expect(r.error).toMatchObject({ status: 404, message: "Feed not found." })
    expect(s.store[SUB]!.length).toBe(subCountBefore)
  })
})

describe("feeds.testValues", () => {
  it("returns 404 for a library the user hasn't claimed, without calling testFeed", async () => {
    const { feeds, testFeed } = setup()
    const r: any = await feeds.testValues(USER, {
      libraryDocumentId: L2,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({
      status: 404,
      message: "Library not found.",
    })
    expect(testFeed).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid values, without calling testFeed", async () => {
    const { feeds, testFeed } = setup()
    const r: any = await feeds.testValues(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: { feedUrl: "nope" },
    })
    expect(r.error).toMatchObject({ status: 400, field: "feedUrl" })
    expect(testFeed).not.toHaveBeenCalled()
  })

  it("returns the result without storing anything", async () => {
    const { feeds, store } = setup({ test: "unreachable" })
    const r: any = await feeds.testValues(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r).toEqual({ result: "unreachable" })
    expect(store[CRED]).toHaveLength(0)
    expect(store[SUB]).toHaveLength(0)
  })
})

describe("feeds.list", () => {
  it("lists each claimed library with its feeds, without encrypted fields", async () => {
    const { feeds } = setup()
    await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    const r = await feeds.list(USER)
    expect(r.libraries).toHaveLength(1)
    expect(r.libraries[0]!.library.name).toBe("Central Library")
    const feed: any = r.libraries[0]!.feeds[0]
    expect(feed.status).toBe("pending")
    expect(feed.review).toMatchObject({ kind: "connect", status: "pending" })
    expect(JSON.stringify(r)).not.toMatch(/credentialsEncrypted|connectedBy/)
  })

  it("excludes feeds on libraries the user hasn't claimed", async () => {
    const s = setup({ claims: [L1] })
    await s.feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    // A feed on a library the user has no claim on (seeded directly, as an
    // admin-managed or another librarian's feed would be).
    s.store[CRED]!.push({
      documentId: "credL2feed0000000000001",
      provider: "ical",
      status: "active",
      scope: "library",
      source: "admin",
      connectedBy: "ba:someone-else",
      credentialsEncrypted: "{}",
      hints: {},
      libraries: [{ documentId: L2 }],
    } as any)
    const r = await s.feeds.list(USER)
    expect(r.libraries).toHaveLength(1)
    expect(r.libraries[0]!.library.documentId).toBe(L1)
    expect(JSON.stringify(r)).not.toContain(L2)
  })
})

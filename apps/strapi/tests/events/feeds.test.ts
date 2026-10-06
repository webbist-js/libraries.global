import {
  MAX_FEEDS_PER_LIBRARY,
  MAX_OPEN_FEED_SUBMISSIONS,
} from "@repo/shared-data"
import { beforeEach, describe, expect, it, vi } from "vitest"

import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import feedsFactory from "../../src/plugins/events/server/services/feeds"
import {
  openValues,
  sealValues,
} from "../../src/plugins/events/server/utils/credential-crypto"
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
    updateStatus: vi.fn(async () => ({ data: {} })),
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
    // Finding 6: the library's slug and name travel with the submission, so
    // the moderation queue, the submitter's own list and the moderator
    // alert can name it without a value or a live lookup.
    expect(sub.targetSlug).toBe("central")
    expect(JSON.stringify(sub)).not.toContain("tok123456")
    expect(sub.fields).toMatchObject({
      kind: "connect",
      credentialDocumentId: row.documentId,
      provider: "ical",
      hints: { feedUrl: "https://cal.example.org/…" },
      test: { result: "ok" },
      libraryName: "Central Library",
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
    // The fake store doesn't resolve relations on populate (it returns
    // exactly what was written); a real `libraries: { fields: [...] }`
    // populate would include the library's name and slug, which `replace`
    // now reads (Finding 6) — seed what that join would actually return.
    Object.assign(row, {
      libraries: [{ documentId: L1, name: "Central Library", slug: "central" }],
    })
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
    expect(submission.targetSlug).toBe("central")
    expect(submission.fields).toMatchObject({
      kind: "replace",
      previousHints: row.hints,
      libraryName: "Central Library",
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

  it("includes a draft feed with its hints.organizations, for the organisation page", async () => {
    const s = setup({ claims: [L1] })
    // Seeded as `feed-oauth.exchangeEventbrite` leaves it: a draft credential
    // with the choices the librarian picks from on `/organisation`.
    s.store[CRED]!.push({
      documentId: "credDraftEventbrite00001",
      provider: "eventbrite",
      status: "draft",
      scope: "library",
      source: "library",
      connectedBy: "ba:ba-owner",
      credentialsEncrypted: "{}",
      hints: {
        organizations: [
          { id: "org1", name: "Central Library Events" },
          { id: "org2", name: "Friends of Central Library" },
        ],
      },
      libraries: [{ documentId: L1 }],
    } as any)
    const r = await s.feeds.list(USER)
    const feed: any = r.libraries[0]!.feeds.find(
      (f: any) => f.documentId === "credDraftEventbrite00001"
    )
    expect(feed).toBeDefined()
    expect(feed.status).toBe("draft")
    expect(feed.hints.organizations).toEqual([
      { id: "org1", name: "Central Library Events" },
      { id: "org2", name: "Friends of Central Library" },
    ])
  })
})

describe("direct actions", () => {
  async function active() {
    const s = setup()
    const r: any = await s.feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    const row = s.store[CRED]![0]!
    Object.assign(row, {
      status: "active",
      pendingSubmissionDocumentId: null,
      id: 42,
    })
    s.store[SUB]![0]!.status = "approved"

    return { ...s, row, sub: r.submissionDocumentId }
  }

  it("pauses and resumes, recomputing the flag and queueing a sync", async () => {
    const { feeds, row, store } = await active()
    expect(await feeds.pause(USER, row.documentId)).toEqual({
      status: "paused",
    })
    expect(row).toMatchObject({ status: "paused", pausedReason: "library" })
    expect(await feeds.resume(USER, row.documentId)).toEqual({
      status: "active",
    })
    expect(
      store["plugin::events.sync-command"]!.at(-1)!.credentialDocumentId
    ).toBe(row.documentId)
    expect(store[EVENTS]!.map((e) => e.action)).toEqual(
      expect.arrayContaining(["paused", "resumed"])
    )
  })

  it("won't resume a feed that is waiting for review", async () => {
    const { feeds, row } = await active()
    Object.assign(row, { status: "pending" })
    expect(await feeds.resume(USER, row.documentId)).toMatchObject({
      error: { status: 409 },
    })
  })

  // Finding 2: an admin pause is Libraries Global's own call (abuse, a
  // policy breach) — only staff lift it, not the library.
  it("refuses to resume a feed Libraries Global paused", async () => {
    const { feeds, row } = await active()
    Object.assign(row, { status: "paused", pausedReason: "admin" })
    expect(await feeds.resume(USER, row.documentId)).toMatchObject({
      error: { status: 403, name: "admin_paused" },
    })
  })

  // An auto-pause from repeated sync failures needs fixed details, not just
  // a resume — the auto-pause email already tells the library to replace
  // them, so resume must point the same way.
  it("refuses to resume a feed auto-paused by sync failures", async () => {
    const { feeds, row } = await active()
    Object.assign(row, { status: "paused", pausedReason: "sync_failures" })
    expect(await feeds.resume(USER, row.documentId)).toMatchObject({
      error: { status: 409, name: "replace_required" },
    })
  })

  it("still resumes a feed the library itself paused", async () => {
    const { feeds, row } = await active()
    Object.assign(row, { status: "paused", pausedReason: "library" })
    expect(await feeds.resume(USER, row.documentId)).toEqual({
      status: "active",
    })
  })

  // Finding 7: pause/resume/disconnect/withdrawPending/testCurrent all go
  // through `manageable()`, same as `replace` — covered there for 404/403.
  // These confirm the other actions share the same guard.
  it.each([
    ["pause", (feeds: any, id: string) => feeds.pause(USER, id)],
    ["resume", (feeds: any, id: string) => feeds.resume(USER, id)],
    ["disconnect", (feeds: any, id: string) => feeds.disconnect(USER, id)],
    [
      "withdrawPending",
      (feeds: any, id: string) => feeds.withdrawPending(USER, id),
    ],
    ["testCurrent", (feeds: any, id: string) => feeds.testCurrent(USER, id)],
  ])(
    "%s answers 404 to someone without a claim on the feed's library",
    async (_name, call) => {
      const { feeds, row, policy } = await active()
      policy.loadCapabilities.mockResolvedValueOnce({
        caps: {
          claimedLibraryIds: new Set([L2]),
          set: new Set(["events.feed"]),
        },
      })
      const r: any = await call(feeds, row.documentId)
      expect(r.error.status).toBe(404)
    }
  )

  it.each([
    ["pause", (feeds: any, id: string) => feeds.pause(USER, id)],
    ["resume", (feeds: any, id: string) => feeds.resume(USER, id)],
    ["disconnect", (feeds: any, id: string) => feeds.disconnect(USER, id)],
    [
      "withdrawPending",
      (feeds: any, id: string) => feeds.withdrawPending(USER, id),
    ],
    ["testCurrent", (feeds: any, id: string) => feeds.testCurrent(USER, id)],
  ])("%s refuses a group feed", async (_name, call) => {
    const { feeds, row } = await active()
    row.scope = "group"
    const r: any = await call(feeds, row.documentId)
    expect(r.error).toMatchObject({ status: 403, name: "group_feed" })
  })

  it("rate-limits tests per feed", async () => {
    const { feeds, row } = await active()
    row.lastTestedAt = new Date().toISOString()
    expect(await feeds.testCurrent(USER, row.documentId)).toMatchObject({
      error: { status: 429, name: "too_soon" },
    })
  })

  it("disconnect deletes the row, its events and rejects an open review", async () => {
    const { feeds, row, store, strapi } = await active()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    store["plugin::events.event"]!.push({
      documentId: "ev1",
      credentialId: 42,
    } as any)
    const updateStatus = vi.fn(async () => ({ data: {} }))
    ;(strapi.plugin as any).mockImplementation((name: string) => ({
      service: (s: string) =>
        s === "credentials"
          ? credentialsFactory({ strapi })
          : s === "submission"
            ? { updateStatus, create: vi.fn() }
            : s === "submission-policy"
              ? {
                  loadCapabilities: async () => ({
                    caps: {
                      claimedLibraryIds: new Set([L1]),
                      set: new Set(["events.feed"]),
                    },
                  }),
                  check: async () => ({ ok: true }),
                }
              : undefined,
    }))
    expect(await feeds.disconnect(USER, row.documentId)).toEqual({ ok: true })
    expect(store[CRED]).toHaveLength(0)
    expect(store["plugin::events.event"]).toHaveLength(0)
    expect(updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      "rejected",
      expect.objectContaining({ kind: "system" }),
      "Withdrawn by the library"
    )
    expect(store[EVENTS]!.at(-1)!.action).toBe("disconnected")
  })

  it("withdrawing a pending replacement clears the slot", async () => {
    const { feeds, row } = await active()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(await feeds.withdrawPending(USER, row.documentId)).toEqual({
      ok: true,
    })
    expect(row.pendingCredentialsEncrypted).toBeNull()
    expect(row.pendingSubmissionDocumentId).toBeNull()
  })
})

describe("feeds.completeDraft", () => {
  const DRAFT_ID = "credDraftEB000000000001"

  function draftRow(overrides: Record<string, any> = {}) {
    return {
      documentId: DRAFT_ID,
      provider: "eventbrite",
      status: "draft",
      scope: "library",
      source: "library",
      connectedBy: "ba:ba-owner",
      credentialsEncrypted: sealValues(
        { accessToken: "EB_TOKEN_ABCDEFGHIJKL" },
        DRAFT_ID,
        "current"
      ),
      hints: { organizations: [{ id: "100200", name: "Central Events" }] },
      // A real `libraries: { fields: [...] }` populate would return the
      // library's own name and slug; the fake doesn't resolve relations, so
      // they're seeded directly here (see the `replace` test's own note).
      libraries: [{ documentId: L1, name: "Central Library", slug: "central" }],
      ...overrides,
    }
  }

  it("validates the chosen organisation, tests it and opens a review naming the library (Finding 6)", async () => {
    const { feeds, store } = setup()
    store[CRED]!.push(draftRow() as any)
    const r: any = await feeds.completeDraft(USER, DRAFT_ID, "100200")
    expect(r.result).toBe("ok")
    const row = store[CRED]!.find((c: any) => c.documentId === DRAFT_ID)!
    expect(row.status).toBe("pending")
    expect(row.pendingSubmissionDocumentId).toBe(r.submissionDocumentId)
    const sub = store[SUB]!.find(
      (s: any) => s.documentId === r.submissionDocumentId
    )!
    expect(sub.targetSlug).toBe("central")
    expect(sub.fields).toMatchObject({
      provider: "eventbrite",
      libraryName: "Central Library",
    })
  })

  // Finding 7: no prior test called `completeDraft` directly at all.
  it("refuses a draft the user doesn't own or hasn't claimed", async () => {
    const s = setup({ claims: [] })
    s.store[CRED]!.push(draftRow() as any)
    const r: any = await s.feeds.completeDraft(USER, DRAFT_ID, "100200")
    expect(r.error).toMatchObject({ status: 404 })
  })

  it("refuses an organisation id the draft didn't offer", async () => {
    const { feeds, store } = setup()
    store[CRED]!.push(draftRow() as any)
    const r: any = await feeds.completeDraft(USER, DRAFT_ID, "999999")
    expect(r.error).toMatchObject({
      status: 400,
      name: "invalid_organization",
    })
  })

  // Finding 4: completing a draft used to skip the per-library feed cap
  // entirely. The draft itself already counts toward the cap, so the check
  // excludes it — 5 *other* feeds plus this draft is the 6th.
  it("refuses a sixth feed on the library, excluding the draft itself", async () => {
    const { feeds, store } = setup()
    store[CRED]!.push(draftRow() as any)
    for (let i = 0; i < MAX_FEEDS_PER_LIBRARY; i++)
      store[CRED]!.push({
        documentId: `credX00000000000000000${i}`,
        provider: "ical",
        status: "active",
        scope: "library",
        libraries: [{ documentId: L1 }],
      } as any)
    const r: any = await feeds.completeDraft(USER, DRAFT_ID, "100200")
    expect(r.error).toMatchObject({ status: 409, name: "too_many_feeds" })
  })
})

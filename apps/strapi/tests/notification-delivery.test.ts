import {
  mergeNotificationPreferences,
  NOTIFICATION_DEFAULTS,
} from "@repo/shared-data"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../src/utils/email-recipients", () => ({
  verifiedEmailMap: vi.fn(
    async () => new Map([["owner", "current@example.org"]])
  ),
}))
import { makeFakeStrapi } from "./helpers/fake-strapi"
import inbox from "../src/api/notification/controllers/notification"
import createNotifications, {
  wantsActivityEmail,
} from "../src/api/notification/services/notification"
import createEmailPreferences from "../src/api/subscriber/services/email-preferences"
import { emailLinkToken, readEmailLink } from "../src/utils/email-links"
import { weeklyWindow } from "../src/utils/weekly-community-report"

const UID = "api::notification.notification"
const PROFILE = "api::user-profile.user-profile"
const SUBSCRIBER = "api::subscriber.subscriber"
const DEFAULT_PREFS = { newFollowers: true }
const NOW = new Date("2026-10-12T09:00:00Z")
function setup(prefs: Record<string, unknown> = DEFAULT_PREFS) {
  const fake = makeFakeStrapi({
    [PROFILE]: [
      {
        id: 1,
        documentId: "profile1",
        baUserId: "owner",
        username: "reader",
        notifPrefs: prefs,
        followedLibraries: [{ documentId: "library1" }],
      },
    ],
    [UID]: [],
  })
  const send = vi.fn(async () => {})
  fake.services["email.email"] = { send }
  const service = createNotifications({ strapi: fake.strapi })
  fake.services[UID] = service

  return { ...fake, send, service }
}
const event = {
  baUserId: "owner",
  eventKey: "follow:owner:reader",
  kind: "new_follower" as const,
  title: "New follower",
  body: "Another contributor follows you.",
  href: "/profile/reader",
  emailPreference: "newFollowers" as const,
}
const ENV = { ...process.env }
beforeEach(() => {
  process.env.MAILTRAP_USER = "fixture"
  process.env.MAILTRAP_PASS = "fixture"
  process.env.EMAIL_SEND_INTERVAL_MS = "0"
  process.env.EMAIL_LINK_SECRET = "a".repeat(64)
  process.env.STRAPI_BRIDGE_SECRET = "bridge-fixture"
  process.env.EMAIL_DIGEST_ENABLED = "true"
  process.env.EMAIL_REPORT_ENABLED = "true"
})

describe("notification preference trigger matrix", () => {
  it("refuses operator actions without the private service secret", async () => {
    const ctx: any = {
      request: { headers: {}, body: { action: "report" } },
      unauthorized: vi.fn(),
    }
    await inbox.operations(ctx)
    expect(ctx.unauthorized).toHaveBeenCalledOnce()
  })
  for (const preference of [
    "editsReviewed",
    "drives",
    "newFollowers",
    "recognition",
    "editorialMessages",
    "marketing",
    "weeklyDigest",
    "weeklyReport",
  ] as const) {
    it(`${preference}: emails only when enabled, and retains an inbox update when disabled`, async () => {
      const { service, store, send } = setup(
        mergeNotificationPreferences({}, { [preference]: true }, NOW)
      )
      await service.enqueue({
        ...event,
        eventKey: `matrix:${preference}`,
        emailPreference: preference,
      })
      await service.deliver(new Date(Date.now() + 1000))
      expect(send).toHaveBeenCalledOnce()
      const mail = send.mock.calls[0]![0] as any
      expect(mail.text).toContain("Unsubscribe:")
      expect(mail.headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      )
      await service.enqueue({
        ...event,
        eventKey: `matrix-off:${preference}`,
        emailPreference: preference,
      })
      store[PROFILE]![0]!.notifPrefs[preference] = false
      await service.deliver(new Date(Date.now() + 1000))
      expect(send).toHaveBeenCalledOnce()
      expect(store[UID]![1]!).toMatchObject({
        inApp: true,
        emailState: "skipped",
      })
    })
  }
  it("essential emails bypass optional settings", async () => {
    const prefs = Object.fromEntries(
      Object.keys(NOTIFICATION_DEFAULTS).map((k) => [k, false])
    )
    const { service, send } = setup(prefs)
    await service.enqueue({ ...event, emailPreference: "transactional" })
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).toHaveBeenCalledOnce()
    expect((send.mock.calls[0]![0] as any).headers).toBeUndefined()
  })
  it("old planned preferences are not consent to a report or product emails", () => {
    expect(wantsActivityEmail({ weeklyReport: true }, "weeklyReport")).toBe(
      false
    )
    expect(wantsActivityEmail({ marketing: true }, "marketing")).toBe(false)
  })
  it("weekly controls and their unsubscribe links remain independent", async () => {
    const { strapi, store } = setup(
      mergeNotificationPreferences(
        {},
        { weeklyDigest: true, weeklyReport: true, marketing: true },
        NOW
      )
    )
    const prefs = createEmailPreferences({ strapi })
    const token = emailLinkToken({
      id: "owner",
      purpose: "activity_unsubscribe",
      preference: "weeklyReport",
    })
    await prefs.action(token, false)
    expect(store[PROFILE]![0]!.notifPrefs.weeklyReport).toBe(true)
    await prefs.action(token, true)
    expect(store[PROFILE]![0]!.notifPrefs).toMatchObject({
      weeklyReport: false,
      reportConsentedAt: null,
      weeklyDigest: true,
      marketing: true,
    })
    expect(
      readEmailLink(
        emailLinkToken({
          id: "owner",
          purpose: "activity_unsubscribe",
          preference: "transactional",
        })
      )
    ).toBeNull()
  })
  it("uses the last completed Monday–Sunday UTC week even for manual Sunday runs", () => {
    expect(weeklyWindow(new Date("2026-10-11T23:00:00Z"))).toEqual({
      start: new Date("2026-09-28T00:00:00Z"),
      end: new Date("2026-10-05T00:00:00Z"),
    })
    expect(weeklyWindow(NOW)).toEqual({
      start: new Date("2026-10-05T00:00:00Z"),
      end: new Date("2026-10-12T00:00:00Z"),
    })
  })
})

describe("weekly community report", () => {
  it("requires separate opt-in, deduplicates field changes and republications, and keeps private notes out", async () => {
    const { service, store } = setup(
      mergeNotificationPreferences({}, { weeklyDigest: true }, NOW)
    )
    store["api::library.library"] = [
      { documentId: "new", locale: "en", publishedAt: "2026-10-10" },
      { documentId: "old", locale: "en", publishedAt: "2026-10-10" },
      { documentId: "draft", locale: "en", publishedAt: null },
    ]
    store["api::library-change.library-change"] = [
      {
        documentId: "c1",
        libraryDocumentId: "new",
        batchId: "new-batch",
        versionStatus: "published",
        action: "publish",
        source: "admin",
        changedAt: "2026-10-10T00:00:00Z",
      },
      {
        documentId: "c2",
        libraryDocumentId: "old",
        batchId: "old-batch",
        versionStatus: "published",
        action: "publish",
        source: "admin",
        changedAt: "2026-09-01T00:00:00Z",
      },
      ...["name", "hours"].map((field, i) => ({
        documentId: `e${i}`,
        libraryDocumentId: "old",
        batchId: "one-edit",
        versionStatus: "published",
        action: "update",
        source: "submission",
        field,
        changedAt: "2026-10-10T00:00:00Z",
      })),
      {
        documentId: "d1",
        libraryDocumentId: "draft",
        batchId: "secret",
        versionStatus: "published",
        action: "publish",
        source: "admin",
        changedAt: "2026-10-10T00:00:00Z",
      },
    ]
    store["api::wiki-article.wiki-article"] = [
      {
        documentId: "wiki",
        locale: "en",
        title: "Public new reading",
        slug: "reading",
        section: { slug: "guides" },
        publishedAt: "2026-10-10",
      },
    ]
    store["api::article-change.article-change"] = [
      {
        documentId: "a1",
        articleDocumentId: "wiki",
        articleKind: "wiki",
        kind: "published",
        versionStatus: "published",
        changedAt: "2026-10-10T00:00:00Z",
        editSummary: "PRIVATE REVIEWER NOTE",
      },
    ]
    store["plugin::content-moderation.submission"] = [
      {
        documentId: "s1",
        submissionType: "library_edit",
        status: "approved",
        submittedByUserId: "owner",
        reviewedAt: "2026-10-10T00:00:00Z",
        reviewNote: "PRIVATE NOTE",
      },
    ]
    await service.weeklyReport(NOW)
    expect(store[UID]).toHaveLength(0)
    store[PROFILE]![0]!.notifPrefs = mergeNotificationPreferences(
      {},
      { weeklyReport: true },
      NOW
    )
    await service.weeklyReport(NOW)
    await service.weeklyReport(NOW)
    expect(store[UID]).toHaveLength(1)
    expect(store[UID]![0]!).toMatchObject({
      kind: "weekly_report",
      emailPreference: "weeklyReport",
    })
    const body = store[UID]![0]!.body
    expect(body).toContain("Newly published libraries: 1")
    expect(body).toContain("public edit batches: 1")
    expect(body).toContain("Public new reading")
    expect(body).not.toContain("PRIVATE")
  })
  it("does not send a quiet community week, or treat a pending submission as weekly activity", async () => {
    const { service, store } = setup(
      mergeNotificationPreferences({}, { weeklyReport: true }, NOW)
    )
    store["plugin::content-moderation.submission"] = [
      { documentId: "waiting", submittedByUserId: "owner", status: "pending" },
    ]
    await service.weeklyReport(NOW)
    expect(store[UID]).toHaveLength(0)
  })
})

describe("published announcements and retention", () => {
  it("ignores drafts and future signups, deduplicates delivery, cancels unpublished messages", async () => {
    const { service, store, send } = setup({ editorialMessages: true })
    store[PROFILE]![0]!.createdAt = "2026-10-01T00:00:00Z"
    store[PROFILE]!.push({
      documentId: "late",
      id: 2,
      baUserId: "late",
      createdAt: "2026-11-01T00:00:00Z",
    })
    store["api::announcement.announcement"] = [
      {
        documentId: "notice",
        title: "Service notice",
        body: "A service interruption",
        channel: "editorialMessages",
        publishedAt: "2026-10-10T00:00:00Z",
      },
      {
        documentId: "draft",
        title: "Draft",
        body: "Private",
        channel: "marketing",
        publishedAt: null,
      },
    ]
    await service.announcements()
    await service.announcements()
    expect(store[UID]).toHaveLength(1)
    store["api::announcement.announcement"]![0]!.publishedAt = null
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).not.toHaveBeenCalled()
    expect(store[UID]![0]!.emailState).toBe("skipped")
  })
  it("purges the app's notifications after 90 days", async () => {
    const { service, store } = setup()
    store[UID] = [
      { documentId: "old", createdAt: "2026-01-01T00:00:00Z" },
      { documentId: "new", createdAt: "2026-10-10T00:00:00Z" },
    ]
    await service.purge(NOW)
    expect(store[UID]!.map((r) => r.documentId)).toEqual(["new"])
  })
})
afterEach(() => {
  process.env = { ...ENV }
  vi.unstubAllGlobals()
})

describe("durable activity delivery", () => {
  it("renders structured weekly payloads in the real worker with independent category controls", async () => {
    const { service, send } = setup(
      mergeNotificationPreferences(
        {},
        { weeklyDigest: true, weeklyReport: true },
        NOW
      )
    )
    const period = {
      start: "2026-10-05T00:00:00Z",
      end: "2026-10-12T00:00:00Z",
    }
    for (const report of [false, true])
      await service.enqueue({
        ...event,
        eventKey: report ? "report-render" : "digest-render",
        kind: report ? "weekly_report" : "weekly_digest",
        emailPreference: report ? "weeklyReport" : "weeklyDigest",
        title: "Weekly",
        body: "Plain inbox copy",
        emailPayload: report
          ? {
              communityReport: {
                ...period,
                personal: { accepted: 3, points: 45, awaiting: 1 },
                week: {
                  newLibraries: 12,
                  updatedLibraries: 37,
                  edits: 51,
                  accepted: 28,
                  knowledge: 2,
                  journal: 1,
                  articles: [],
                },
              },
            }
          : {
              digest: {
                ...period,
                libraries: [
                  { name: "Central & West", href: "/europe/uk/west/central" },
                ],
              },
            },
      })
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).toHaveBeenCalledTimes(2)
    const messages = send.mock.calls.map((call) => call[0] as any)
    const digest = messages.find(
      (message) => message.subject === "Your weekly library digest"
    )
    const report = messages.find(
      (message) => message.subject === "Your weekly community report"
    )
    expect(digest.html).toContain("Central &amp; West")
    expect(digest.html).not.toContain("Across the community")
    expect(report.html).toContain("Across the community")
    expect(report.text).toContain("45")
    for (const message of messages) {
      expect(message.html.match(/>Unsubscribe</g)).toHaveLength(1)
      expect(message.headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      )
    }
  })

  it("deduplicates an event and uses the current verified account address", async () => {
    const { service, send, store } = setup()
    await service.enqueue(event)
    await service.enqueue(event)
    expect(store[UID]).toHaveLength(1)
    expect(send).not.toHaveBeenCalled()
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "current@example.org" })
    expect(store[UID]![0]!.emailState).toBe("sent")
    await service.deliver(new Date(Date.now() + 2000))
    expect(send).toHaveBeenCalledOnce()
  })
  it("keeps the in-app event but cancels email after a preference is withdrawn", async () => {
    const { service, send, store } = setup()
    await service.enqueue(event)
    store[PROFILE]![0]!.notifPrefs.newFollowers = false
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).not.toHaveBeenCalled()
    expect(store[UID]![0]!).toMatchObject({
      inApp: true,
      emailState: "skipped",
    })
  })
  it("does not mail an erased account", async () => {
    const { service, send, store } = setup()
    await service.enqueue(event)
    store[PROFILE]!.splice(0)
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).not.toHaveBeenCalled()
    expect(store[UID]![0]!.emailState).toBe("skipped")
  })
  it("retries provider failure and stops after five failed attempts", async () => {
    const { service, send, store } = setup()
    send.mockRejectedValue(new Error("provider unavailable"))
    await service.enqueue(event)
    for (let i = 0; i < 5; i++) {
      await service.deliver(new Date(Date.now() + (i + 1) * 86400000))
    }
    expect(store[UID]![0]!).toMatchObject({ emailState: "failed", attempts: 5 })
    await service.deliver(new Date(Date.now() + 10 * 86400000))
    expect(send).toHaveBeenCalledTimes(5)
  })
  it("holds email in the queue when the provider is not configured", async () => {
    const { service, send, store } = setup()
    for (const key of [
      "MAILTRAP_USER",
      "MAILTRAP_PASS",
      "SMTP_HOST",
      "MAILGUN_API_KEY",
    ])
      delete process.env[key]
    await service.enqueue(event)
    await service.deliver(new Date(Date.now() + 1000))
    expect(send).not.toHaveBeenCalled()
    expect(store[UID]![0]!.emailState).toBe("pending")
  })
})

describe("weekly digest", () => {
  it("requires new consent, contains public names, and queues only once per week", async () => {
    const { service, store } = setup({ weeklyDigest: true })
    store["api::library-change.library-change"] = [
      {
        libraryDocumentId: "library1",
        versionStatus: "published",
        action: "publish",
        source: "admin",
        changedAt: "2026-10-10T12:00:00Z",
      },
    ]
    store["api::library.library"] = [
      {
        documentId: "library1",
        name: "Public library",
        publishedAt: "2026-01-01",
        locale: "en",
      },
      { documentId: "library2", name: "Private draft", locale: "en" },
    ]
    await service.weeklyDigest(NOW)
    expect(store[UID]).toHaveLength(0)
    store[PROFILE]![0]!.notifPrefs.digestConsentedAt = "2026-10-10"
    await service.weeklyDigest(NOW)
    await service.weeklyDigest(NOW)
    expect(store[UID]).toHaveLength(1)
    expect(store[UID]![0]!.body).toContain("Public library")
    expect(store[UID]![0]!.body).not.toContain("Private draft")
  })
  it("sends no digest in a quiet week", async () => {
    const { service, store } = setup({
      weeklyDigest: true,
      digestConsentedAt: "2026-10-10",
    })
    await service.weeklyDigest(NOW)
    expect(store[UID]).toHaveLength(0)
  })
})

it("isolates inbox reads and read receipts to their authenticated owner", async () => {
  const { strapi, store } = setup()
  vi.stubGlobal("strapi", strapi)
  store[UID] = [
    {
      documentId: "mine",
      baUserId: "owner",
      inApp: true,
      title: "Mine",
      body: "Mine",
      readAt: null,
      emailPayload: { token: "private" },
    },
    { documentId: "other", baUserId: "other", inApp: true, readAt: null },
  ]
  const ctx: any = {
    request: {
      headers: {
        "x-service-secret": "bridge-fixture",
        "x-ba-user-id": "owner",
      },
      body: { documentId: "other" },
    },
    set: vi.fn(),
    send: vi.fn(),
    unauthorized: vi.fn(),
  }
  await inbox.inbox(ctx)
  expect(ctx.send.mock.calls[0][0].data).toEqual([
    expect.objectContaining({ documentId: "mine" }),
  ])
  expect(ctx.send.mock.calls[0][0].data[0].emailPayload).toBeUndefined()
  await inbox.read(ctx)
  expect(store[UID][1].readAt).toBeNull()
  ctx.request.body.documentId = "all"
  await inbox.read(ctx)
  expect(store[UID][0].readAt).toBeTruthy()
  expect(store[UID][1].readAt).toBeNull()
})

describe("newsletter confirmation and withdrawal", () => {
  it("inspecting a link never opts in; confirmation requires its current consent version", async () => {
    const { strapi, store } = setup()
    store[SUBSCRIBER] = [
      {
        documentId: "subscription",
        type: "newsletter",
        state: "pending_confirmation",
        consentedAt: "2026-10-10",
      },
    ]
    const service = createEmailPreferences({ strapi })
    const token = emailLinkToken({
      id: "subscription",
      purpose: "newsletter_confirm",
      version: "2026-10-10",
      exp: Date.now() + 100000,
    })
    await service.action(token, false)
    expect(store[SUBSCRIBER][0].state).toBe("pending_confirmation")
    await service.action(token, true)
    expect(store[SUBSCRIBER][0]).toMatchObject({
      state: "active",
      confirmedAt: expect.any(String),
    })
    const unsub = emailLinkToken({
      id: "subscription",
      purpose: "newsletter_unsubscribe",
    })
    await service.action(unsub, true)
    expect(store[SUBSCRIBER][0].state).toBe("unsubscribed")
    expect(await service.action(token, true)).toBeNull()
  })
  it("rejects tampered and expired links", () => {
    const token = emailLinkToken({
      id: "subscription",
      purpose: "newsletter_confirm",
      exp: Date.now() - 1000,
    })
    expect(readEmailLink(token)).toBeNull()
    expect(readEmailLink(token + "x")).toBeNull()
  })
})

it("adds followed-library updates to the inbox without enabling email", async () => {
  const { service, store } = setup({ weeklyDigest: false })
  store["api::library-change.library-change"] = [
    {
      libraryDocumentId: "library1",
      versionStatus: "published",
      action: "publish",
      source: "admin",
      changedAt: "2026-10-12T08:00:00Z",
    },
  ]
  store["api::library.library"] = [
    {
      documentId: "library1",
      name: "Public library",
      publishedAt: "2026-01-01",
      locale: "en",
    },
  ]
  await service.followedLibraryUpdates(NOW)
  await service.followedLibraryUpdates(NOW)
  expect(store[UID]).toHaveLength(1)
  expect(store[UID]![0]).toMatchObject({
    kind: "library_update",
    emailState: "none",
    inApp: true,
  })
})

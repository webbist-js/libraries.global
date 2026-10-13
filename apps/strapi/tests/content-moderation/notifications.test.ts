import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../src/utils/email-recipients", () => ({
  verifiedEmailMap: vi.fn(
    async (_strapi: unknown, ids: string[]) =>
      new Map(ids.map((id) => [id, `${id}@example.org`]))
  ),
}))

import createActivityNotifications from "../../src/api/notification/services/notification"
import createNotifications, {
  setNotificationScheduler,
} from "../../src/plugins/content-moderation/server/services/notifications"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { emailConfigured } from "../../src/plugins/content-moderation/server/utils/email-config"
import {
  applicationDecidedEmail,
  decidedEmail,
  moderatorAlertEmail,
} from "../../src/plugins/content-moderation/server/utils/email-templates"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const REVIEWER = adminReviewer({ id: 7, email: "mod@example.org" })
const CORRECTION_ID = "s0000000000000000000001"

const correction = () => {
  const s: any = {
    documentId: CORRECTION_ID,
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u1",
    submittedByEmail: "u1@example.org",
    submittedByName: "Ada",
    targetSlug: "x",
    fields: { a: 1 },
    draftData: null,
  }
  s.payloadHash = payloadHash(s)

  return s
}

/** Notification tasks queued off the request path; `flush` runs them. */
let queued: (() => Promise<void>)[] = []
async function flush(): Promise<void> {
  const tasks = queued
  queued = []
  for (const task of tasks) await task()
}

function setup(
  opts: {
    /** false: no Mailgun or Mailtrap credentials in the environment. */
    configured?: boolean
    send?: (msg: unknown) => Promise<void>
    notifPrefs?: Record<string, unknown>
    seed?: any[]
  } = {}
) {
  if (opts.configured !== false) {
    process.env.MAILGUN_API_KEY = "key"
    process.env.MAILGUN_DOMAIN = "mg.example.org"
  }
  const f = makeFakeStrapi({
    [SUB]: opts.seed ?? [correction()],
    [PROFILE]: [
      {
        documentId: "p0000000000000000000001",
        baUserId: "u1",
        notifPrefs: opts.notifPrefs ?? { editsReviewed: true },
      },
    ],
  })
  const send = vi.fn(opts.send ?? (async () => {}))
  // Strapi's email plugin falls back to `sendmail` when the app's config is
  // null, so the provider setting alone never says "not configured".
  f.strapi.config = {
    get: (key: string) =>
      key === "plugin::email.provider" ? "sendmail" : undefined,
  }
  const activity = createActivityNotifications({ strapi: f.strapi })
  f.services["api::notification.notification"] = {
    enqueue: vi.fn(async (input) => {
      await activity.enqueue(input)
      await activity.deliver(new Date(Date.now() + 1000))
    }),
  }
  f.services["email.email"] = { send }
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }
  f.services["content-moderation.notifications"] = createNotifications({
    strapi: f.strapi,
  })

  return { ...f, send, svc: createService({ strapi: f.strapi }) }
}

const ENV = { ...process.env }
const MAIL_ENV = [
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILTRAP_USER",
  "MAILTRAP_PASS",
  "MODERATORS_EMAIL",
]
beforeEach(() => {
  process.env.APP_PUBLIC_URL = "https://app.example.org/"
  process.env.EMAIL_SEND_INTERVAL_MS = "0"
  process.env.EMAIL_LINK_SECRET = "a".repeat(64)
  for (const k of MAIL_ENV) delete process.env[k]
  queued = []
  setNotificationScheduler((task) => {
    queued.push(task)
  })
})
afterEach(() => {
  setNotificationScheduler()
  process.env = { ...ENV }
})

describe("decision emails", () => {
  it("emails the submitter when a correction is approved", async () => {
    const { svc, send } = setup()
    const res = await svc.updateStatus(
      CORRECTION_ID,
      "approved",
      REVIEWER,
      "Thanks, fixed."
    )
    expect("data" in res).toBe(true)
    // Nothing is sent on the request path.
    expect(send).not.toHaveBeenCalled()
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    const msg: any = send.mock.calls[0]![0]
    expect(msg.to).toBe("u1@example.org")
    expect(msg.text).toContain("https://app.example.org/contribute/submissions")
    expect(msg.text).toContain("Thanks, fixed.")
    expect(msg.html).toContain("Thanks, fixed.")
  })

  it("respects editsReviewed: false", async () => {
    const { svc, send, store } = setup({
      notifPrefs: { editsReviewed: false },
    })
    await svc.updateStatus(CORRECTION_ID, "rejected", REVIEWER)
    await flush()
    expect(send).not.toHaveBeenCalled()
    expect(store["api::notification.notification"]![0]).toMatchObject({
      inApp: true,
      emailState: "skipped",
    })
  })

  it("never fails the approval when sending throws", async () => {
    const { svc, store, strapi } = setup({
      send: async () => {
        throw new Error("smtp down")
      },
    })
    const res = await svc.updateStatus(CORRECTION_ID, "approved", REVIEWER)
    expect("data" in res).toBe(true)
    expect(store[SUB]![0]!.status).toBe("approved")
    await flush()
    expect(strapi.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("[email]")
    )
  })

  it("logs and skips when no email provider is configured", async () => {
    const { svc, send, store } = setup({ configured: false })
    const res = await svc.updateStatus(CORRECTION_ID, "approved", REVIEWER)
    expect("data" in res).toBe(true)
    await flush()
    expect(send).not.toHaveBeenCalled()
    expect(store["api::notification.notification"]![0]).toMatchObject({
      inApp: true,
      emailState: "pending",
    })
  })

  it("always emails an applicant about their application", async () => {
    const { strapi, send } = setup({ notifPrefs: { editsReviewed: false } })
    await createNotifications({ strapi }).submissionDecided(
      {
        documentId: "s0000000000000000000099",
        submissionType: "role_application",
        submittedByUserId: "u1",
        submittedByEmail: "u1@example.org",
        submittedByName: "Ada",
        fields: { role: "journal_editor", locales: ["fr"] },
      },
      "approved"
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect((send.mock.calls[0]![0] as any).text).toContain("Journal editor")
  })
})

describe("moderator alerts", () => {
  it("emails MODERATORS_EMAIL when an application reaches pending", async () => {
    const { svc, send } = setup()
    const created: any = await svc.create({
      submissionType: "role_application",
      targetEntityType: "user_profile",
      fields: {
        role: "wiki_editor",
        locales: [],
        statement: "I have edited Knowledge articles for a year.",
        samples: [],
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      submittedByName: "Ada",
    })
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    const msg: any = send.mock.calls[0]![0]
    expect(msg.to).toBe("moderators@libraries.global")
    expect(msg.text).toContain(
      `https://app.example.org/contribute/moderation/${created.documentId}`
    )
  })

  it("uses MODERATORS_EMAIL when set, and stays quiet for drafts and ordinary submissions", async () => {
    process.env.MODERATORS_EMAIL = "mods@example.org"
    const { svc, send } = setup()
    const base = {
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
    }
    await svc.create({ ...base, submissionType: "correction", fields: {} })
    const draft: any = await svc.create({
      ...base,
      submissionType: "role_application",
      fields: { role: "wiki_editor" },
      asDraft: true,
    })
    await flush()
    expect(send).not.toHaveBeenCalled()

    await svc.finalizeDraft(draft.documentId, "u1", {})
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect((send.mock.calls[0]![0] as any).to).toBe("mods@example.org")
  })

  it("alerts MODERATORS_EMAIL when an event feed reaches pending, naming the platform", async () => {
    const { svc, send } = setup()
    await svc.create({
      submissionType: "event_feed",
      targetEntityType: "library",
      targetDocumentId: "l00000000000000000000001",
      fields: {
        kind: "connect",
        credentialDocumentId: "c00000000000000000000001",
        provider: "ical",
        hints: {},
        test: { result: "ok", testedAt: "2026-10-01T00:00:00.000Z" },
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      submittedByName: "Ada",
    })
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    const msg: any = send.mock.calls[0]![0]
    expect(msg.to).toBe("moderators@libraries.global")
    expect(msg.text).toContain("Calendar feed (.ics)")
    expect(msg.text).toContain("library")
  })

  // Finding 6: the library's own name, snapshotted on the submission at
  // creation, names it instead of the generic "a library".
  it("names the library when the submission carries libraryName", async () => {
    const { svc, send } = setup()
    await svc.create({
      submissionType: "event_feed",
      targetEntityType: "library",
      targetDocumentId: "l00000000000000000000001",
      targetSlug: "abronhill-library",
      fields: {
        kind: "connect",
        credentialDocumentId: "c00000000000000000000001",
        provider: "ical",
        hints: {},
        test: { result: "ok", testedAt: "2026-10-01T00:00:00.000Z" },
        libraryName: "Abronhill Library",
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      submittedByName: "Ada",
    })
    await flush()
    const msg: any = send.mock.calls[0]![0]
    expect(msg.text).toContain("Abronhill Library")
  })
})

describe("create's notify option", () => {
  it("schedules nothing when notify is false, even for a type that reaches pending", async () => {
    const { svc, send } = setup()
    await svc.create({
      submissionType: "role_application",
      targetEntityType: "user_profile",
      fields: {
        role: "wiki_editor",
        locales: [],
        statement: "I have edited Knowledge articles for a year.",
        samples: [],
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      submittedByName: "Ada",
      notify: false,
    })
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it("notifyPending schedules exactly the alert create would have", async () => {
    const { svc, send } = setup()
    const created: any = await svc.create({
      submissionType: "role_application",
      targetEntityType: "user_profile",
      fields: {
        role: "wiki_editor",
        locales: [],
        statement: "I have edited Knowledge articles for a year.",
        samples: [],
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      submittedByName: "Ada",
      notify: false,
    })
    expect(send).not.toHaveBeenCalled()
    svc.notifyPending(created)
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    const msg: any = send.mock.calls[0]![0]
    expect(msg.to).toBe("moderators@libraries.global")
    expect(msg.text).toContain(
      `https://app.example.org/contribute/moderation/${created.documentId}`
    )
  })
})

describe("moderator alerts on resubmission", () => {
  const waiting = (submissionType: string, documentId: string) => {
    const s: any = {
      documentId,
      submissionType,
      status: "needs_info",
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      fields: { role: "wiki_editor", locales: [] },
      draftData: null,
    }
    s.payloadHash = payloadHash(s)

    return s
  }

  it("alerts again when an application goes from needs_info back to pending", async () => {
    const appId = "s0000000000000000000077"
    const { svc, send } = setup({
      seed: [waiting("role_application", appId)],
    })
    const res = await svc.updateStatus(appId, "pending", REVIEWER)
    expect("data" in res).toBe(true)
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    const msg: any = send.mock.calls[0]![0]
    expect(msg.to).toBe("moderators@libraries.global")
    expect(msg.text).toContain(`/contribute/moderation/${appId}`)
  })

  it("stays quiet when an ordinary submission goes back to pending", async () => {
    const id = "s0000000000000000000078"
    const { svc, send } = setup({ seed: [waiting("correction", id)] })
    await svc.updateStatus(id, "pending", REVIEWER)
    await flush()
    expect(send).not.toHaveBeenCalled()
  })
})

describe("off the request path", () => {
  it("sends after updateStatus has returned, on a later tick, by default", async () => {
    setNotificationScheduler()
    const { svc, send } = setup()
    await svc.updateStatus(CORRECTION_ID, "approved", REVIEWER)
    expect(send).not.toHaveBeenCalled()
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("never lets a slow provider hold up the response", async () => {
    setNotificationScheduler()
    const { svc } = setup({ send: () => new Promise<void>(() => {}) })
    const res = await svc.updateStatus(CORRECTION_ID, "approved", REVIEWER)
    expect("data" in res).toBe(true)
  })
})

describe("email configuration", () => {
  it("is configured with Mailgun or Mailtrap credentials, as prepareEmailConfig reads them", () => {
    expect(
      emailConfigured({ SMTP_HOST: "smtp.example.org", SMTP_USER: "u" })
    ).toBe(false)
    expect(
      emailConfigured({
        SMTP_HOST: "smtp.example.org",
        SMTP_USER: "u",
        SMTP_PASS: "p",
      })
    ).toBe(true)
    expect(emailConfigured({})).toBe(false)
    expect(emailConfigured({ MAILGUN_API_KEY: "k" })).toBe(false)
    expect(emailConfigured({ MAILGUN_API_KEY: "k", MAILGUN_DOMAIN: "d" })).toBe(
      true
    )
    expect(emailConfigured({ MAILTRAP_USER: "u" })).toBe(false)
    expect(emailConfigured({ MAILTRAP_USER: "u", MAILTRAP_PASS: "p" })).toBe(
      true
    )
  })

  it("sends with Mailtrap credentials even though the plugin says sendmail", async () => {
    const { svc, send } = setup({ configured: false })
    process.env.MAILTRAP_USER = "u"
    process.env.MAILTRAP_PASS = "p"
    await svc.updateStatus(CORRECTION_ID, "approved", REVIEWER)
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe("email templates", () => {
  it("quotes the moderator's note in a decision", () => {
    const e = decidedEmail({
      name: "Ada",
      type: "correction",
      status: "rejected",
      note: "No source <b>given</b>.",
      url: "https://x/contribute/submissions",
    })
    expect(e.subject).toMatch(/not accepted/i)
    expect(e.text).toContain("> No source <b>given</b>.")
    expect(e.html).toContain("No source &lt;b&gt;given&lt;/b&gt;.")
    expect(e.html).not.toContain("<b>given")
  })

  it("names the role and languages in an application decision", () => {
    const all = applicationDecidedEmail({
      name: null,
      role: "wiki_editor",
      locales: [],
      status: "approved",
      note: null,
      url: "https://x",
    })
    expect(all.text).toContain("Knowledge editor")
    expect(all.text).toContain("all languages")
    expect(all.text).not.toContain("Their note")
  })

  it("names a Moderator application's queue and the editorial board", () => {
    const e = applicationDecidedEmail({
      name: "Ada",
      role: "moderator",
      queue: "index",
      locales: ["fr"],
      status: "approved",
      note: null,
      url: "https://x",
    })
    expect(e.subject).toBe("You are now a Moderator of the Index queue")
    expect(e.text).toContain(
      "The editorial board approved your application. You are now a Moderator of the Index queue for fr."
    )
  })

  it("links the moderator alert", () => {
    const e = moderatorAlertEmail({
      type: "role_application",
      summary: "Ada applied to be a Knowledge editor.",
      url: "https://x/contribute/moderation/abc",
    })
    expect(e.text).toContain("https://x/contribute/moderation/abc")
    expect(e.html).toContain('href="https://x/contribute/moderation/abc"')
  })
})

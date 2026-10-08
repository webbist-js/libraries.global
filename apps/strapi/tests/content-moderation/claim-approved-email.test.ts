import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createNotifications from "../../src/plugins/content-moderation/server/services/notifications"
import { makeFakeStrapi } from "../helpers/fake-strapi"

/**
 * An approved Library Claim opens the Staff area, so its email always
 * goes, with the library's Staff area link, whatever
 * `notifPrefs.editsReviewed` says. Other decisions still respect it.
 */

const PROFILE = "api::user-profile.user-profile"
const LIBRARY = "api::library.library"
const LIB = "library000000000000000001"
const SLUG = "central"
const ENV = { ...process.env }

function setup(notifPrefs?: Record<string, unknown>) {
  const f = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "p0000000000000000000001",
        baUserId: "u1",
        notifPrefs: notifPrefs ?? { editsReviewed: false },
      },
    ],
    [LIBRARY]: [
      {
        documentId: LIB,
        name: "Central",
        slug: "central",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })
  const send = vi.fn(async () => {})
  f.strapi.config = {
    get: (key: string) =>
      key === "plugin::email.provider" ? "sendmail" : undefined,
  }
  f.services["email.email"] = { send }

  return {
    ...f,
    send,
    notifications: createNotifications({ strapi: f.strapi }),
  }
}

const claim = (over: Record<string, unknown> = {}) => ({
  documentId: "s0000000000000000000001",
  submissionType: "library_claim",
  submittedByUserId: "u1",
  submittedByEmail: "u1@example.org",
  submittedByName: "Ada",
  targetDocumentId: LIB,
  targetSlug: "central",
  fields: { libraryName: "Central", role: "Librarian" },
  reviewNote: "Welcome aboard",
  ...over,
})

beforeEach(() => {
  process.env.APP_PUBLIC_URL = "https://app.example.org/"
  process.env.MAILGUN_API_KEY = "key"
  process.env.MAILGUN_DOMAIN = "mg.example.org"
  delete process.env.MAILTRAP_USER
  delete process.env.MAILTRAP_PASS
})
afterEach(() => {
  process.env = { ...ENV }
})

describe("the approved-claim email", () => {
  it("is sent although the claimant turned review emails off, linking their library's Staff area", async () => {
    const { notifications, send } = setup({ editsReviewed: false })
    await notifications.submissionDecided(claim(), "approved")

    expect(send).toHaveBeenCalledTimes(1)
    const msg = send.mock.calls[0]![0] as any
    expect(msg.to).toBe("u1@example.org")
    expect(msg.subject).toBe("You're now staff of Central")
    expect(msg.text).toContain(`https://app.example.org/staff/${SLUG}`)
    expect(msg.text).not.toContain(LIB)
    expect(msg.text).toContain("Welcome aboard")
    expect(msg.text).toContain("isn't covered by the review-email setting")
  })

  it("finds the library by slug when the claim carries no target id, else links the Staff area index", async () => {
    const { notifications, send } = setup()
    await notifications.submissionDecided(
      claim({ targetDocumentId: null, targetSlug: "central" }),
      "approved"
    )
    expect((send.mock.calls[0]![0] as any).text).toContain(`/staff/${SLUG}`)

    await notifications.submissionDecided(
      claim({
        documentId: "s0000000000000000000002",
        targetDocumentId: null,
        targetSlug: "missing",
        fields: {},
      }),
      "approved"
    )
    const fallback = send.mock.calls[1]![0] as any
    expect(fallback.subject).toBe("You're now staff of your library")
    expect(fallback.text).toContain("https://app.example.org/staff")
    expect(fallback.text).not.toContain(`/staff/${SLUG}`)
  })

  it("a rejected claim, and any correction, still respect editsReviewed: false", async () => {
    const { notifications, send, strapi } = setup({ editsReviewed: false })
    await notifications.submissionDecided(claim(), "rejected")
    await notifications.submissionDecided(
      claim({ submissionType: "correction", fields: { a: 1 } }),
      "approved"
    )

    expect(send).not.toHaveBeenCalled()
    expect(strapi.log.info).toHaveBeenCalledWith(
      expect.stringContaining("submitter turned off review emails")
    )
  })

  it("is logged and skipped, never thrown, without a provider", async () => {
    delete process.env.MAILGUN_API_KEY
    delete process.env.MAILGUN_DOMAIN
    const { notifications, send, strapi } = setup()
    await expect(
      notifications.submissionDecided(claim(), "approved")
    ).resolves.toBeUndefined()

    expect(send).not.toHaveBeenCalled()
    expect(strapi.log.info).toHaveBeenCalledWith(
      expect.stringContaining("no email provider configured")
    )
  })
})

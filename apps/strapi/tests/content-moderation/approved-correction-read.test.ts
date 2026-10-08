import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createModerationController from "../../src/plugins/content-moderation/server/controllers/moderation"
import createModerationService from "../../src/plugins/content-moderation/server/services/moderation"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { AFFILIATION_UID } from "../../src/utils/staff"
import { makeFakeStrapi } from "../helpers/fake-strapi"

/**
 * The live-pass report: after approving a record correction on a library
 * that has staff, the review page 404'd. Strapi's side of that round trip
 * — `PUT …/status`, then the page's `GET …/submissions/:documentId` as the
 * same Moderator — is exercised here end to end through the real apply.
 */

const SUB = "plugin::content-moderation.submission"
const EVENT = "plugin::content-moderation.review-event"
const LIBRARY = "api::library.library"
const ROLE_GRANT = "api::role-grant.role-grant"
const SECRET = "test-bridge-secret"
const LIB = "library000000000000000001"
const SUB_ID = "s0000000000000000000001"
const INDEX_MOD = "modindex"
const EN_ALL = "modenall"
const KNOWLEDGE_MOD = "modknowledge"
const STAFFER = "staffer"

const grant = (
  baUserId: string,
  queue: string,
  scopeLocale: string | null
) => ({
  documentId: `rg${baUserId}${queue}`.padEnd(24, "0"),
  baUserId,
  role: "moderator",
  queue,
  scopeLocale,
})

/** A pending record correction, its payloadHash pinned as finalize would. */
const correction = (over: Record<string, unknown> = {}) => {
  const s: any = {
    documentId: SUB_ID,
    id: 1,
    submissionType: "correction",
    status: "pending",
    contentLocale: "en",
    submittedByUserId: "u1",
    submittedByEmail: "u1@example.org",
    submittedByName: "Una",
    targetEntityType: "library",
    targetDocumentId: LIB,
    targetSlug: "central",
    fields: {
      kind: "record",
      summary: "A new summary",
      previous: { summary: "The old summary" },
    },
    draftData: null,
    note: null,
    editSummary: "Updated the summary",
    createdAt: "2026-09-20T10:00:00.000Z",
    ...over,
  }
  s.payloadHash = payloadHash(s)

  return s
}

function setup(rows = [correction()]) {
  const f = makeFakeStrapi({
    [SUB]: rows,
    [ROLE_GRANT]: [
      grant(INDEX_MOD, "index", null),
      grant(EN_ALL, "all", "en"),
      grant(KNOWLEDGE_MOD, "knowledge", null),
    ],
    [LIBRARY]: [
      {
        id: 1,
        documentId: LIB,
        name: "Central",
        slug: "central",
        locale: "en",
        libraryType: "Public",
        summary: "The old summary",
        hasStaff: true,
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    [AFFILIATION_UID]: [
      {
        documentId: "affiliation0000000000001",
        baUserId: STAFFER,
        library: { documentId: LIB },
        role: "Librarian",
        staffRole: "owner",
        approvedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  })
  // The fake hands out fresh mocks per documents() call; memoise per uid so
  // the apply's reads and writes see one table.
  const fresh = f.strapi.documents
  const perUid = new Map<string, any>()
  f.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })
  f.services["i18n.locales"] = {
    find: async () => [{ code: "en", isDefault: true }, { code: "fr" }],
  }
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }
  f.services["content-moderation.submission-policy"] = createPolicy({
    strapi: f.strapi,
  })
  f.services["content-moderation.submission"] = createService({
    strapi: f.strapi,
  })
  f.services["content-moderation.moderation"] = createModerationService({
    strapi: f.strapi,
  })
  const controller: any = createModerationController({ strapi: f.strapi })

  return { ...f, controller }
}

function ctxFor({
  viewer,
  params = {},
  body,
}: {
  viewer: string
  params?: Record<string, unknown>
  body?: unknown
}) {
  const ctx: any = {
    params,
    query: {},
    request: {
      headers: {
        "x-service-secret": SECRET,
        "x-ba-user-id": viewer,
        "x-ba-user-email": `${viewer}@example.org`,
        "x-ba-user-name": `Name ${viewer}`,
      },
      body,
    },
    status: 200,
    body: undefined,
    set: vi.fn(),
  }

  return ctx
}

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = SECRET
})
afterEach(() => {
  delete process.env.STRAPI_BRIDGE_SECRET
})

describe("a Moderator reads a correction they have just approved", () => {
  it("approves a record correction on a library with staff, applies it, and the detail read answers 200", async () => {
    const { controller, store } = setup()
    const put = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: SUB_ID },
      body: { status: "approved", note: "Looks right" },
    })
    await controller.updateStatus(put)

    expect(put.status).toBe(200)
    expect(put.body.data).toMatchObject({
      documentId: SUB_ID,
      status: "approved",
      submissionType: "correction",
    })
    // The apply went through: the record carries the new value, published.
    expect(store[LIBRARY]![0]).toMatchObject({ summary: "A new summary" })
    expect(store[LIBRARY]![0]!.__published).toMatchObject({
      summary: "A new summary",
    })
    expect(store[EVENT]).toHaveLength(1)

    // What the review page fetches on `router.refresh()`.
    const get = ctxFor({ viewer: INDEX_MOD, params: { documentId: SUB_ID } })
    await controller.findOne(get)
    expect(get.status).toBe(200)
    expect(get.body.data).toMatchObject({
      documentId: SUB_ID,
      status: "approved",
      submissionType: "correction",
      queue: "index",
      locale: "en",
      targetDocumentId: LIB,
      reviewNote: "Looks right",
      canPublish: false,
    })
    // A decided correction is no longer "for staff to review".
    expect(get.body.data.staffReviewHint).toBeUndefined()
    expect(get.body.data.review).toBeNull()

    const events = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: SUB_ID },
    })
    await controller.events(events)
    expect(events.status).toBe(200)
    expect(events.body.data).toEqual([
      expect.objectContaining({ fromStatus: "pending", toStatus: "approved" }),
    ])
  })

  it("a locale-scoped Moderator (all queues, en) reads it after approval too", async () => {
    const { controller } = setup()
    const put = ctxFor({
      viewer: EN_ALL,
      params: { documentId: SUB_ID },
      body: { status: "approved" },
    })
    await controller.updateStatus(put)
    expect(put.status).toBe(200)

    const get = ctxFor({ viewer: EN_ALL, params: { documentId: SUB_ID } })
    await controller.findOne(get)
    expect(get.status).toBe(200)
    expect(get.body.data.status).toBe("approved")

    // Out of scope stays 404 before and after, so scope can't be probed.
    const other = ctxFor({
      viewer: KNOWLEDGE_MOD,
      params: { documentId: SUB_ID },
    })
    await controller.findOne(other)
    expect(other.status).toBe(404)
  })

  it("library staff without a Moderation Scope never read it through the moderation API (403 at the door)", async () => {
    const { controller } = setup()
    const get = ctxFor({ viewer: STAFFER, params: { documentId: SUB_ID } })
    await controller.findOne(get)
    expect(get.status).toBe(403)
  })

  it('"Approve and publish" is not a correction\'s decision: publish: true is refused with 400, nothing written', async () => {
    const { controller, store } = setup()
    const put = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: SUB_ID },
      body: { status: "approved", publish: true },
    })
    await controller.updateStatus(put)

    expect(put.status).toBe(400)
    expect(put.body.error.message).toMatch(/can't be published on approval/)
    expect(store[SUB]![0]!.status).toBe("pending")
    expect(store[LIBRARY]![0]!.summary).toBe("The old summary")
    expect(store[EVENT] ?? []).toHaveLength(0)

    // The plain approve then still works, and the read after it.
    const approve = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: SUB_ID },
      body: { status: "approved" },
    })
    await controller.updateStatus(approve)
    expect(approve.status).toBe(200)
    const get = ctxFor({ viewer: INDEX_MOD, params: { documentId: SUB_ID } })
    await controller.findOne(get)
    expect(get.status).toBe(200)
  })
})

import { describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import createSubmissionService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { makeFakeStrapi } from "../helpers/fake-strapi"

process.env.STRAPI_BRIDGE_SECRET = "test-secret"

const SUB = "plugin::content-moderation.submission"
const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const WIKI = "api::wiki-article.wiki-article"

const serviceHeaders = {
  "x-service-secret": "test-secret",
  "x-ba-user-id": "u1",
  "x-ba-user-email": "u1@example.com",
}

function makeControllerHarness(seed: Record<string, any[]>) {
  const { strapi, store, services } = makeFakeStrapi(seed)
  services["content-moderation.submission"] = createSubmissionService({
    strapi,
  })
  services["content-moderation.submission-policy"] = createPolicy({ strapi })

  return { strapi, store, controller: submissionControllerFactory({ strapi }) }
}

describe("controller wiring: policy re-check closes the direct-edit race", () => {
  it("(i) a reader finalizing a draft wiki_edit with an array body gets 403, and the draft stays draft", async () => {
    const draftId = "d000000000000000000001"
    const { store, controller } = makeControllerHarness({
      [SUB]: [
        {
          documentId: draftId,
          status: "draft",
          submissionType: "wiki_edit",
          submittedByUserId: "u1",
          targetSlug: "a",
          draftData: { body: [{ __component: "content.rich-text", body: [] }] },
        },
      ],
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
        },
      ],
      [AFF]: [],
    })

    const ctx: any = {
      params: { id: draftId },
      request: { body: {}, headers: serviceHeaders },
      state: {},
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
      notFound: vi.fn(),
    }

    await controller.finalize(ctx)

    expect(ctx.status).toBe(403)
    expect(store[SUB][0].status).toBe("draft")
  })

  it("(ii) a reader's create with {submissionType:'wiki_edit', draftData:{title:'x'}} gets 403", async () => {
    const { controller } = makeControllerHarness({
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
        },
      ],
      [AFF]: [],
      [SUB]: [],
    })

    const ctx: any = {
      request: {
        body: {
          submissionType: "wiki_edit",
          draftData: { title: "x" },
        },
        headers: serviceHeaders,
      },
      state: {},
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
    }

    await controller.create(ctx)

    expect(ctx.status).toBe(403)
  })

  it("(iv) saveDraft's compare-and-set where includes status:'draft', and returns not_draft when updateMany reports count 0", async () => {
    const documentId = "s000000000000000000001"
    const { strapi } = makeFakeStrapi({
      [SUB]: [{ documentId, status: "draft", submittedByUserId: "u1" }],
    })
    // Simulate a race: another request flipped the row's status between the
    // ownership/status read above and this write.
    const updateMany = vi.fn(async () => ({ count: 0 }))
    strapi.db.query = vi.fn(() => ({ updateMany }))

    const result = await createSubmissionService({ strapi }).saveDraft(
      documentId,
      "u1",
      { title: "x" },
      1
    )

    expect(result).toEqual({ error: "not_draft" })
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "draft" }),
      })
    )
  })

  it("finalize on someone else's draft returns 404", async () => {
    const draftId = "d000000000000000000003"
    const { controller } = makeControllerHarness({
      [SUB]: [
        {
          documentId: draftId,
          status: "draft",
          submissionType: "correction",
          submittedByUserId: "someone-else",
          targetSlug: "a",
          fields: {},
        },
      ],
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
        },
      ],
      [AFF]: [],
    })

    const ctx: any = {
      params: { id: draftId },
      request: { body: {}, headers: serviceHeaders },
      state: {},
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
      notFound: vi.fn(),
    }

    await controller.finalize(ctx)

    expect(ctx.notFound).toHaveBeenCalled()
    expect(ctx.status).not.toBe(409)
  })

  it("finalize returns 409 when a concurrent write raced the compare-and-set", async () => {
    const draftId = "d000000000000000000004"
    const { strapi, store, controller } = makeControllerHarness({
      [SUB]: [
        {
          documentId: draftId,
          status: "draft",
          submissionType: "correction",
          submittedByUserId: "u1",
          targetSlug: "a",
          fields: {},
        },
      ],
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
        },
      ],
      [AFF]: [],
    })

    // Simulate a concurrent write landing between finalizeDraft's read and
    // its own compare-and-set write: the CAS always reports 0 rows matched,
    // while the row itself is left untouched — still "draft", still owned
    // by the same user. finalizeDraft can't tell that apart from a stale/
    // foreign draft on its own; the controller's post-hoc re-read is what
    // turns this into a retryable 409 instead of a 404.
    strapi.db.query = vi.fn(() => ({
      updateMany: vi.fn(async () => ({ count: 0 })),
    }))

    const ctx: any = {
      params: { id: draftId },
      request: { body: {}, headers: serviceHeaders },
      state: {},
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
      notFound: vi.fn(),
    }

    await controller.finalize(ctx)

    expect(ctx.status).toBe(409)
    expect(store[SUB][0].status).toBe("draft")
  })
})

describe("(iii) applyWikiEdit re-checks capabilities at apply time", () => {
  function wikiHarness(role: string) {
    const { strapi, store, services } = makeFakeStrapi({
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "a",
          title: "Original",
        },
      ],
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: role,
          tier: "Reader",
        },
      ],
      [AFF]: [],
    })
    services["content-moderation.submission-policy"] = createPolicy({ strapi })
    strapi.plugin = vi.fn((name: string) =>
      name === "i18n"
        ? { service: () => ({ find: async () => [{ code: "en" }] }) }
        : { service: (s: string) => services[`${name}.${s}`] }
    )

    return { strapi, store }
  }

  it("leaves the article unchanged for a reader's submission with a body", async () => {
    const { strapi, store } = wikiHarness("reader")
    const outcome = await createSubmissionService({ strapi }).applyWikiEdit({
      documentId: "s1",
      targetSlug: "a",
      submittedByUserId: "u1",
      draftData: {
        title: "Hijacked",
        locale: "en",
        body: [{ __component: "content.rich-text", body: [] }],
      },
    })
    expect(outcome).toBe("skipped_suggestion")
    expect(store[WIKI][0].title).toBe("Original")
  })

  it("applies the edit for a wiki_editor", async () => {
    const { strapi, store } = wikiHarness("wiki_editor")
    const outcome = await createSubmissionService({ strapi }).applyWikiEdit({
      documentId: "s2",
      targetSlug: "a",
      submittedByUserId: "u1",
      draftData: { title: "Updated", locale: "en" },
    })
    expect(outcome).toBe("applied")
    expect(store[WIKI][0].title).toBe("Updated")
  })
})

describe("updateStatus keeps the moderator's reviewNote when a wiki_edit is only a suggestion", () => {
  // Regression test for fix round 3: applyWikiEdit used to write the
  // "not auto-applied" marker onto the pre-CAS `submission` snapshot's
  // reviewNote, discarding whatever reviewNote updateStatus's own
  // compare-and-set had just written moments earlier. The fix moves that
  // write into updateStatus, built from the reviewNote argument it actually
  // received.
  it("appends the marker to the moderator's note instead of overwriting it", async () => {
    const documentId = "s000000000000000000099"
    const { strapi, store, services } = makeFakeStrapi({
      [SUB]: [
        {
          documentId,
          status: "pending",
          submissionType: "wiki_edit",
          submittedByUserId: "u1",
          targetSlug: "a",
          fields: {},
          draftData: {
            title: "New title",
            locale: "en",
            body: [{ __component: "content.rich-text", body: [] }],
          },
        },
      ],
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "a",
          title: "Original",
        },
      ],
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "reader",
          tier: "Reader",
        },
      ],
      [AFF]: [],
    })
    services["content-moderation.submission-policy"] = createPolicy({ strapi })
    services["rewards.points"] = { award: vi.fn(async () => {}) }
    services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }
    strapi.plugin = vi.fn((name: string) =>
      name === "i18n"
        ? { service: () => ({ find: async () => [{ code: "en" }] }) }
        : { service: (s: string) => services[`${name}.${s}`] }
    )

    // strapi.documents(uid) hands back a fresh object per call, so a spy
    // installed on one call's `.update` wouldn't see calls made through a
    // later call. Wrap the factory itself and record every `.update` call
    // made against the submission collection, while still delegating to
    // the real (store-backed) implementation.
    const submissionUpdateCalls: { documentId: string; data: any }[] = []
    const originalDocuments = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      const handle = originalDocuments(uid)
      if (uid === SUB) {
        const realUpdate = handle.update
        handle.update = vi.fn(async (args: any) => {
          submissionUpdateCalls.push(args)

          return realUpdate(args)
        })
      }

      return handle
    })

    const svc = createSubmissionService({ strapi })
    const result = await svc.updateStatus(
      documentId,
      "approved",
      "admin",
      "Looks good"
    )

    const expectedNote =
      "Looks good [Suggestion — not auto-applied; apply manually]"

    expect(submissionUpdateCalls).toHaveLength(1)
    expect(submissionUpdateCalls[0]).toMatchObject({
      documentId,
      data: { reviewNote: expectedNote },
    })
    expect("data" in result).toBe(true)
    expect((result as any).data.reviewNote).toBe(expectedNote)
    // The wiki article itself was never touched — it's a suggestion, not a
    // direct edit.
    expect(store[WIKI][0].title).toBe("Original")
  })
})

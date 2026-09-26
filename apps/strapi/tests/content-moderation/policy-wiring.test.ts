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

  it("(iv) saveDraft's compare-and-set returns not_draft when updateMany reports count 0", async () => {
    const documentId = "s000000000000000000001"
    const { strapi } = makeFakeStrapi({
      [SUB]: [{ documentId, status: "draft", submittedByUserId: "u1" }],
    })
    // Simulate a race: another request flipped the row's status between the
    // ownership/status read above and this write.
    strapi.db.query = vi.fn(() => ({
      updateMany: vi.fn(async () => ({ count: 0 })),
    }))

    const result = await createSubmissionService({ strapi }).saveDraft(
      documentId,
      "u1",
      { title: "x" },
      1
    )

    expect(result).toEqual({ error: "not_draft" })
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
    await createSubmissionService({ strapi }).applyWikiEdit({
      documentId: "s1",
      targetSlug: "a",
      submittedByUserId: "u1",
      draftData: {
        title: "Hijacked",
        locale: "en",
        body: [{ __component: "content.rich-text", body: [] }],
      },
    })
    expect(store[WIKI][0].title).toBe("Original")
  })

  it("applies the edit for a wiki_editor", async () => {
    const { strapi, store } = wikiHarness("wiki_editor")
    await createSubmissionService({ strapi }).applyWikiEdit({
      documentId: "s2",
      targetSlug: "a",
      submittedByUserId: "u1",
      draftData: { title: "Updated", locale: "en" },
    })
    expect(store[WIKI][0].title).toBe("Updated")
  })
})

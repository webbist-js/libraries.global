import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import {
  ApplyRefusedError,
  applyToPublished,
} from "../../src/plugins/content-moderation/server/utils/publish-guard"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { sanitizeWikiBody } from "../../src/plugins/content-moderation/server/utils/wiki-body"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const WIKI = "api::wiki-article.wiki-article"

describe("sanitizeWikiBody", () => {
  it("keeps allowed components, strips ids and clamps heading levels", () => {
    const out = sanitizeWikiBody([
      {
        __component: "content.rich-text",
        id: 9,
        body: [
          {
            type: "heading",
            level: 99,
            children: [{ type: "text", text: "x" }],
          },
        ],
      },
      { __component: "evil.script", html: "<script>" },
    ])
    expect(out).toEqual([
      {
        __component: "content.rich-text",
        body: [
          {
            type: "heading",
            level: 6,
            children: [{ type: "text", text: "x" }],
          },
        ],
      },
    ])
  })
  it("returns null for non-arrays", () => {
    expect(sanitizeWikiBody("x")).toBeNull()
  })
  it("drops block nodes nested deeper than 8 levels", () => {
    let node: Record<string, unknown> = { type: "text", text: "deep" }
    for (let i = 0; i < 10; i++) node = { type: "list-item", children: [node] }
    const out = sanitizeWikiBody([
      { __component: "content.rich-text", body: [node] },
    ])
    const depth = (n: any): number =>
      Array.isArray(n?.children) && n.children.length > 0
        ? 1 + Math.max(...n.children.map(depth))
        : 0
    const body = (out![0] as { body: unknown[] }).body
    expect(depth(body[0])).toBeLessThanOrEqual(8)
    expect(JSON.stringify(out)).not.toContain('"deep"')
  })
})

describe("applyWikiEdit", () => {
  it("targets submission.targetSlug, ignoring draftData.targetSlug", async () => {
    const { strapi, store } = makeFakeStrapi({
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "article-a",
          title: "A",
        },
        {
          documentId: "wa0000000000000000000002",
          id: 2,
          slug: "article-b",
          title: "B",
        },
      ],
      "api::user-profile.user-profile": [],
    })
    // Grants docs.directEdit so this test can focus on slug/locale handling;
    // the capability gate itself is covered in policy-wiring.test.ts.
    strapi.plugin = vi.fn((name: string) =>
      name === "i18n"
        ? { service: () => ({ find: async () => [{ code: "en" }] }) }
        : {
            service: () => ({
              loadCapabilities: async () => ({
                caps: {
                  set: new Set(["docs.directEdit"]),
                  claimedLibraryIds: new Set(),
                  editorLocales: { docs: "all", journal: new Set() },
                },
                tier: null,
              }),
            }),
          }
    )
    const outcome = await createService({ strapi }).applyWikiEdit({
      targetSlug: "article-a",
      draftData: { targetSlug: "article-b", title: "Hijacked", locale: "en" },
      submittedByUserId: "u1",
    })
    expect(outcome).toBe("published")
    expect(store[WIKI][0].title).toBe("Hijacked")
    expect(store[WIKI][1].title).toBe("B")
  })

  it("writes an unknown locale to the default locale", async () => {
    const { strapi, store } = makeFakeStrapi({
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "a",
          title: "A",
        },
      ],
    })
    strapi.plugin = vi.fn((name: string) =>
      name === "i18n"
        ? { service: () => ({ find: async () => [{ code: "en" }] }) }
        : {
            service: () => ({
              loadCapabilities: async () => ({
                caps: {
                  set: new Set(["docs.directEdit"]),
                  claimedLibraryIds: new Set(),
                  editorLocales: { docs: "all", journal: new Set() },
                },
                tier: null,
              }),
            }),
          }
    )
    const outcome = await createService({ strapi }).applyWikiEdit({
      targetSlug: "a",
      draftData: { title: "T", locale: "xx" },
      submittedByUserId: "u1",
    })
    expect(outcome).toBe("published")
    expect(store[WIKI][0].title).toBe("T")
  })
})

describe("applyToPublished (publish guard)", () => {
  const LIB = "api::library.library"
  const ID = "lib00000000000000000001"
  const perUid = (made: ReturnType<typeof makeFakeStrapi>) => {
    const cache = new Map<string, any>()
    const fresh = made.strapi.documents
    made.strapi.documents = vi.fn((uid: string) => {
      if (!cache.has(uid)) cache.set(uid, fresh(uid))

      return cache.get(uid)
    })

    return made
  }

  it("refuses when the target has no published version", async () => {
    const { strapi } = perUid(
      makeFakeStrapi({
        [LIB]: [
          { documentId: ID, locale: "en", name: "Old", publishedAt: null },
        ],
      })
    )
    await expect(
      applyToPublished(strapi, LIB, ID, { name: "New" }, { locale: "en" })
    ).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(strapi.documents(LIB).update).not.toHaveBeenCalled()
  })

  it("writes the draft only when the draft has unpublished changes elsewhere", async () => {
    const { strapi, store } = perUid(
      makeFakeStrapi({
        [LIB]: [
          {
            documentId: ID,
            locale: "en",
            name: "Old",
            city: "Draft city",
            __published: {
              documentId: ID,
              locale: "en",
              name: "Old",
              city: "Live city",
            },
          },
        ],
      })
    )
    const result = await applyToPublished(
      strapi,
      LIB,
      ID,
      { name: "New" },
      { locale: "en" }
    )
    expect(result).toEqual({ mode: "draft_only", divergentKeys: ["city"] })
    const call = strapi.documents(LIB).update.mock.calls[0]?.[0]
    expect(call.status).toBe("draft")
    expect(store[LIB][0].name).toBe("New")
    expect(store[LIB][0].__published.name).toBe("Old")
  })

  it("publishes when draft and published versions agree outside the change", async () => {
    const { strapi, store } = perUid(
      makeFakeStrapi({
        [LIB]: [
          {
            documentId: ID,
            locale: "en",
            name: "Old",
            city: "Same",
            __published: {
              documentId: ID,
              locale: "en",
              name: "Old",
              city: "Same",
            },
          },
        ],
      })
    )
    const result = await applyToPublished(
      strapi,
      LIB,
      ID,
      { name: "New" },
      { locale: "en" }
    )
    expect(result).toEqual({ mode: "published" })
    const call = strapi.documents(LIB).update.mock.calls[0]?.[0]
    expect(call).toMatchObject({ status: "published", locale: "en" })
    expect(store[LIB][0].__published.name).toBe("New")
  })
})

describe("approval against an unpublished or divergent library", () => {
  const LIB = "api::library.library"
  const SUB = "plugin::content-moderation.submission"
  const ID = "lib00000000000000000001"
  const edit = (over: Record<string, unknown> = {}) => {
    const s: Record<string, any> = {
      documentId: "s0000000000000000000030",
      submissionType: "library_edit",
      status: "pending",
      submittedByUserId: "u1",
      targetDocumentId: ID,
      fields: { name: "New" },
      draftData: null,
      reviewNote: null,
      ...over,
    }

    return s
  }
  const setup = (library: Record<string, unknown>, sub = edit()) => {
    const made = makeFakeStrapi({
      [SUB]: [sub],
      [LIB]: [{ documentId: ID, locale: "en", name: "Old", ...library }],
      "plugin::content-moderation.submission-upload": [],
    })
    const award = vi.fn(async () => {})
    made.services["rewards.points"] = { award }
    made.services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }

    return { ...made, award, svc: createService({ strapi: made.strapi }) }
  }

  it("refuses to apply to an unpublished library and returns the submission to review with a note", async () => {
    const { store, svc, award } = setup({ publishedAt: null })
    const result = await svc.updateStatus(
      "s0000000000000000000030",
      "approved",
      REVIEWER,
      "Looks right"
    )
    expect(result).toEqual({ error: "apply_refused", reason: "not_published" })
    expect(store[SUB][0].status).toBe("pending")
    expect(store[SUB][0].reviewNote).toMatch(/not published/i)
    expect(store[LIB][0].name).toBe("Old")
    expect(award).not.toHaveBeenCalled()
  })

  it("applies to the draft only and says so when the draft has admin edits", async () => {
    const { store, svc } = setup({
      city: "Draft city",
      __published: {
        documentId: ID,
        locale: "en",
        name: "Old",
        city: "Live city",
      },
    })
    const result = await svc.updateStatus(
      "s0000000000000000000030",
      "approved",
      REVIEWER,
      "Fine"
    )
    expect("data" in result).toBe(true)
    expect(store[SUB][0].status).toBe("approved")
    expect(store[SUB][0].reviewNote).toMatch(/unpublished admin edits/)
    expect(store[LIB][0].name).toBe("New")
    expect(store[LIB][0].__published.name).toBe("Old")
  })
})

describe("new_library approval", () => {
  const LIB = "api::library.library"
  const SUB = "plugin::content-moderation.submission"
  const SVC = "svc00000000000000000001"

  it("keeps only http(s) links and known relation ids", async () => {
    const sub = {
      documentId: "s0000000000000000000020",
      submissionType: "new_library",
      status: "pending",
      submittedByUserId: "u1",
      fields: {
        name: "Lib",
        // eslint-disable-next-line sonarjs/code-eval -- the unsafe scheme is the fixture
        website: "javascript:alert(1)",
        catalogueUrl: "https://catalogue.example.org",
        socialLinks: [
          // eslint-disable-next-line sonarjs/code-eval -- the unsafe scheme is the fixture
          { platform: "x", url: "javascript:alert(1)" },
          { platform: "facebook", url: "https://facebook.com/lib" },
          { platform: "instagram", url: "" },
        ],
        services: [SVC, "not-an-id", 42],
        amenities: ["also-bad"],
        continentDocumentId: "<script>",
        countryDocumentId: "cty00000000000000000001",
      },
      draftData: null,
    }
    const { strapi, store, services } = makeFakeStrapi({
      [SUB]: [sub],
      [LIB]: [],
      "api::library-affiliation.library-affiliation": [],
    })
    services["rewards.points"] = { award: vi.fn(async () => {}) }
    services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }

    const result = await createService({ strapi }).updateStatus(
      sub.documentId,
      "approved",
      REVIEWER
    )

    expect(result).not.toHaveProperty("error")
    expect(store[LIB]).toHaveLength(1)
    const lib = store[LIB][0]
    expect(lib.website).toBeUndefined()
    expect(lib.catalogueUrl).toBe("https://catalogue.example.org")
    expect(lib.socialLinks).toEqual([
      { platform: "facebook", url: "https://facebook.com/lib" },
    ])
    expect(lib.services).toEqual({ connect: [{ documentId: SVC }] })
    expect(lib.amenities).toBeUndefined()
    expect(lib.continent).toBeUndefined()
    expect(lib.country).toEqual({
      connect: [{ documentId: "cty00000000000000000001" }],
    })
  })
})

describe("ownedUploadIds", () => {
  it("returns only ids with matching submission-upload rows", async () => {
    const { strapi } = makeFakeStrapi({
      "plugin::content-moderation.submission-upload": [
        { fileId: 1, baUserId: "u1" },
        { fileId: 2, baUserId: "u2" },
      ],
    })
    const result = await createService({ strapi }).ownedUploadIds(
      "u1",
      [1, 2, 3]
    )
    expect(result).toEqual(new Set([1]))
  })
})

describe("recordUpload", () => {
  it("creates a submission-upload row with fileId and baUserId", async () => {
    const { strapi, store } = makeFakeStrapi({
      "plugin::content-moderation.submission-upload": [],
    })
    await createService({ strapi }).recordUpload(5, "u1")
    expect(store["plugin::content-moderation.submission-upload"]).toHaveLength(
      1
    )
    expect(
      store["plugin::content-moderation.submission-upload"][0]
    ).toMatchObject({
      fileId: 5,
      baUserId: "u1",
    })
  })

  it("is a no-op when the same uploader records the same file again", async () => {
    const { strapi, store } = makeFakeStrapi({
      "plugin::content-moderation.submission-upload": [],
    })
    const svc = createService({ strapi })
    await svc.recordUpload(5, "u1")
    await svc.recordUpload(5, "u1")
    expect(store["plugin::content-moderation.submission-upload"]).toHaveLength(
      1
    )
  })
})

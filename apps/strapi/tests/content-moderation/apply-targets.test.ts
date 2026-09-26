import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { sanitizeWikiBody } from "../../src/plugins/content-moderation/server/utils/wiki-body"
import { makeFakeStrapi } from "../helpers/fake-strapi"

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
    expect(outcome).toBe("applied")
    expect(store[WIKI][0].title).toBe("Hijacked")
    expect(store[WIKI][1].title).toBe("B")
  })

  it("refuses unknown locales", async () => {
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
    expect(outcome).toBe("noop")
    expect(store[WIKI][0].title).toBe("A")
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

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
    strapi.plugin = vi.fn(() => ({
      service: () => ({ find: async () => [{ code: "en" }] }),
    }))
    await createService({ strapi }).applyWikiEdit({
      targetSlug: "article-a",
      draftData: { targetSlug: "article-b", title: "Hijacked", locale: "en" },
      submittedByUserId: "u1",
    })
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
    strapi.plugin = vi.fn(() => ({
      service: () => ({ find: async () => [{ code: "en" }] }),
    }))
    await createService({ strapi }).applyWikiEdit({
      targetSlug: "a",
      draftData: { title: "T", locale: "xx" },
    })
    expect(store[WIKI][0].title).toBe("A")
  })
})

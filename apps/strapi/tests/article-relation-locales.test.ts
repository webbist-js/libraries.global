import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { applyToPublished } from "../src/plugins/content-moderation/server/utils/publish-guard"
import {
  articleRelationConnector,
  articleRelationRows,
  captureArticleEventLibraries,
  frozenArticleGeography,
  preservePublishedArticleRelations,
} from "../src/utils/article-relations"

const BLOG = "api::blog-article.blog-article"
const LIBRARY = "api::library.library"
const DOCUMENT_ID = "library000000000000000001"
const publishedAt = "2026-10-16T12:00:00.000Z"
const target = (
  id: number,
  locale: string,
  extra: Record<string, unknown> = {}
) => ({ id, documentId: DOCUMENT_ID, locale, publishedAt, ...extra })

describe("article relation language resolution", () => {
  it("prefers a public target translation and falls back without selecting an unpublished translation", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [target(1, "en"), target(2, "es", { publishedAt: null })],
    })
    const filters = { documentId: { $eq: DOCUMENT_ID } }
    expect(
      await articleRelationRows(strapi, LIBRARY, filters, "es")
    ).toMatchObject([{ id: 1, locale: "en" }])
    expect(articleRelationConnector(target(1, "en"), "es")).toEqual({
      id: 1,
      locale: "en",
    })
    const translated = makeFakeStrapi({
      [LIBRARY]: [target(1, "en"), target(3, "es")],
    })
    const [row] = await articleRelationRows(
      translated.strapi,
      LIBRARY,
      filters,
      "es"
    )
    expect(articleRelationConnector(row, "es")).toEqual({
      documentId: DOCUMENT_ID,
      locale: "es",
    })
  })

  it("refuses arbitrary target content types and an unresolved cross-language entity", async () => {
    const { strapi } = makeFakeStrapi()
    await expect(
      articleRelationRows(strapi, "api::user-profile.user-profile", {}, "es")
    ).rejects.toThrow("Invalid article relation type")
    expect(() =>
      articleRelationConnector({ documentId: DOCUMENT_ID, locale: "en" }, "es")
    ).toThrow("no resolved public entity")
  })

  it("keeps frozen geography when a resolved entity connector denotes the same document", async () => {
    const { strapi } = makeFakeStrapi({ [LIBRARY]: [target(1, "en")] })
    const geographyFacet = {
      continents: [],
      countries: [
        { documentId: "country000000000000000001", name: "Colombia" },
      ],
      regions: [],
      areas: [],
    }
    expect(
      await frozenArticleGeography(
        strapi,
        { libraries: { set: [{ id: 1, locale: "en" }] } },
        { geographyFacet, libraries: [{ documentId: DOCUMENT_ID }] }
      )
    ).toBe(geographyFacet)
  })

  it("repairs only currently public target variants and the corresponding Event component", async () => {
    const articleId = "article000000000000000001"
    const library = target(1, "en")
    const hiddenLibrary = {
      id: 4,
      documentId: "library000000000000000002",
      locale: "en",
      publishedAt: null,
    }
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [
        library,
        target(2, "en", { publishedAt: null }),
        hiddenLibrary,
      ],
      [BLOG]: [
        {
          id: 10,
          documentId: articleId,
          locale: "es",
          publishedAt: null,
          libraries: [library, hiddenLibrary],
          eventMentions: [{ id: 20, citationId: "citation", library }],
        },
        {
          id: 11,
          documentId: articleId,
          locale: "es",
          publishedAt,
          libraries: [],
          eventMentions: [{ id: 21, citationId: "citation", library: null }],
        },
      ],
      "content.event-mention": [
        { id: 21, documentId: "component", library: null },
      ],
    })
    await preservePublishedArticleRelations(strapi, BLOG, articleId, "es")
    expect(store[BLOG][1].libraries).toEqual({ set: [{ id: 1 }] })
    expect(store[BLOG][0].libraries).toEqual([library, hiddenLibrary])
    expect(store["content.event-mention"][0].library).toEqual({
      set: [{ id: 1 }],
    })
  })

  it("captures a citation Library before core clears the component and repairs both component copies", async () => {
    const library = target(1, "en")
    const articleId = "article000000000000000001"
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [library],
      [BLOG]: [
        {
          id: 10,
          documentId: articleId,
          locale: "es",
          publishedAt: null,
          eventMentions: [{ id: 20, citationId: "citation", library: null }],
        },
        {
          id: 11,
          documentId: articleId,
          locale: "es",
          publishedAt,
          eventMentions: [{ id: 21, citationId: "citation", library: null }],
        },
      ],
      "content.event-mention": [
        { id: 20, documentId: "draft-component", library: null },
        { id: 21, documentId: "published-component", library: null },
      ],
    })
    const captured = await captureArticleEventLibraries(strapi, BLOG, {
      locale: "es",
      data: {
        eventMentions: [
          {
            citationId: "citation",
            library: { connect: [{ id: library.id, locale: "en" }] },
          },
        ],
      },
    })
    expect(captured).toMatchObject([
      {
        citationId: "citation",
        library: { documentId: DOCUMENT_ID, locale: "en" },
      },
    ])
    expect(
      await preservePublishedArticleRelations(
        strapi,
        BLOG,
        articleId,
        "es",
        captured
      )
    ).toEqual([11])
    expect(store["content.event-mention"].map((row) => row.library)).toEqual([
      { set: [{ id: 1 }] },
      { set: [{ id: 1 }] },
    ])
  })
})

describe("complete review snapshots with published fallback relations", () => {
  it.each(["same", "changed relation", "changed body"])(
    "handles %s without hiding stored identities or weakening body comparison",
    async (difference) => {
      const documentId = "article000000000000000001"
      const library = { documentId: DOCUMENT_ID }
      const changedLibrary = { documentId: "library000000000000000002" }
      const eventMentions = [
        { citationId: "citation", title: "Workshop", library },
      ]
      const body = (text: string) => [
        {
          __component: "content.rich-text",
          body: [{ type: "paragraph", children: [{ type: "text", text }] }],
        },
      ]
      const { strapi } = makeFakeStrapi({
        [BLOG]: [
          {
            id: 10,
            documentId,
            locale: "es",
            publishedAt: null,
            libraries: [
              difference === "changed relation" ? changedLibrary : library,
            ],
            eventMentions,
          },
          {
            id: 11,
            documentId,
            locale: "es",
            publishedAt,
            libraries: [library],
            eventMentions,
          },
        ],
      })
      const update = vi.fn(async () => ({}))
      strapi.documents = vi.fn(() => ({
        findOne: async ({ status }: { status: string }) => ({
          documentId,
          title: "Story",
          body: body(
            difference === "changed body" && status === "draft"
              ? "Unreviewed admin body"
              : "Published body"
          ),
          // The source publication status filters these fallback relation projections.
          libraries: status === "draft" ? [] : [library],
          eventMentions:
            status === "draft"
              ? [{ ...eventMentions[0], library: null }]
              : eventMentions,
        }),
        update,
      }))
      const result = await applyToPublished(
        strapi,
        BLOG,
        documentId,
        { title: "Reviewed title" },
        { locale: "es" }
      )
      expect(result.mode).toBe(
        difference === "same" ? "published" : "draft_only"
      )
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: difference === "same" ? "published" : "draft",
        })
      )
      if (difference !== "same")
        expect(result).toMatchObject({
          divergentKeys: [
            difference === "changed relation" ? "libraries" : "body",
          ],
        })
    }
  )
})

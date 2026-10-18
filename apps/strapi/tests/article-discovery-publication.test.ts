import { beforeEach, describe, expect, it, vi } from "vitest"

import { registerArticleDiscoveryMiddleware } from "../src/documentMiddlewares/article-discovery"
import { queueArticleProjection } from "../src/lifeCycles/articlePrivacy"
import {
  frozenArticleGeography,
  preservePublishedArticleRelations,
} from "../src/utils/article-relations"

vi.mock("../src/lifeCycles/articlePrivacy", () => ({
  queueArticleProjection: vi.fn(async () => {}),
}))
vi.mock("../src/utils/article-relations", () => ({
  buildArticleGeography: vi.fn(async () => ({})),
  frozenArticleGeography: vi.fn(async () => ({})),
  preservePublishedArticleRelations: vi.fn(async () => []),
  captureArticleEventLibraries: vi.fn(async () => []),
}))

const BLOG = "api::blog-article.blog-article"
const WIKI = "api::wiki-article.wiki-article"
const documentId = "article000000000000000001"
const publishedAt = "2026-10-16T12:00:00.000Z"
const draft = {
  id: 1,
  documentId,
  publishedAt: null,
  locale: "en",
  readingTimeMinutes: 1,
  geographyFacet: {},
}
const published = { ...draft, id: 2, publishedAt }

function harness(rows = [draft, published]) {
  let middleware!: (context: any, next: () => Promise<any>) => Promise<any>
  let insideTransaction = false
  const documents = Object.assign(
    vi.fn(() => ({
      findOne: vi.fn(async () => draft),
    })),
    {
      use: (callback: typeof middleware) => {
        middleware = callback
      },
    }
  )
  const findMany = vi.fn(async ({ where }: any) =>
    rows.filter(
      (row) => row.documentId === where.documentId && row.publishedAt != null
    )
  )
  const update = vi.fn(async () => ({}))
  const strapi: any = {
    documents,
    db: {
      transaction: async (run: () => Promise<any>) => {
        insideTransaction = true
        try {
          return await run()
        } finally {
          insideTransaction = false
        }
      },
      query: () => ({ findMany, findOne: async () => published, update }),
    },
  }
  registerArticleDiscoveryMiddleware({ strapi })

  return {
    strapi,
    findMany,
    update,
    run: (context: any, next: () => Promise<any>) => middleware(context, next),
    inside: () => insideTransaction,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(queueArticleProjection).mockImplementation(async () => {})
  vi.mocked(preservePublishedArticleRelations).mockResolvedValue([])
})

describe("article publication discovery refresh", () => {
  it.each([BLOG, WIKI])(
    "refreshes ordinary create/update/publish in %s without cross-language repairs",
    async (uid) => {
      for (const action of ["create", "update", "publish"]) {
        vi.mocked(queueArticleProjection).mockClear()
        const h = harness()
        const result =
          action === "publish"
            ? { documentId, entries: [published] }
            : published
        vi.mocked(queueArticleProjection).mockImplementation(async () => {
          expect(h.inside()).toBe(true)
        })
        expect(
          await h.run(
            {
              uid,
              action,
              params: {
                documentId,
                ...(action !== "publish" ? { status: "published" } : {}),
                data: { title: "Approved story" },
              },
            },
            async () => result
          )
        ).toBe(result)
        expect(preservePublishedArticleRelations).toHaveBeenCalled()
        expect(queueArticleProjection).toHaveBeenCalledExactlyOnceWith(
          h.strapi,
          [{ uid, id: published.id }]
        )
        expect(h.findMany).toHaveBeenCalledWith({
          where: { documentId, publishedAt: { $notNull: true } },
          select: ["id"],
        })
      }
    }
  )
  it.each(["create", "update"])(
    "does not project a %s draft when the document already has a publication",
    async (action) => {
      const h = harness()
      await h.run(
        {
          uid: BLOG,
          action,
          params: {
            documentId,
            status: "draft",
            data: { title: "Unreviewed draft" },
          },
        },
        async () => draft
      )
      expect(queueArticleProjection).not.toHaveBeenCalled()
      expect(preservePublishedArticleRelations).not.toHaveBeenCalled()
      expect(h.findMany).not.toHaveBeenCalled()
    }
  )
  it("deduplicates repaired rows and includes current published language variants", async () => {
    const es = { ...published, id: 3, locale: "es" }
    const h = harness([draft, published, es])
    vi.mocked(preservePublishedArticleRelations).mockResolvedValueOnce([
      2, 2, 3,
    ])
    await h.run(
      { uid: BLOG, action: "publish", params: { documentId, locale: "*" } },
      async () => ({ documentId, entries: [published, es] })
    )
    expect(queueArticleProjection).toHaveBeenCalledExactlyOnceWith(h.strapi, [
      { uid: BLOG, id: 2 },
      { uid: BLOG, id: 3 },
    ])
  })
  it("enqueues after final geography updates within the publication transaction", async () => {
    const h = harness()
    const order: string[] = []
    h.update.mockImplementation(async () => {
      order.push("geography")

      return {}
    })
    vi.mocked(frozenArticleGeography).mockResolvedValueOnce({
      continents: [],
      countries: [],
      regions: [],
      areas: [],
    })
    vi.mocked(queueArticleProjection).mockImplementation(async () => {
      order.push("queue")
      expect(h.inside()).toBe(true)
    })
    await h.run(
      {
        uid: BLOG,
        action: "update",
        params: { documentId, status: "published", data: { countries: [] } },
      },
      async () => published
    )
    expect(order).toEqual(["geography", "queue"])
  })
  it("does not enqueue a failed publication or a missing update result", async () => {
    const h = harness()
    const context = {
      uid: BLOG,
      action: "update",
      params: { documentId, status: "published" },
    }
    await expect(
      h.run(context, async () => {
        throw new Error("Publication failed")
      })
    ).rejects.toThrow("Publication failed")
    await h.run(context, async () => null)
    expect(queueArticleProjection).not.toHaveBeenCalled()
  })
  it("ignores unrelated content types", async () => {
    const h = harness()
    await h.run(
      {
        uid: "api::library.library",
        action: "publish",
        params: { documentId },
      },
      async () => published
    )
    expect(queueArticleProjection).not.toHaveBeenCalled()
    expect(h.findMany).not.toHaveBeenCalled()
  })
})

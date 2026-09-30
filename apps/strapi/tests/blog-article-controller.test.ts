import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/blog-article/controllers/blog-article"

const BLOG = "api::blog-article.blog-article"

function article(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: i,
    documentId: `art${i}`,
    title: `Article ${i}`,
    slug: `article-${i}`,
    publishedAt: `2026-09-${String(i).padStart(2, "0")}T00:00:00.000Z`,
    relatedArticles: [],
    ...extra,
  }
}

describe("blog-article.detail related-articles fallback (E2)", () => {
  it("reads three recent posts with a flat limit and a stable sort, never `pagination`", async () => {
    const faked = makeFakeStrapi({
      [BLOG]: [article(1), article(2), article(3), article(4), article(5)],
    })
    const controller = factory({
      strapi: { ...faked.strapi, contentType: () => ({ uid: BLOG }) },
    } as any)
    const c: any = { params: { slug: "article-1" }, query: {} }
    await controller.detail(c)

    const calls = faked.strapi.documents.mock.calls.flatMap(
      ([uid]: [string], i: number) =>
        uid === BLOG
          ? faked.strapi.documents.mock.results[
              i
            ].value.findMany.mock.calls.map((c: any[]) => c[0])
          : []
    )
    expect(calls).toHaveLength(2)
    const fallback = calls[1]
    expect(fallback.pagination).toBeUndefined()
    expect(fallback.limit).toBe(3)
    expect(fallback.sort).toEqual(["publishedAt:desc", "id:asc"])
    expect(fallback.status).toBe("published")
    expect(c.body.data.relatedArticles.map((a: any) => a.slug)).toEqual([
      "article-5",
      "article-4",
      "article-3",
    ])
  })
})

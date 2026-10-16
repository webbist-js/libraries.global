import { describe, it, expect } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import blogFactory from "../src/api/blog-article/controllers/blog-article"
import wikiFactory from "../src/api/wiki-article/controllers/wiki-article"

describe.each([
  ["blog", blogFactory],
  ["wiki", wikiFactory],
] as const)("%s public reader languages", (kind, factory) => {
  it("lists only published variants of the same document and never an unpublished translation", async () => {
    const uid = `api::${kind}-article.${kind}-article`
    const row = (
      id: number,
      locale: string,
      publishedAt: string | null,
      documentId = "same"
    ) => ({
      id,
      documentId,
      locale,
      publishedAt,
      slug: "story",
      title: "Story",
      body: [],
      relatedArticles: [{ slug: "other" }],
    })
    const fake = makeFakeStrapi({
      [uid]: [
        row(1, "en", "2026-10-16"),
        row(2, "es", "2026-10-16"),
        row(3, "fr", null),
        row(4, "cs", "2026-10-16", "different"),
      ],
    })
    const controller = factory({
      strapi: { ...fake.strapi, contentType: () => ({ uid }) },
    } as any)
    const ctx: any = {
      params: { slug: "story" },
      query: { locale: "en", status: "published" },
    }
    await controller.detail(ctx)
    expect(ctx.body.data.availableLocales).toEqual(["en", "es"])
    const calls = fake.strapi.documents.mock.results.flatMap(
      (result) => result.value.findMany.mock.calls
    )
    expect(
      calls.some(
        ([query]: any[]) =>
          query.status === "published" &&
          query.locale === "*" &&
          query.filters.documentId?.$eq === "same" &&
          query.fields.length === 1 &&
          query.fields[0] === "locale"
      )
    ).toBe(true)
  })
})

describe.each([
  ["blog", blogFactory],
  ["wiki", wikiFactory],
] as const)("%s published language endpoint", (kind, factory) => {
  it("ignores draft/locale query injection and lists only the same document's published languages", async () => {
    const uid = `api::${kind}-article.${kind}-article`,
      id = "a".repeat(24)
    const fake = makeFakeStrapi({
      [uid]: [
        { id: 1, documentId: id, locale: "en", publishedAt: "2026-10-16" },
        { id: 2, documentId: id, locale: "es", publishedAt: "2026-10-16" },
        { id: 3, documentId: id, locale: "fr", publishedAt: null },
      ],
    })
    const controller = factory({
      strapi: { ...fake.strapi, contentType: () => ({ uid }) },
    } as any)
    const ctx: any = {
      params: { documentId: id },
      query: { status: "draft", locale: "fr" },
    }
    await controller.publishedLocales(ctx)
    expect(ctx.body).toEqual({ data: ["en", "es"], meta: {} })
  })
})

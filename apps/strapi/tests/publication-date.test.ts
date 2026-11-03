import type { Core } from "@strapi/strapi"
import { describe, expect, it, type Mock, vi } from "vitest"

import {
  backfillArticlePublicationDates,
  normaliseArticleRepublishHistory,
  registerPublicationDateMiddleware,
} from "../src/documentMiddlewares/publication-date"

const BLOG = "api::blog-article.blog-article"
const ARTICLE_CHANGE = "api::article-change.article-change"

type MiddlewareContext = {
  uid: string
  action: string
  params?: Record<string, unknown>
}
type Middleware = (
  ctx: MiddlewareContext,
  next: () => Promise<unknown>
) => Promise<unknown>

function harness(queries: Record<string, Record<string, Mock>> = {}) {
  let mw!: Middleware
  const saved: Record<string, unknown> = {}
  const query = (uid: string) => ({
    updateMany: vi.fn(async () => ({ count: 1 })),
    findOne: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    ...queries[uid],
  })
  const cache = new Map<string, ReturnType<typeof query>>()
  const strapi = {
    documents: { use: (fn: Middleware) => (mw = fn) },
    db: {
      query: (uid: string) => {
        if (!cache.has(uid)) cache.set(uid, query(uid))

        return cache.get(uid)!
      },
    },
    plugin: () => ({
      service: () => ({ getDefaultLocale: async () => "en" }),
    }),
    store: () => ({
      get: async ({ key }: { key: string }) => saved[key],
      set: async ({ key, value }: { key: string; value: unknown }) => {
        saved[key] = value
      },
    }),
    log: { info: vi.fn() },
  }
  const asStrapi = strapi as unknown as Core.Strapi
  registerPublicationDateMiddleware({ strapi: asStrapi })

  return {
    strapi: asStrapi,
    saved,
    q: (uid: string) => strapi.db.query(uid),
    run: (ctx: MiddlewareContext) => mw(ctx, async () => ({})),
  }
}

describe("publication date", () => {
  it("stamps empty drafts of the published locale before a publish", async () => {
    const h = harness()
    await h.run({ uid: BLOG, action: "publish", params: { documentId: "a1" } })
    expect(h.q(BLOG).updateMany).toHaveBeenCalledWith({
      where: {
        documentId: "a1",
        publishedAt: null,
        publicationDate: null,
        locale: { $in: ["en"] },
      },
      data: { publicationDate: expect.any(Date) },
    })
  })

  it("stamps every locale for a '*' publish", async () => {
    const h = harness()
    await h.run({
      uid: BLOG,
      action: "publish",
      params: { documentId: "a1", locale: "*" },
    })
    const calls = h.q(BLOG).updateMany.mock.calls as unknown as [
      { where: Record<string, unknown> },
    ][]
    expect(calls[0]![0].where).not.toHaveProperty("locale")
  })

  it("keeps an editor's date on a published update", async () => {
    const h = harness({
      [BLOG]: {
        findOne: vi.fn(async () => ({ publicationDate: "2026-11-01" })),
      },
    })
    const params = {
      documentId: "a1",
      status: "published",
      data: {} as Record<string, unknown>,
    }
    await h.run({ uid: BLOG, action: "update", params })
    expect(params.data.publicationDate).toBeUndefined()
  })

  it("dates a document created as published", async () => {
    const h = harness()
    const params = { status: "published", data: {} as Record<string, unknown> }
    await h.run({ uid: BLOG, action: "create", params })
    expect(typeof params.data.publicationDate).toBe("string")
  })

  it("ignores other content types", async () => {
    const h = harness()
    await h.run({
      uid: "api::library.library",
      action: "publish",
      params: { documentId: "l1" },
    })
    expect(h.q("api::library.library").updateMany).not.toHaveBeenCalled()
  })

  it("backfills from the first recorded publication", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        { documentId: "a1", locale: "en", publishedAt: "2026-11-02T09:00:00Z" },
      ])
      .mockResolvedValue([])
    const h = harness({
      [BLOG]: { findMany },
      [ARTICLE_CHANGE]: {
        findOne: vi.fn(async () => ({ changedAt: "2026-11-01T08:00:00Z" })),
      },
    })
    await backfillArticlePublicationDates(h.strapi)
    expect(h.q(BLOG).updateMany).toHaveBeenCalledWith({
      where: { documentId: "a1", locale: "en", publicationDate: null },
      data: { publicationDate: new Date("2026-11-01T08:00:00Z") },
    })
  })

  it("turns republishes of a live locale into edits, once", async () => {
    const rows = [
      { id: 1, kind: "published" },
      { id: 2, kind: "published" },
      { id: 3, kind: "unpublished" },
      { id: 4, kind: "published" },
      { id: 5, kind: "published" },
    ].map((r) => ({
      ...r,
      articleKind: "blog",
      articleDocumentId: "a1",
      contentLocale: "en",
    }))
    const findMany = vi.fn().mockResolvedValueOnce(rows).mockResolvedValue([])
    const h = harness({ [ARTICLE_CHANGE]: { findMany } })
    await expect(normaliseArticleRepublishHistory(h.strapi)).resolves.toBe(2)
    expect(h.q(ARTICLE_CHANGE).updateMany).toHaveBeenCalledWith({
      where: { id: { $in: [2, 5] } },
      data: { kind: "edited" },
    })
    await expect(normaliseArticleRepublishHistory(h.strapi)).resolves.toBe(0)
  })
})

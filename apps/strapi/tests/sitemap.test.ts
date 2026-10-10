import { beforeEach, describe, expect, it, vi } from "vitest"

import factory from "../src/api/sitemap/controllers/sitemap"
import { sitemapQuery, sitemapRows } from "../src/utils/sitemap-source"

const findMany = vi.fn()
const findFirst = vi.fn()
const count = vi.fn()
const strapi = { documents: vi.fn(() => ({ findMany, findFirst, count })) }
const controller = factory({ strapi: strapi as never })
function context(source: string, query: Record<string, unknown> = {}) {
  return {
    params: { source },
    query,
    body: undefined as unknown,
    badRequest: vi.fn(),
    notFound: vi.fn(),
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  findMany.mockResolvedValue([])
  count.mockResolvedValue(2_900_000)
})

describe("public sitemap source", () => {
  it("counts using the same publication and SEO filters as row reads", async () => {
    const ctx = context("libraries", { locale: "en", status: "draft" })
    await controller.count(ctx)
    expect(ctx.body).toEqual({ count: 2_900_000 })
    expect(count).toHaveBeenCalledWith(sitemapQuery("libraries", "en"))
    expect(count.mock.calls[0]?.[0]).toMatchObject({
      status: "published",
      locale: "en",
    })
    await controller.rows(ctx)
    expect(findMany.mock.calls[0]?.[0].filters.$and[0]).toEqual(
      count.mock.calls[0]?.[0].filters
    )
  })

  it("caps every response and advances with row ids", async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 1000 }, (_, i) => ({
        id: 20_001 + i,
        slug: `library-${i}`,
      }))
    )
    const ctx = context("libraries", {
      after: "20000",
      limit: "100000",
      start: "0",
    })
    await controller.rows(ctx)
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      sort: "id:asc",
      limit: 1000,
      start: 0,
    })
    expect(ctx.body).toMatchObject({ meta: { next: 21000 } })
  })

  it("returns only public usernames and system timestamps for public profile discovery", async () => {
    findMany.mockResolvedValue([
      {
        id: 1,
        username: "reader",
        updatedAt: "2026-10-08",
        baUserId: "private-id",
        email: "private@example.com",
        publicPrefs: {},
      },
    ])
    const rows = await sitemapRows(strapi as never, "profiles", "en", {
      after: 0,
      start: 0,
      limit: 1000,
    })
    expect(rows).toEqual([
      { id: 1, username: "reader", updatedAt: "2026-10-08" },
    ])
    expect(findMany.mock.calls[0]?.[0].filters.$and[0]).toEqual({
      $and: [
        { profileVisibility: "public", username: { $notNull: true, $ne: "" } },
      ],
    })
  })

  it("keeps cancelled, pending-review and private workflows out of discovery", () => {
    expect(sitemapQuery("events", "en").filters.$and).toContainEqual({
      pendingReview: false,
      status: { $in: ["upcoming", "ongoing"] },
    })
    expect(sitemapQuery("drives", "en").filters.$and).toContainEqual({
      status: { $in: ["open", "closed"] },
    })
    expect(sitemapQuery("knowledge", "en").filters.$and).toContainEqual({
      $or: [
        { seo: { metaRobots: { $null: true } } },
        { seo: { metaRobots: { $notContainsi: "none" } } },
      ],
    })
  })

  it.each([
    { limit: "0" },
    { after: "-1" },
    { start: "9007199254740992" },
    { locale: ["en", "cs"] },
    { limit: ["1"] },
  ])("rejects malformed windows %j", async (query) => {
    const ctx = context("libraries", query)
    await controller.rows(ctx)
    expect(ctx.badRequest).toHaveBeenCalled()
    expect(strapi.documents).not.toHaveBeenCalled()
  })

  it("does not expose arbitrary content types", async () => {
    const ctx = context("event-credential")
    await controller.rows(ctx)
    expect(ctx.notFound).toHaveBeenCalled()
    expect(strapi.documents).not.toHaveBeenCalled()
  })

  it("honours CMS noindex for static landing pages without returning CMS content", async () => {
    findFirst
      .mockResolvedValueOnce({ seo: { metaRobots: "none" } })
      .mockResolvedValueOnce(null)
    const ctx = context("pages", { locale: "en", status: "draft" })
    await controller.pages(ctx)
    expect(ctx.body).toEqual({ data: { "": false, journal: true } })
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      status: "published",
      locale: "en",
    })
  })
})

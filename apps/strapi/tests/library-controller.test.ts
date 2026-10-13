import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/library/controllers/library"
import { registerEntityRefSubscriber } from "../src/lifeCycles/entityRef"
import { invalidateAtlasCache } from "../src/utils/atlas-cache"

const LIBRARY = "api::library.library"

function library(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: i,
    documentId: `lib${i}`,
    name: `Library ${i}`,
    slug: `library-${i}`,
    libraryType: "Public",
    operationalStatus: "open",
    location: { lat: 51 + i / 1000, lng: -1 },
    continent: { slug: "europe" },
    country: { slug: "united-kingdom", name: "United Kingdom" },
    region: { slug: "england", name: "England" },
    completeness: 75,
    publishedAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  }
}

function ctx(query: Record<string, unknown> = {}) {
  const c: any = {
    query,
    set: vi.fn(),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

function build(rows: Record<string, unknown>[]) {
  const faked = makeFakeStrapi({ [LIBRARY]: rows as any })
  const controller = factory({
    strapi: { ...faked.strapi, contentType: () => ({ uid: LIBRARY }) },
  } as any)
  // Collect id-ordered table pages separately from the additional bounded
  // notice lookups, which fetch timetable context for each library chunk.
  const findManyParams = () =>
    [
      ...new Set(
        faked.strapi.documents.mock.calls.flatMap(
          ([uid]: [string], i: number) =>
            uid === LIBRARY
              ? [faked.strapi.documents.mock.results[i].value.findMany]
              : []
        )
      ),
    ]
      .flatMap((query: any) => query.mock.calls.map((c: any[]) => c[0]))
      .filter((params: any) => params.sort === "id:asc")

  return { ...faked, controller, findManyParams }
}

describe("library.atlas (E2, E3)", () => {
  beforeEach(() => invalidateAtlasCache())
  afterEach(() => invalidateAtlasCache())

  it("walks the table by id keyset with a flat limit, never `pagination`", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => library(i + 1))
    const { controller, findManyParams } = build(rows)
    const c = ctx({})
    await controller.atlas(c)

    const calls = findManyParams()
    expect(calls).toHaveLength(2)
    for (const params of calls) {
      expect(params.pagination).toBeUndefined()
      expect(params.limit).toBe(1000)
      expect(params.sort).toBe("id:asc")
      expect(params.status).toBe("published")
    }
    expect(calls[0].filters).toEqual({
      id: { $gt: 0 },
      $or: [
        { libraryType: { $ne: "Mobile" } },
        { mobileTimetable: { $null: true } },
      ],
    })
    expect(calls[1].filters).toMatchObject({ id: { $gt: 1000 } })
    expect(c.body.features).toHaveLength(1001)
  })

  it("reads the stored completeness instead of description and collection stats", async () => {
    const { controller, findManyParams } = build([
      library(1, { completeness: 38 }),
    ])
    const c = ctx({})
    await controller.atlas(c)

    const [params] = findManyParams()
    expect(params.fields).toContain("completeness")
    expect(params.fields).not.toContain("description")
    expect(params.populate.collectionStats).toBeUndefined()
    expect(c.body.features[0].properties.complete).toBe(38)
    expect(c.body.features[0].properties.path).toBe(
      "/europe/united-kingdom/england/library-1"
    )
  })

  it("serves the second call within the TTL from memory and sets a CDN cache header", async () => {
    const { controller, findManyParams } = build([library(1)])
    const first = ctx({})
    await controller.atlas(first)
    const second = ctx({})
    await controller.atlas(second)

    expect(findManyParams()).toHaveLength(1)
    expect(second.body).toEqual(first.body)
    expect(second.set).toHaveBeenCalledWith(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=3600"
    )
  })

  it("keeps one entry per locale", async () => {
    const { controller, findManyParams } = build([library(1)])
    await controller.atlas(ctx({ locale: "en" }))
    await controller.atlas(ctx({ locale: "fr" }))
    await controller.atlas(ctx({ locale: "en" }))

    expect(findManyParams()).toHaveLength(2)
  })

  it("is cleared when a library is written (the publish lifecycle)", async () => {
    const { controller, strapi, findManyParams } = build([library(1)])
    let hooks: any = null
    strapi.db.lifecycles = { subscribe: vi.fn((h: any) => (hooks = h)) }
    registerEntityRefSubscriber({ strapi })

    await controller.atlas(ctx({}))
    await hooks.afterUpdate({
      model: { uid: LIBRARY },
      result: { id: 1, documentId: "lib1", publishedAt: "2026-09-30" },
      params: { data: { publishedAt: "2026-09-30" } },
    })
    await controller.atlas(ctx({}))

    expect(findManyParams()).toHaveLength(2)
  })

  it("rejects a non-string locale", async () => {
    const { controller, strapi } = build([library(1)])
    const c = ctx({ locale: ["en", "fr"] })
    await controller.atlas(c)

    expect(c.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})

describe("library.slugs (E5)", () => {
  it("pages in id order with start and a limit capped at 1000", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => library(i + 1))
    const { controller, findManyParams } = build(rows)
    const first = ctx({ limit: "5000" })
    await controller.slugs(first)
    const second = ctx({ start: "1000", limit: "1000" })
    await controller.slugs(second)

    const [p1, p2] = findManyParams()
    expect(p1).toMatchObject({ start: 0, limit: 1000, sort: "id:asc" })
    expect(p1.pagination).toBeUndefined()
    expect(p1.fields).toEqual(["slug", "locale", "updatedAt"])
    expect(p2).toMatchObject({ start: 1000, limit: 1000 })
    expect(first.body.data).toHaveLength(1000)
    expect(first.body.meta).toEqual({
      after: 0,
      start: 0,
      limit: 1000,
      count: 1000,
      next: 1000,
    })
    expect(second.body.data).toHaveLength(201)
    expect(second.body.data[0].slug).toBe("library-1001")
    expect(second.body.meta.next).toBeNull()
  })

  it("walks by keyset: `after` filters on id and `meta.next` is the last id", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => library(i + 1))
    const { controller, findManyParams } = build(rows)
    const first = ctx({ start: "5", limit: "10" })
    await controller.slugs(first)
    const second = ctx({ after: String(first.body.meta.next), limit: "10" })
    await controller.slugs(second)

    const [p1, p2] = findManyParams()
    expect(p1.filters).toBeUndefined()
    expect(p2.filters).toEqual({ id: { $gt: 15 } })
    expect(first.body.data[0].slug).toBe("library-6")
    expect(first.body.meta.next).toBe(15)
    expect(second.body.data.map((r: any) => r.slug)).toEqual(
      Array.from({ length: 10 }, (_, i) => `library-${i + 16}`)
    )
    // A full page always hands back a cursor; the next page is then empty.
    expect(second.body.meta.next).toBe(25)
    const third = ctx({ after: "25", limit: "10" })
    await controller.slugs(third)
    expect(third.body.data).toEqual([])
    expect(third.body.meta.next).toBeNull()
  })

  it.each([
    ["start", "-1"],
    ["start", "x"],
    ["limit", "0"],
    ["limit", ["10", "20"]],
    ["after", "-5"],
  ])("returns 400 for an invalid %s", async (key, value) => {
    const { controller, strapi } = build([library(1)])
    const c = ctx({ [key]: value })
    await controller.slugs(c)

    expect(c.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})

describe("library.slugsCount", () => {
  it("counts published libraries in the locale", async () => {
    const { controller, strapi } = build([library(1), library(2)])
    const c = ctx({ locale: "en" })
    await controller.slugsCount(c)

    expect(c.body).toEqual({ count: 2 })
    const handle = strapi.documents.mock.results[0].value
    expect(handle.count).toHaveBeenCalledWith({
      locale: "en",
      status: "published",
    })
  })

  it("refuses a repeated locale", async () => {
    const { controller } = build([])
    const c = ctx({ locale: ["en", "cs"] })
    await controller.slugsCount(c)

    expect(c.status).toBe(400)
  })
})

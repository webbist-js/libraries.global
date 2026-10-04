import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/region/controllers/region"

const REGION = "api::region.region"

const { regionIdsWithLibraries } = vi.hoisted(() => ({
  regionIdsWithLibraries: vi.fn(),
}))
vi.mock("../src/utils/region-library-ids", () => ({ regionIdsWithLibraries }))

function region(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: i,
    documentId: `region${i}`,
    slug: `region-${i}`,
    locale: "en",
    country: { slug: "united-kingdom" },
    continent: { slug: "europe" },
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
  const faked = makeFakeStrapi({ [REGION]: rows as any })
  const controller = factory({
    strapi: { ...faked.strapi, contentType: () => ({ uid: REGION }) },
  } as any)
  const findManyParams = () =>
    faked.strapi.documents.mock.calls.flatMap(([uid]: [string], i: number) =>
      uid === REGION
        ? faked.strapi.documents.mock.results[i].value.findMany.mock.calls.map(
            (c: any[]) => c[0]
          )
        : []
    )

  return { ...faked, controller, findManyParams }
}

beforeEach(() => regionIdsWithLibraries.mockReset())
afterEach(() => regionIdsWithLibraries.mockReset())

describe("region.slugs — unflagged (Task 18, backward compatibility)", () => {
  it("pages by id keyset with the same cap as withLibraries, unfiltered", async () => {
    const rows = Array.from({ length: 1201 }, (_, i) => region(i + 1))
    const { controller, findManyParams } = build(rows)
    const first = ctx({ locale: "en", limit: "5000" })
    await controller.slugs(first)

    expect(regionIdsWithLibraries).not.toHaveBeenCalled()
    const [params] = findManyParams()
    expect(params.filters).toBeUndefined()
    // The requested limit (5000) is capped at REGION_SLUGS_MAX_LIMIT (1000),
    // exactly like the withLibraries path and like `/libraries/slugs`.
    expect(params.limit).toBe(1000)
    expect(params.sort).toBe("id:asc")
    expect(params.fields).toEqual(["slug", "locale"])
    expect(first.body.data).toHaveLength(1000)
    expect(first.body.meta).toEqual({
      after: 0,
      limit: 1000,
      count: 1000,
      next: 1000,
    })

    const second = ctx({ locale: "en", after: "1000", limit: "1000" })
    await controller.slugs(second)
    const [, p2] = findManyParams()
    expect(p2.filters).toEqual({ id: { $gt: 1000 } })
    expect(second.body.data).toHaveLength(201)
    expect(second.body.data[0].slug).toBe("region-1001")
    expect(second.body.meta.next).toBeNull()
  })

  it.each([
    ["after", "-5"],
    ["limit", "0"],
    ["limit", ["10", "20"]],
  ])(
    "returns 400 for an invalid %s even without withLibraries",
    async (key, value) => {
      const { controller, strapi } = build([region(1)])
      const c = ctx({ [key]: value })
      await controller.slugs(c)

      expect(c.status).toBe(400)
      expect(strapi.documents).not.toHaveBeenCalled()
      expect(regionIdsWithLibraries).not.toHaveBeenCalled()
    }
  )
})

describe("region.slugs — withLibraries=1 (Task 18)", () => {
  it("keeps only Regions whose documentId has a library, paged by id keyset with a capped limit", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => region(i + 1))
    const { controller, findManyParams } = build(rows)
    regionIdsWithLibraries.mockResolvedValue(new Set(["region1", "region3"]))
    const c = ctx({ withLibraries: "1", limit: "5000" })
    await controller.slugs(c)

    expect(regionIdsWithLibraries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "published" })
    )
    const [params] = findManyParams()
    expect(params.filters).toEqual({
      $and: [{ documentId: { $in: ["region1", "region3"] } }],
    })
    expect(params.limit).toBe(1000)
    expect(params.sort).toBe("id:asc")
    expect(c.body.data).toHaveLength(2)
    expect(c.body.data.map((r: any) => r.slug)).toEqual([
      "region-1",
      "region-3",
    ])
    expect(c.body.meta).toEqual({
      after: 0,
      limit: 1000,
      count: 2,
      next: null,
    })
  })

  it("walks by keyset: `after` adds an id filter and a full page hands back `meta.next`", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => region(i + 1))
    const { controller, findManyParams } = build(rows)
    regionIdsWithLibraries.mockResolvedValue(
      new Set(rows.map((r) => r.documentId))
    )
    const first = ctx({ withLibraries: "1", limit: "2" })
    await controller.slugs(first)
    const second = ctx({
      withLibraries: "1",
      limit: "2",
      after: String(first.body.meta.next),
    })
    await controller.slugs(second)

    const [p1, p2] = findManyParams()
    expect(p1.filters).toEqual({
      $and: [{ documentId: { $in: rows.map((r) => r.documentId) } }],
    })
    expect(p2.filters).toEqual({
      $and: [
        { documentId: { $in: rows.map((r) => r.documentId) } },
        { id: { $gt: 2 } },
      ],
    })
    expect(first.body.data.map((r: any) => r.slug)).toEqual([
      "region-1",
      "region-2",
    ])
    expect(first.body.meta.next).toBe(2)
    expect(second.body.data.map((r: any) => r.slug)).toEqual([
      "region-3",
      "region-4",
    ])
    expect(second.body.meta.next).toBe(4)

    const third = ctx({
      withLibraries: "1",
      limit: "2",
      after: String(second.body.meta.next),
    })
    await controller.slugs(third)
    expect(third.body.data.map((r: any) => r.slug)).toEqual(["region-5"])
    expect(third.body.meta.next).toBeNull()
  })

  it("skips the documents query entirely when no Region has a library", async () => {
    const { controller, findManyParams } = build([region(1)])
    regionIdsWithLibraries.mockResolvedValue(new Set())
    const c = ctx({ withLibraries: "1" })
    await controller.slugs(c)

    expect(findManyParams()).toHaveLength(0)
    expect(c.body.data).toEqual([])
    expect(c.body.meta).toEqual({ after: 0, limit: 1000, count: 0, next: null })
  })

  it.each([
    ["after", "-5"],
    ["limit", "0"],
    ["limit", ["10", "20"]],
    ["withLibraries", ["1", "2"]],
  ])("returns 400 for an invalid %s", async (key, value) => {
    const { controller, strapi } = build([region(1)])
    const c = ctx({ withLibraries: "1", [key]: value })
    await controller.slugs(c)

    expect(c.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
    expect(regionIdsWithLibraries).not.toHaveBeenCalled()
  })
})

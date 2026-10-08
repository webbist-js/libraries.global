import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/library/controllers/library"
import libraryPopulate from "../src/api/library/middlewares/library-populate"
import bySlugRoutes from "../src/api/library/routes/library-by-slug"
import { LIBRARY_SHAPES } from "../src/utils/populate-shapes"

const LIBRARY = "api::library.library"

const timetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [],
  visits: [],
}

const rows = [
  {
    id: 1,
    documentId: "lib00000000000000000001",
    name: "Kent Mobile Library",
    slug: "kent-mobile",
    locale: "en",
    libraryType: "Mobile",
    mobileTimetable: timetable,
    description: "Long text the list shape drops",
    publishedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: 2,
    documentId: "lib00000000000000000002",
    name: "Other",
    slug: "other",
    locale: "en",
    libraryType: "Public",
    mobileTimetable: null,
    publishedAt: "2026-09-01T00:00:00.000Z",
  },
]

/** The ctx the route middleware and controller see, as Koa builds it. */
function ctx(params: Record<string, unknown>, query: Record<string, unknown>) {
  const c: any = {
    params,
    query,
    badRequest: vi.fn((m: string) => {
      c.status = 400
      c.body = { error: { status: 400, message: m } }
    }),
  }

  return c
}

/**
 * The core `find` as the fake can run it: the shaped query's filters,
 * locale, status and fields against the in-memory table, in the list
 * envelope (`{ data, meta }`) Strapi's own returns.
 */
function build(seed = rows) {
  const faked = makeFakeStrapi({ [LIBRARY]: seed })
  const controller: any = factory({
    strapi: { ...faked.strapi, contentType: () => ({ uid: LIBRARY }) },
  } as any)
  const find = vi.fn(async (c: any) => {
    const { filters, locale, status, fields } = c.query
    const found = await faked.strapi
      .documents(LIBRARY)
      .findMany({ filters, locale, status })
    const project = (row: Record<string, unknown>) =>
      Array.isArray(fields)
        ? Object.fromEntries(
            Object.entries(row).filter(
              ([k]) => k === "documentId" || fields.includes(k)
            )
          )
        : row
    c.body = {
      data: found.map(project),
      meta: { pagination: { total: found.length } },
    }

    return c.body
  })
  // `super.find` resolves through the controller's prototype (the core
  // controller `createCoreController` installed); swap it for the fake's.
  Object.setPrototypeOf(controller, { find })

  return { controller, find }
}

/** What the request looks like once `library-populate` has shaped it. */
function shaped(query: Record<string, unknown>) {
  const c: any = { query }
  libraryPopulate({ view: "detail" }, { strapi: {} as any })(c, async () => {})

  return c.query
}

describe("GET /libraries/by-slug/:slug (the library page's read)", () => {
  it("is a public route under the detail populate shape, which carries the timetable", () => {
    expect(bySlugRoutes.routes).toEqual([
      {
        method: "GET",
        path: "/libraries/by-slug/:slug",
        handler: "library.findBySlug",
        config: {
          auth: false,
          middlewares: [
            {
              name: "api::library.library-populate",
              config: { view: "detail" },
            },
          ],
        },
      },
    ])
    const query = shaped({ populate: "*", fields: ["createdBy"] })
    expect(query.fields).toEqual(LIBRARY_SHAPES.detail.fields)
    for (const field of ["mobileTimetable", "description", "catalogueUrl"])
      expect(query.fields).toContain(field)
    for (const relation of ["homeLibrary", "mobileLibraries", "socialLinks"])
      expect(query.populate[relation]).toBeDefined()
    // The list shape stays light: no timetable, no long text.
    expect(LIBRARY_SHAPES.list.fields).not.toContain("mobileTimetable")
    expect(LIBRARY_SHAPES.list.fields).not.toContain("description")
  })

  it("pins the filters to the slug, keeps locale, status and sort, and returns the row with its timetable", async () => {
    const { controller, find } = build()
    const c = ctx(
      { slug: "kent-mobile" },
      shaped({
        locale: "en",
        status: "published",
        sort: { publishedAt: "desc" },
        // A client's own filters and paging never widen the read.
        filters: { name: { $containsi: "Other" } },
        pagination: { pageSize: 500, page: 3 },
      })
    )
    await controller.findBySlug(c)

    expect(find).toHaveBeenCalledTimes(1)
    const [forwarded] = find.mock.calls[0] as [any]
    expect(forwarded.query).toMatchObject({
      locale: "en",
      status: "published",
      sort: { publishedAt: "desc" },
      filters: { slug: { $eq: "kent-mobile" } },
      pagination: { pageSize: 5 },
    })
    expect(forwarded.query.fields).toEqual(LIBRARY_SHAPES.detail.fields)
    expect(c.body.data).toHaveLength(1)
    expect(c.body.data[0]).toMatchObject({
      documentId: "lib00000000000000000001",
      slug: "kent-mobile",
      libraryType: "Mobile",
      mobileTimetable: timetable,
      description: "Long text the list shape drops",
    })
  })

  it("answers an unknown slug with an empty list (the page reads `data.pop() ?? null`), never a scan", async () => {
    const { controller, find } = build()
    const c = ctx({ slug: "nope" }, shaped({ locale: "en" }))
    await controller.findBySlug(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data).toEqual([])
    expect((find.mock.calls[0] as [any])[0].query.filters).toEqual({
      slug: { $eq: "nope" },
    })
  })

  it.each([
    [""],
    ["a/b"],
    ["../x"],
    ["sp ace"],
    ["-leading"],
    ["x".repeat(256)],
  ])("refuses the slug %j with 400 before reading anything", async (slug) => {
    const { controller, find } = build()
    const c = ctx({ slug }, shaped({}))
    await controller.findBySlug(c)

    expect(c.status).toBe(400)
    expect(find).not.toHaveBeenCalled()
  })

  it("refuses a slug that isn't a string", async () => {
    const { controller, find } = build()
    const c = ctx({ slug: ["a", "b"] }, shaped({}))
    await controller.findBySlug(c)

    expect(c.status).toBe(400)
    expect(find).not.toHaveBeenCalled()
  })
})

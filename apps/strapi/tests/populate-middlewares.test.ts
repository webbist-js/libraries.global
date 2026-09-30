import { describe, expect, it, vi } from "vitest"

import areaPopulate from "../src/api/area/middlewares/area-populate"
import continentPopulate from "../src/api/continent/middlewares/continent-populate"
import countryPopulate from "../src/api/country/middlewares/country-populate"
import libraryPopulate from "../src/api/library/middlewares/library-populate"
import regionPopulate from "../src/api/region/middlewares/region-populate"
import { MEDIA_FIELDS } from "../src/utils/populate-shapes"

const MIDDLEWARES = {
  library: libraryPopulate,
  continent: continentPopulate,
  country: countryPopulate,
  region: regionPopulate,
  area: areaPopulate,
} as const

const MEDIA_ATTRIBUTES = new Set([
  "heroImage",
  "gallery",
  "metaImage",
  "ogImage",
])

/** Every relation, component and media entry in a populate tree must carry an explicit `fields`. */
function assertExplicit(populate: unknown, path = "populate") {
  expect(populate, path).not.toBe("*")
  expect(Array.isArray(populate), path).toBe(false)
  for (const [key, value] of Object.entries(
    populate as Record<string, unknown>
  )) {
    const here = `${path}.${key}`
    expect(value, here).not.toBe(true)
    expect(value, here).not.toBe("*")
    const entry = value as { fields?: unknown; populate?: unknown }
    if (MEDIA_ATTRIBUTES.has(key)) {
      expect(entry.fields, here).toEqual(MEDIA_FIELDS)
    } else {
      expect(
        Array.isArray(entry.fields) || entry.populate !== undefined,
        here
      ).toBe(true)
    }
    if (entry.populate !== undefined) assertExplicit(entry.populate, here)
  }
}

describe.each(Object.entries(MIDDLEWARES))(
  "%s populate middleware (E5)",
  (name, factory) => {
    it.each(["list", "detail"] as const)(
      "replaces a client populate=* with the server-owned %s shape and keeps the rest of the query",
      async (view) => {
        const mw = factory({ view }, { strapi: {} as any })
        const ctx: any = {
          query: {
            populate: "*",
            fields: ["id", "createdBy"],
            filters: { slug: { $eq: "x" } },
            locale: "en",
            status: "published",
            sort: ["name:asc"],
            pagination: { page: 2, pageSize: 50 },
          },
        }
        const next = vi.fn(async () => {
          // What the controller sees.
          expect(ctx.query.populate).not.toBe("*")
          assertExplicit(ctx.query.populate)
          expect(Array.isArray(ctx.query.fields)).toBe(true)
          expect(ctx.query.fields).toContain("slug")
          expect(ctx.query.fields).not.toContain("createdBy")
          expect(ctx.query.filters).toEqual({ slug: { $eq: "x" } })
          expect(ctx.query.locale).toBe("en")
          expect(ctx.query.status).toBe("published")
          expect(ctx.query.sort).toEqual(["name:asc"])
          expect(ctx.query.pagination).toEqual({ page: 2, pageSize: 50 })
        })

        await mw(ctx, next)

        expect(next).toHaveBeenCalledTimes(1)
      }
    )

    it("also discards a nested client populate object", async () => {
      const mw = factory({ view: "list" }, { strapi: {} as any })
      const ctx: any = {
        query: {
          populate: { createdBy: { fields: ["email"] }, heroImage: "*" },
        },
      }
      const next = vi.fn(async () => {})
      await mw(ctx, next)

      expect(ctx.query.populate.createdBy).toBeUndefined()
      expect(next).toHaveBeenCalledTimes(1)
    })

    it(`${name === "library" ? "gives the detail view more than the list" : "has a detail view at least as rich as the list"}`, async () => {
      const shapes: Record<string, unknown> = {}
      for (const view of ["list", "detail"] as const) {
        const ctx: any = { query: {} }
        await factory({ view }, { strapi: {} as any })(ctx, async () => {})
        shapes[view] = ctx.query
      }
      const list = shapes.list as { fields: string[]; populate: object }
      const detail = shapes.detail as { fields: string[]; populate: object }
      expect(detail.fields.length).toBeGreaterThanOrEqual(list.fields.length)
      expect(Object.keys(detail.populate).length).toBeGreaterThanOrEqual(
        Object.keys(list.populate).length
      )
      if (name === "library") {
        expect(detail.fields.length).toBeGreaterThan(list.fields.length)
        expect(list.fields).not.toContain("description")
        expect(detail.fields).toContain("description")
      }
    })
  }
)

import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import areaFactory from "../src/api/area/controllers/area"
import categoryFactory from "../src/api/category/controllers/category"
import continentFactory from "../src/api/continent/controllers/continent"
import countryFactory from "../src/api/country/controllers/country"
import regionFactory from "../src/api/region/controllers/region"
import wikiSectionFactory from "../src/api/wiki-section/controllers/wiki-section"
import { MEDIA_FIELDS } from "../src/utils/populate-shapes"

const LIBRARY = "api::library.library"
const CONTINENT = "api::continent.continent"
const COUNTRY = "api::country.country"
const REGION = "api::region.region"
const AREA = "api::area.area"

function build(uid: string, factory: any, seed: Record<string, any[]>) {
  const faked = makeFakeStrapi(seed)
  const controller = factory({
    strapi: { ...faked.strapi, contentType: () => ({ uid }) },
  } as any)
  const paramsOf = (target: string, method = "findMany") =>
    faked.strapi.documents.mock.calls.flatMap(([u]: [string], i: number) =>
      u === target
        ? faked.strapi.documents.mock.results[i].value[method].mock.calls.map(
            (c: any[]) => c[0]
          )
        : []
    )
  const countWheres = (target: string) =>
    faked.strapi.db.query.mock.calls.flatMap(([u]: [string], i: number) =>
      u === target
        ? faked.strapi.db.query.mock.results[i].value.count.mock.calls.map(
            (c: any[]) => c[0].where
          )
        : []
    )

  return { ...faked, controller, paramsOf, countWheres }
}

/** A published, English row: what the scoped counts (`publishedAt`, `locale`) match. */
const published = { locale: "en", publishedAt: "2026-09-01T00:00:00.000Z" }

const ctx = (slug: string, query: Record<string, unknown> = {}) => ({
  params: { slug },
  query: { locale: "en", ...query },
})

/** `heroImage` and `seo.metaImage` must be field-limited wherever they appear. */
function expectFieldLimitedMedia(populate: any) {
  if (populate.heroImage !== undefined)
    expect(populate.heroImage).toEqual({ fields: MEDIA_FIELDS })
  if (populate.seo !== undefined)
    expect(populate.seo.populate.metaImage).toEqual({ fields: MEDIA_FIELDS })
  const featured = populate.featuredLibraries
  if (featured !== undefined) {
    expect(Array.isArray(featured.fields)).toBe(true)
    expect(featured.populate.heroImage).toEqual({ fields: MEDIA_FIELDS })
  }
  if (populate.nationalLibrary !== undefined)
    expect(populate.nationalLibrary.populate.heroImage).toEqual({
      fields: MEDIA_FIELDS,
    })
}

describe("continent.detail (E5)", () => {
  it("field-limits media, counts with the locale, and keeps the aggregates", async () => {
    const { controller, paramsOf, countWheres } = build(
      CONTINENT,
      continentFactory,
      {
        [CONTINENT]: [
          {
            id: 1,
            documentId: "eu",
            slug: "europe",
            countries: [{ documentId: "gb", mapConfig: null }],
          },
        ],
        [LIBRARY]: [
          {
            ...published,
            documentId: "l1",
            libraryType: "Public",
            continent: { id: 1, documentId: "eu" },
            country: { documentId: "gb" },
            location: { lat: 1, lng: 2 },
          },
        ],
      }
    )
    const c: any = ctx("europe")
    await controller.detail(c)

    const [params] = paramsOf(CONTINENT)
    expectFieldLimitedMedia(params.populate)
    for (const where of countWheres(LIBRARY)) {
      expect(where.locale).toBe("en")
      expect(where.publishedAt).toEqual({ $notNull: true })
    }
    expect(countWheres(LIBRARY)).toHaveLength(1)
    expect(c.body.data.libraryCount).toBe(1)
    expect(c.body.data.countries[0].libraryCount).toBe(1)
    expect(c.body.data.libraryTypeCounts).toEqual([
      { type: "Public", count: 1 },
    ])
  })
})

describe("country.detail (E5)", () => {
  it("field-limits media and counts with the locale", async () => {
    const { controller, paramsOf, countWheres } = build(
      COUNTRY,
      countryFactory,
      {
        [COUNTRY]: [
          { id: 1, documentId: "gb", slug: "united-kingdom", regions: [] },
        ],
      }
    )
    const c: any = ctx("united-kingdom")
    await controller.detail(c)

    const [params] = paramsOf(COUNTRY)
    expectFieldLimitedMedia(params.populate)
    expect(params.populate.heroImage).toEqual({ fields: MEDIA_FIELDS })
    expect(countWheres(LIBRARY)[0].locale).toBe("en")
    expect(c.body.data.libraryCount).toBe(0)
  })
})

describe("region.detail (E5)", () => {
  it("field-limits media, counts with the locale and caps the library list", async () => {
    const { controller, paramsOf, countWheres } = build(REGION, regionFactory, {
      [REGION]: [
        {
          id: 1,
          documentId: "eng",
          slug: "england",
          country: { documentId: "gb" },
        },
      ],
      [LIBRARY]: [
        {
          ...published,
          documentId: "l1",
          name: "A",
          libraryType: "Public",
          region: { id: 1, documentId: "eng" },
          country: { documentId: "gb" },
        },
      ],
    })
    const c: any = ctx("england")
    await controller.detail(c)

    const [params] = paramsOf(REGION)
    expectFieldLimitedMedia(params.populate)
    expect(countWheres(LIBRARY)[0].locale).toBe("en")
    const list = paramsOf(LIBRARY).find((p) => p.filters?.region)
    expect(list.limit).toBe(100)
    expect(list.populate.heroImage.fields).toEqual(MEDIA_FIELDS)
    expect(c.body.data.libraries).toHaveLength(1)
  })
})

describe("area.detail (E5)", () => {
  it("reads libraries in a separate capped query instead of populating them all", async () => {
    const { controller, paramsOf, countWheres } = build(AREA, areaFactory, {
      [AREA]: [{ id: 1, documentId: "ar", slug: "camden" }],
      [LIBRARY]: [
        {
          ...published,
          id: 1,
          documentId: "l1",
          name: "A",
          area: { id: 1, documentId: "ar" },
        },
        {
          ...published,
          id: 2,
          documentId: "l2",
          name: "B",
          area: { id: 1, documentId: "ar" },
        },
        {
          ...published,
          id: 3,
          documentId: "l3",
          name: "C",
          area: { id: 9, documentId: "other" },
        },
      ],
    })
    const c: any = ctx("camden")
    await controller.detail(c)

    const [areaParams] = paramsOf(AREA)
    expect(areaParams.populate.libraries).toBeUndefined()
    const [libraryParams] = paramsOf(LIBRARY)
    expect(libraryParams.filters).toEqual({
      area: { documentId: { $eq: "ar" } },
    })
    expect(libraryParams.limit).toBe(100)
    expect(libraryParams.populate.heroImage).toEqual({ fields: MEDIA_FIELDS })
    expect(countWheres(LIBRARY)[0].locale).toBe("en")
    expect(c.body.data.libraries.map((l: any) => l.documentId)).toEqual([
      "l1",
      "l2",
    ])
    expect(c.body.data.libraryCount).toBe(2)
  })
})

describe("category.nav and wiki-section.nav (E5)", () => {
  it("read published entries only", async () => {
    const cat = build("api::category.category", categoryFactory, {
      "api::category.category": [{ documentId: "c1", name: "A", slug: "a" }],
    })
    await cat.controller.nav({ query: {} })
    expect(cat.paramsOf("api::category.category")[0].status).toBe("published")

    const ws = build("api::wiki-section.wiki-section", wikiSectionFactory, {
      "api::wiki-section.wiki-section": [
        { documentId: "w1", name: "A", slug: "a", articles: [] },
      ],
    })
    await ws.controller.nav({ query: {} })
    expect(ws.paramsOf("api::wiki-section.wiki-section")[0].status).toBe(
      "published"
    )
  })
})

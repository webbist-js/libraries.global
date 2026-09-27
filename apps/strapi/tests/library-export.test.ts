import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/library/controllers/library-export"
import {
  LIBRARY_EXPORT_BATCH,
  LIBRARY_EXPORT_MAX_IDS,
} from "../src/utils/library-export"

const LIBRARY = "api::library.library"

/** A documentId-shaped id: 24 lowercase alphanumerics. */
const id = (n: number) => `lib${String(n).padStart(21, "0")}`

function ctx(body: unknown, secret: string | null = "s3cret") {
  const c: any = {
    request: {
      header: secret === null ? {} : { "x-service-secret": secret },
      body,
    },
    send: (b: unknown) => (c.body = b),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

/** Every findMany call's params, across however many documents() calls. */
const findManyCalls = (fake: any): any[] =>
  fake.documents.mock.results.flatMap((r: any) =>
    r.value.findMany.mock.calls.map((call: any[]) => call[0])
  )

describe("library export (bridge)", () => {
  let fake: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: id(1),
          name: "Leeds Central Library",
          slug: "leeds-central-library",
          libraryType: "Public",
          operationalStatus: "open",
          streetAddress: "Calverley Street",
          city: "Leeds",
          location: { lat: 53.8, lng: -1.55 },
          website: "https://www.leeds.gov.uk/libraries",
          phone: "+44 113 378 5005",
          email: "libraries@leeds.gov.uk",
          summary: "Not an export field",
          continent: { slug: "europe" },
          country: { slug: "england", name: "England" },
          region: { slug: "west-yorkshire", name: "West Yorkshire" },
        },
        {
          documentId: id(2),
          name: "Unplaced Library",
          slug: "unplaced-library",
          libraryType: "Special",
          operationalStatus: "unknown",
          location: null,
        },
      ],
    })
    ;(globalThis as any).strapi = strapi
    fake = strapi
  })
  afterEach(() => {
    delete (globalThis as any).strapi
    delete process.env.STRAPI_BRIDGE_SECRET
  })

  it.each([
    ["no secret", null],
    ["a wrong secret", "wrong"],
  ])("returns 401 with %s", async (_label, secret) => {
    const c = ctx({ ids: [id(1)] }, secret)
    await controller.exportRows(c)
    expect(c.status).toBe(401)
    expect(fake.documents).not.toHaveBeenCalled()
  })

  it("returns 401 when the bridge secret isn't configured", async () => {
    delete process.env.STRAPI_BRIDGE_SECRET
    const c = ctx({ ids: [id(1)] })
    await controller.exportRows(c)
    expect(c.status).toBe(401)
  })

  it.each([
    ["no body", undefined],
    ["no ids", {}],
    ["ids that aren't an array", { ids: id(1) }],
    ["an empty list", { ids: [] }],
    ["an id that isn't a documentId", { ids: [id(1), "not-a-document-id"] }],
    ["an id that isn't a string", { ids: [id(1), 42] }],
    [
      "too many ids",
      {
        ids: Array.from({ length: LIBRARY_EXPORT_MAX_IDS + 1 }, (_, i) =>
          id(i)
        ),
      },
    ],
  ])("returns 400 for %s", async (_label, body) => {
    const c = ctx(body)
    await controller.exportRows(c)
    expect(c.status).toBe(400)
    expect(fake.documents).not.toHaveBeenCalled()
  })

  it("accepts up to 50,000 ids, the Team plan's row cap", () => {
    expect(LIBRARY_EXPORT_MAX_IDS).toBe(50_000)
  })

  it("returns the export fields keyed by documentId, skipping unknown ids", async () => {
    const c = ctx({ ids: [id(2), id(9), id(1)] })
    await controller.exportRows(c)
    expect(c.status).toBeUndefined()
    expect(c.body).toEqual({
      data: {
        [id(1)]: {
          name: "Leeds Central Library",
          slug: "leeds-central-library",
          libraryType: "Public",
          operationalStatus: "open",
          streetAddress: "Calverley Street",
          city: "Leeds",
          region: "West Yorkshire",
          country: "England",
          lat: 53.8,
          lng: -1.55,
          website: "https://www.leeds.gov.uk/libraries",
          phone: "+44 113 378 5005",
          email: "libraries@leeds.gov.uk",
          continentSlug: "europe",
          countrySlug: "england",
          regionSlug: "west-yorkshire",
        },
        [id(2)]: {
          name: "Unplaced Library",
          slug: "unplaced-library",
          libraryType: "Special",
          operationalStatus: "unknown",
          streetAddress: null,
          city: null,
          region: null,
          country: null,
          lat: null,
          lng: null,
          website: null,
          phone: null,
          email: null,
          continentSlug: null,
          countrySlug: null,
          regionSlug: null,
        },
      },
    })
  })

  it("reads published libraries with only the export fields and relations", async () => {
    await controller.exportRows(ctx({ ids: [id(1), id(2), id(1)] }))
    expect(findManyCalls(fake)).toEqual([
      {
        filters: { documentId: { $in: [id(1), id(2)] } },
        fields: [
          "name",
          "slug",
          "libraryType",
          "operationalStatus",
          "streetAddress",
          "city",
          "location",
          "website",
          "phone",
          "email",
        ],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug", "name"] },
          region: { fields: ["slug", "name"] },
        },
        status: "published",
        limit: 2,
      },
    ])
    expect(
      fake.documents.mock.calls.every(([uid]: [string]) => uid === LIBRARY)
    ).toBe(true)
  })

  it("queries in batches of 500: 1,200 ids take three findMany calls", async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => id(i + 100))
    await controller.exportRows(ctx({ ids }))
    const calls = findManyCalls(fake)
    expect(LIBRARY_EXPORT_BATCH).toBe(500)
    expect(calls.map((p) => p.filters.documentId.$in.length)).toEqual([
      500, 500, 200,
    ])
    expect(calls.flatMap((p) => p.filters.documentId.$in)).toEqual(ids)
  })
})

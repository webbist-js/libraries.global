import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"
import homepageFactory from "../src/api/homepage/controllers/homepage"
import { resetHomepageStatsCache } from "../src/utils/homepage-stats"
import { tallyLibrariesByChild } from "../src/utils/library-tally"
import { countLibrariesByType } from "../src/utils/library-type-counts"

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"
const AFF = "api::library-affiliation.library-affiliation"

const link = (name: string, inverse: string) => ({
  joinTable: {
    name,
    joinColumn: { name: "library_id" },
    inverseJoinColumn: { name: inverse },
  },
})

/** What `strapi.db.metadata.get` returns for the tables these queries join. */
const META: Record<string, any> = {
  [LIBRARY]: {
    tableName: "libraries",
    attributes: {
      continent: link("libraries_continent_lnk", "continent_id"),
      country: link("libraries_country_lnk", "country_id"),
      region: link("libraries_region_lnk", "region_id"),
      area: link("libraries_area_lnk", "area_id"),
    },
  },
  "api::continent.continent": { tableName: "continents", attributes: {} },
  "api::country.country": { tableName: "countries", attributes: {} },
  "api::region.region": { tableName: "regions", attributes: {} },
  [SUBMISSION]: { tableName: "cm_submissions", attributes: {} },
}

/**
 * A recording knex stand-in: every builder call is logged per query and
 * `await` resolves to the canned rows for that table.
 */
function knexStub(rowsFor: (table: string) => unknown) {
  const queries: { table: string; ops: [string, unknown[]][] }[] = []
  const knex: any = (table: string) => {
    const entry = { table, ops: [] as [string, unknown[]][] }
    queries.push(entry)
    const builder: any = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then")
            return (
              res: (v: unknown) => unknown,
              rej?: (e: unknown) => unknown
            ) => Promise.resolve(rowsFor(table)).then(res, rej)

          return (...args: unknown[]) => {
            entry.ops.push([String(prop), args])

            return builder
          }
        },
      }
    )

    return builder
  }
  knex.raw = vi.fn((sql: string, bindings?: unknown[]) => ({ sql, bindings }))
  const ops = (i = 0) => queries[i]?.ops.map(([m]) => m) ?? []
  const args = (i: number, method: string) =>
    queries[i]?.ops.filter(([m]) => m === method).map(([, a]) => a) ?? []

  return { knex, queries, ops, args }
}

function postgres(
  seed: Record<string, any[]> = {},
  rowsFor: (table: string) => unknown = () => []
) {
  const faked = makeFakeStrapi(seed)
  const stub = knexStub(rowsFor)
  faked.strapi.db.dialect = { client: "postgres" }
  faked.strapi.db.metadata = { get: (uid: string) => META[uid] }
  faked.strapi.db.connection = stub.knex

  return { ...faked, ...stub }
}

/** Real `findMany` calls over the library table, across every handle. */
const libraryFindManyCalls = (strapi: any) =>
  strapi.documents.mock.calls.reduce(
    (n: number, [uid]: [string], i: number) =>
      uid === LIBRARY
        ? n + strapi.documents.mock.results[i].value.findMany.mock.calls.length
        : n,
    0
  )

describe("tallyLibrariesByChild (E4)", () => {
  it("on Postgres runs one grouped query over the link tables and never loads library rows", async () => {
    const { strapi, queries, ops, args, knex } = postgres({}, () => [
      { child_id: "regA", count: "3", lat: "51.5", lng: "-0.1" },
      { child_id: "regB", count: "1", lat: null, lng: null },
    ])

    const tallies = await tallyLibrariesByChild(strapi, {
      parent: "country",
      parentDocumentId: "gb",
      child: "region",
      locale: "en",
      status: "published",
    })

    expect(libraryFindManyCalls(strapi)).toBe(0)
    expect(queries).toHaveLength(1)
    expect(queries[0].table).toBe("libraries as l")
    expect(ops()).toContain("groupBy")
    expect(args(0, "groupBy")).toEqual([["c.document_id"]])
    // Full join tuples: a swapped link column would still name the same
    // tables but count the wrong rows.
    expect(args(0, "join")).toEqual(
      expect.arrayContaining([
        ["libraries_country_lnk as pl", "pl.library_id", "l.id"],
        ["countries as p", "p.id", "pl.country_id"],
        ["libraries_region_lnk as cl", "cl.library_id", "l.id"],
        ["regions as c", "c.id", "cl.region_id"],
      ])
    )
    expect(args(0, "where")).toEqual(
      expect.arrayContaining([
        ["p.document_id", "gb"],
        ["l.locale", "en"],
      ])
    )
    expect(ops()).toContain("whereNotNull")
    expect(
      knex.raw.mock.calls.some(([sql]: [string]) => /avg\(/.test(sql))
    ).toBe(true)
    expect(tallies.get("regA")).toEqual({
      count: 3,
      center: { lat: 51.5, lng: -0.1 },
    })
    expect(tallies.get("regB")).toEqual({ count: 1, center: null })
  })

  it("filters drafts with whereNull when status is draft", async () => {
    const { strapi, ops } = postgres()
    await tallyLibrariesByChild(strapi, {
      parent: "continent",
      parentDocumentId: "eu",
      child: "country",
      status: "draft",
    })

    expect(ops()).toContain("whereNull")
    expect(ops()).not.toContain("whereNotNull")
  })

  it("falls back to the Document Service on other dialects (sqlite)", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "l1",
          location: { lat: 1, lng: 2 },
          country: { documentId: "gb" },
          region: { documentId: "regA" },
        },
        {
          documentId: "l2",
          location: { lat: 3, lng: 4 },
          country: { documentId: "gb" },
          region: { documentId: "regA" },
        },
      ],
    })
    strapi.db.dialect = { client: "sqlite" }

    const tallies = await tallyLibrariesByChild(strapi, {
      parent: "country",
      parentDocumentId: "gb",
      child: "region",
      status: "published",
    })

    expect(libraryFindManyCalls(strapi)).toBe(1)
    expect(tallies.get("regA")).toEqual({
      count: 2,
      center: { lat: 2, lng: 3 },
    })
  })
})

describe("countLibrariesByType (E4)", () => {
  it("on Postgres groups by library_type in one query, largest first, zeros dropped", async () => {
    const { strapi, queries, ops, args } = postgres({}, () => [
      { type: "Public", count: "12" },
      { type: "Academic", count: "0" },
      { type: "National", count: "30" },
      { type: null, count: "2" },
    ])

    const counts = await countLibrariesByType(strapi, "country", "gb", {
      locale: "en",
      status: "published",
    })

    expect(libraryFindManyCalls(strapi)).toBe(0)
    expect(queries).toHaveLength(1)
    expect(args(0, "groupBy")).toEqual([["l.library_type"]])
    expect(args(0, "join")).toEqual(
      expect.arrayContaining([
        ["libraries_country_lnk as rl", "rl.library_id", "l.id"],
        ["countries as r", "r.id", "rl.country_id"],
      ])
    )
    expect(args(0, "where")).toEqual(
      expect.arrayContaining([
        ["r.document_id", "gb"],
        ["l.locale", "en"],
      ])
    )
    expect(ops()).toContain("whereNotNull")
    expect(counts).toEqual([
      { type: "National", count: 30 },
      { type: "Public", count: 12 },
    ])
  })

  it("falls back to per-type counts on other dialects", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "l1",
          libraryType: "Public",
          country: { documentId: "gb" },
        },
        {
          documentId: "l2",
          libraryType: "Public",
          country: { documentId: "gb" },
        },
        {
          documentId: "l3",
          libraryType: "National",
          country: { documentId: "gb" },
        },
      ],
    })
    strapi.db.dialect = { client: "sqlite" }

    const counts = await countLibrariesByType(strapi, "country", "gb", {
      status: "published",
    })

    expect(counts).toEqual([
      { type: "Public", count: 2 },
      { type: "National", count: 1 },
    ])
  })
})

describe("homepage.stats (E4)", () => {
  beforeEach(() => resetHomepageStatsCache())
  afterEach(() => resetHomepageStatsCache())

  function build() {
    const rowsFor = (table: string) =>
      table.startsWith("libraries_country_lnk")
        ? [{ countries: "42" }]
        : table.startsWith("cm_submissions")
          ? [{ contributors: "7" }]
          : []
    const faked = postgres(
      {
        [LIBRARY]: [
          { documentId: "l1", publishedAt: "2026-01-01" },
          { documentId: "l2", publishedAt: "2026-01-01" },
        ],
        [SUBMISSION]: [
          { documentId: "s1", status: "approved", createdAt: "2099-01-01" },
          { documentId: "s2", status: "pending", createdAt: "2099-01-01" },
          { documentId: "s3", status: "draft", createdAt: "2099-01-01" },
        ],
      },
      rowsFor
    )
    const ctrl = homepageFactory({
      strapi: {
        ...faked.strapi,
        contentType: () => ({ uid: "api::homepage.homepage" }),
      },
    } as any)

    return { ...faked, ctrl }
  }

  it("counts countries and contributors in the database, not by loading every row", async () => {
    const { ctrl, strapi, queries, args, ops, knex } = build()
    const c: any = {}
    await ctrl.stats(c)

    expect(libraryFindManyCalls(strapi)).toBe(0)
    // Only the "this month" count goes through the Document Service.
    const submissionHandles = strapi.documents.mock.calls
      .map(([uid]: [string], i: number) =>
        uid === SUBMISSION ? strapi.documents.mock.results[i].value : null
      )
      .filter(Boolean)
    expect(submissionHandles).toHaveLength(1)
    expect(submissionHandles[0].findMany).not.toHaveBeenCalled()
    expect(submissionHandles[0].count).toHaveBeenCalledTimes(1)

    expect(queries.map((q) => q.table)).toEqual([
      "libraries_country_lnk as cl",
      "cm_submissions",
    ])
    expect(args(0, "join").map((a) => a[0])).toEqual(["libraries as l"])
    expect(ops(0)).toContain("whereNotNull")
    expect(args(1, "where")).toEqual([["status", "approved"]])
    const raws = knex.raw.mock.calls.map(([sql]: [string]) => sql)
    expect(raws.some((s) => /count\(distinct cl\.country_id\)/i.test(s))).toBe(
      true
    )
    expect(
      raws.some((s) =>
        /count\(distinct coalesce\(submitted_by_user_id, lower\(submitted_by_email\)\)\)/i.test(
          s
        )
      )
    ).toBe(true)

    expect(c.body.data).toEqual({
      libraries: 2,
      countries: 42,
      contributors: 7,
      contributionsThisMonth: 2,
    })
  })

  it("memoises the stats for five minutes", async () => {
    const { ctrl, queries } = build()
    await ctrl.stats({})
    await ctrl.stats({})

    expect(queries).toHaveLength(2)
  })
})

describe("auth-bridge.affiliationCount (E4)", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("counts through a relation filter instead of loading every affiliation", async () => {
    const { strapi } = makeFakeStrapi({
      [AFF]: [
        {
          documentId: "a1",
          baUserId: "u1",
          library: { entityRef: "GB-BL-001" },
        },
        {
          documentId: "a2",
          baUserId: "u2",
          library: { entityRef: "GB-BL-001" },
        },
        {
          documentId: "a3",
          baUserId: "u3",
          library: { entityRef: "GB-XX-002" },
        },
      ],
    })
    ;(globalThis as any).strapi = strapi
    const c: any = {
      query: { entityRef: "GB-BL-001" },
      request: { header: { "x-service-secret": "s3cret" } },
      send: (b: unknown) => (c.body = b),
    }
    await controller.affiliationCount(c)

    expect(c.body).toEqual({ count: 2 })
    expect(strapi.db.query).not.toHaveBeenCalled()
    const i = strapi.documents.mock.calls.findIndex(
      ([u]: [string]) => u === AFF
    )
    const { count } = strapi.documents.mock.results[i].value
    expect(count.mock.calls[0][0].filters).toEqual({
      library: { entityRef: { $eq: "GB-BL-001" } },
    })
  })
})

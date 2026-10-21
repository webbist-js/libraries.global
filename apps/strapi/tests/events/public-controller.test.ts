import { describe, expect, it, vi } from "vitest"

import eventsControllerFactory from "../../src/plugins/events/server/controllers/events"
import {
  PUBLIC_EVENT_FIELDS,
  PUBLIC_EVENT_STATUSES,
} from "../../src/plugins/events/server/utils/query"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const EVENT = "plugin::events.event"
const LIBRARY = "api::library.library"

const future = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

function seedStrapi() {
  const base = {
    sourceProvider: "ical",
    credentialId: 7,
    syncHash: "secret-hash",
    externalId: "ext-1",
    libraryEntityRef: "GB-MCL-001",
    title: "Reading Group",
    url: "https://example.com/e/1",
    startTime: future(2),
    endTime: future(2),
    timezone: "Europe/London",
    eventType: "book_club",
    isFree: true,
    status: "upcoming",
    pendingReview: false,
    importedAt: future(-1),
    lastSeenAt: future(-1),
  }
  const fake = makeFakeStrapi(
    {
      [EVENT]: [
        { ...base, documentId: "pub000000000000000000001" },
        {
          ...base,
          documentId: "pend0000000000000000001",
          externalId: "ext-2",
          pendingReview: true,
        },
        {
          ...base,
          documentId: "canc0000000000000000001",
          externalId: "ext-3",
          status: "cancelled",
        },
      ],
      [LIBRARY]: [
        {
          documentId: "lib00000000000000000001",
          entityRef: "GB-MCL-001",
          name: "Manchester",
        },
      ],
    },
    { tables: { ev_events: EVENT, libraries: LIBRARY } }
  )
  fake.strapi.db.dialect = { client: "postgres" }

  return fake
}

/** Every findMany call made on `uid`, in order. */
const findManyCalls = (strapi: any, uid: string) =>
  strapi.documents.mock.results
    .filter((r: any, i: number) => strapi.documents.mock.calls[i][0] === uid)
    .flatMap((r: any) => r.value.findMany.mock.calls.map((c: any[]) => c[0]))

const ctxFor = (
  query: Record<string, unknown> = {},
  params: Record<string, string> = {}
) => ({
  query,
  params,
  body: undefined as unknown,
  status: 200,
  notFound: vi.fn(),
  set: vi.fn(),
})

describe("public events controller", () => {
  it.each([
    "providerBreakdown",
    "topLibraries",
    "categoryBreakdown",
    "dailyVolume",
    "heatmap",
  ] as const)("%s aggregates apply public visibility", async (handler) => {
    const { strapi } = seedStrapi()
    const connection = strapi.db.connection
    const predicates: unknown[][] = []
    const wrapped = vi.fn((...args: unknown[]) => {
      const builder = connection(...args)
      builder.orderBy = () => builder
      builder.limit = () => builder
      builder.groupByRaw = () => builder
      const whereIn = builder.whereIn
      builder.whereIn = (...values: unknown[]) => {
        predicates.push(values)

        return whereIn(...values)
      }

      return builder
    })
    Object.assign(wrapped, { raw: (sql: string) => sql })
    strapi.db.connection = wrapped
    const ctx = ctxFor()
    await eventsControllerFactory({ strapi })[handler](ctx)
    expect(predicates).toContainEqual(["status", [...PUBLIC_EVENT_STATUSES]])
    expect(ctx.status).toBe(200)
  })
  it("country analytics joins current geographic relations and counts only public events", async () => {
    const joins: unknown[][] = []
    const whereIn = vi.fn()
    const query: Record<string, unknown> = {}
    for (const method of [
      "select",
      "countDistinct",
      "where",
      "whereNotNull",
      "groupBy",
      "orderBy",
    ])
      query[method] = vi.fn(() => query)
    query.join = (...args: unknown[]) => {
      joins.push(args)

      return query
    }
    query.whereIn = (...args: unknown[]) => {
      whereIn(...args)

      return query
    }
    // Model the Knex query builder’s awaitable result.
    // eslint-disable-next-line unicorn/no-thenable
    query.then = (resolve: (rows: unknown[]) => unknown) =>
      Promise.resolve([{ countryCode: "GB", count: "3" }]).then(resolve)
    const metadata = {
      [EVENT]: {
        tableName: "ev_events",
        attributes: {
          library: {
            joinTable: {
              name: "event_library_link",
              joinColumn: { name: "event_id" },
              inverseJoinColumn: { name: "library_id" },
            },
          },
        },
      },
      [LIBRARY]: {
        tableName: "libraries",
        attributes: {
          country: {
            joinTable: {
              name: "library_country_link",
              joinColumn: { name: "library_id" },
              inverseJoinColumn: { name: "country_id" },
            },
          },
        },
      },
      "api::country.country": {
        tableName: "countries",
        attributes: { iso2: { columnName: "iso_2" } },
      },
    }
    const strapi = {
      db: {
        connection: () => query,
        metadata: { get: (uid: keyof typeof metadata) => metadata[uid] },
      },
      log: { error: vi.fn() },
    }
    const ctx = ctxFor()
    await eventsControllerFactory({ strapi }).countryBreakdown(ctx)
    expect(query.select).toHaveBeenCalledWith("country.iso_2 as countryCode")
    expect(query.groupBy).toHaveBeenCalledWith("country.iso_2")
    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual([{ countryCode: "GB", count: 3 }])
    expect(joins).toHaveLength(4)
    expect(joins[2]).toEqual([
      "library_country_link as lc",
      "lc.library_id",
      "library.id",
    ])
    expect(whereIn).toHaveBeenCalledWith("event.status", [
      "upcoming",
      "ongoing",
    ])
    expect(query.whereNotNull).toHaveBeenCalledWith("library.published_at")
  })
  it("reports failed analytics as unavailable instead of zero", async () => {
    const { strapi } = seedStrapi()
    strapi.db.connection = () => {
      throw new Error("offline")
    }
    const ctx = ctxFor()
    await eventsControllerFactory({ strapi }).categoryBreakdown(ctx)
    expect(ctx.status).toBe(503)
    expect(ctx.body).toEqual({ error: "Event analytics unavailable" })
  })
  it("library: public filters, bounded start/limit, stable sort, safe fields, array type ignored", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })
    const ctx = ctxFor(
      { limit: "5", page: "2", type: ["talk"], isFree: "true" },
      { entityRef: "GB-MCL-001" }
    )

    await controller.library(ctx)

    const [call] = findManyCalls(strapi, EVENT)
    expect(call.filters).toMatchObject({
      libraryEntityRef: "GB-MCL-001",
      pendingReview: false,
      status: { $in: PUBLIC_EVENT_STATUSES },
      isFree: true,
    })
    expect(call.filters.eventType).toBeUndefined()
    expect(call).not.toHaveProperty("pagination")
    expect(call.start).toBe(5)
    expect(call.limit).toBe(5)
    expect(call.sort).toEqual(["startTime:asc", "id:asc"])
    expect(call.fields).toEqual(PUBLIC_EVENT_FIELDS)
    // page 2 of a one-row store is empty (the fake pages by start/limit)
    expect(ctx.body).toEqual([])

    const first = ctxFor({ limit: "5", page: "1" }, { entityRef: "GB-MCL-001" })
    await controller.library(first)
    expect((first.body as any[]).map((e) => e.documentId)).toEqual([
      "pub000000000000000000001",
    ])
  })

  it("library: limit is capped and a non-numeric page falls back", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })
    await controller.library(
      ctxFor({ limit: "99999", page: "abc" }, { entityRef: "GB-MCL-001" })
    )
    const [call] = findManyCalls(strapi, EVENT)
    expect(call.limit).toBe(100)
    expect(call.start).toBe(0)
  })

  it("event: a pending or cancelled event is not found; a public one comes back with public fields only", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })

    const pending = ctxFor({}, { documentId: "pend0000000000000000001" })
    await controller.event(pending)
    expect(pending.notFound).toHaveBeenCalled()

    const ok = ctxFor({}, { documentId: "pub000000000000000000001" })
    await controller.event(ok)
    expect(ok.notFound).not.toHaveBeenCalled()
    expect((ok.body as any).documentId).toBe("pub000000000000000000001")
    const [, call] = findManyCalls(strapi, EVENT)
    expect(call.fields).toEqual(PUBLIC_EVENT_FIELDS)
    expect(call.filters).toMatchObject({ pendingReview: false })
  })

  it("relatedEvents: excludes the source and applies the public filters", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })
    const ctx = ctxFor({}, { documentId: "pub000000000000000000001" })
    await controller.relatedEvents(ctx)
    const calls = findManyCalls(strapi, EVENT)
    const related = calls.at(-1)
    expect(related.filters).toMatchObject({
      pendingReview: false,
      status: { $in: PUBLIC_EVENT_STATUSES },
      documentId: { $ne: "pub000000000000000000001" },
      libraryEntityRef: "GB-MCL-001",
    })
    expect(related.limit).toBe(4)
    expect(related).not.toHaveProperty("pagination")
    expect(related.fields).toEqual(PUBLIC_EVENT_FIELDS)
  })

  it("global: array type and garbage dates do not crash, and the count also excludes pending events", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })
    const ctx = ctxFor({
      type: ["talk"],
      from: "garbage",
      to: "also-garbage",
      limit: "5",
    })

    await controller.global(ctx)

    const [call] = findManyCalls(strapi, EVENT)
    expect(call.filters.eventType).toBeUndefined()
    expect(call.filters.startTime.$gte).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(call.filters.startTime.$lte).toBeUndefined()
    expect(call.filters.pendingReview).toBe(false)
    expect(call.limit).toBe(5)
    expect(call).not.toHaveProperty("pagination")
    expect(ctx.body).toMatchObject({ page: 1, pageSize: 5 })
    expect(typeof (ctx.body as any).total).toBe("number")
  })

  it("global: a comma list of types becomes an $in filter", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })
    await controller.global(ctxFor({ type: "talk,workshop" }))
    const [call] = findManyCalls(strapi, EVENT)
    expect(call.filters.eventType).toEqual({ $in: ["talk", "workshop"] })
  })

  it("scopes geographic results and totals through direct published library relations beyond 500 libraries", async () => {
    const library = (
      country: string,
      region: string,
      publishedAt: string | null = future(-1)
    ) => ({
      name: "A library",
      slug: "a-library",
      publishedAt,
      country: { iso2: country },
      region: { slug: region },
    })
    const base = {
      title: "Public event",
      startTime: future(2),
      pendingReview: false,
      status: "upcoming",
    }
    const { strapi } = makeFakeStrapi({
      [EVENT]: [
        ...Array.from({ length: 600 }, (_, i) => ({
          ...base,
          documentId: `gb-${i}`,
          library: library("GB", "england"),
        })),
        { ...base, documentId: "gb-scot", library: library("GB", "scotland") },
        { ...base, documentId: "cz", library: library("CZ", "prague") },
        {
          ...base,
          documentId: "draft-lib",
          library: library("GB", "england", null),
        },
        {
          ...base,
          documentId: "cancelled",
          status: "cancelled",
          library: library("GB", "england"),
        },
      ],
    })
    const controller = eventsControllerFactory({ strapi })
    const england = ctxFor({
      countryCode: "gb",
      regionSlug: "england",
      page: "6",
      limit: "100",
    })
    await controller.global(england)
    expect(england.body).toMatchObject({ total: 600, page: 6, pageSize: 100 })
    expect(
      (england.body as { events: { documentId: string }[] }).events
    ).toHaveLength(100)
    expect(
      (england.body as { events: { documentId: string }[] }).events.every(
        (event) => event.documentId.startsWith("gb-")
      )
    ).toBe(true)
    const czech = ctxFor({ countryCode: "CZ", regionSlug: "prague" })
    await controller.global(czech)
    expect(
      (czech.body as { events: { documentId: string }[] }).events.map(
        (event) => event.documentId
      )
    ).toEqual(["cz"])
    expect((czech.body as { total: number }).total).toBe(1)
    const empty = ctxFor({ countryCode: "CZ", regionSlug: "england" })
    await controller.global(empty)
    expect(empty.body).toMatchObject({ events: [], total: 0 })
    const legacy = ctxFor({ region: "prague" })
    await controller.location(legacy)
    expect(
      (legacy.body as { documentId: string }[]).map((event) => event.documentId)
    ).toEqual(["cz"])
    expect(findManyCalls(strapi, LIBRARY)).toHaveLength(0)
  })

  it("icsLibrary and icsGlobal only publish public events", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })

    const lib = ctxFor({}, { entityRef: "GB-MCL-001" })
    await controller.icsLibrary(lib)
    const [libCall] = findManyCalls(strapi, EVENT)
    expect(libCall.filters).toMatchObject({
      pendingReview: false,
      status: { $in: PUBLIC_EVENT_STATUSES },
    })
    expect(libCall).not.toHaveProperty("pagination")
    expect(String(lib.body)).toContain(
      "UID:pub000000000000000000001@libraries.global"
    )
    expect(String(lib.body)).not.toContain("pend0000000000000000001")
    expect(String(lib.body)).not.toContain("canc0000000000000000001")

    const glob = ctxFor()
    await controller.icsGlobal(glob)
    const globCall = findManyCalls(strapi, EVENT).at(-1)
    expect(globCall.filters).toMatchObject({ pendingReview: false })
  })
})

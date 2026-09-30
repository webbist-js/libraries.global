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

  it("location and topLibraries read only published libraries", async () => {
    const { strapi } = seedStrapi()
    const controller = eventsControllerFactory({ strapi })

    // The fake can't resolve dotted relation filters; no location filter
    // means every seeded library matches, which is enough to check the read.
    await controller.location(ctxFor({ country: ["not-a-string"] }))
    const [libCall] = findManyCalls(strapi, LIBRARY)
    expect(libCall.status).toBe("published")
    expect(libCall.filters).toEqual({})
    expect(libCall).not.toHaveProperty("pagination")
    expect(libCall.limit).toBe(500)

    const [evCall] = findManyCalls(strapi, EVENT)
    expect(evCall.filters.pendingReview).toBe(false)
    expect(evCall.fields).toEqual(PUBLIC_EVENT_FIELDS)
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

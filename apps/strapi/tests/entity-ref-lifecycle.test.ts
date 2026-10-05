import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { registerEntityRefSubscriber } from "../src/lifeCycles/entityRef"
import { computeGaps } from "../src/utils/library-completeness"

const LIBRARY = "api::library.library"
const REGION = "api::region.region"

function build(seed: Record<string, any[]>) {
  const faked = makeFakeStrapi(seed)
  let hooks: any = null
  faked.strapi.db.lifecycles = { subscribe: vi.fn((h: any) => (hooks = h)) }
  registerEntityRefSubscriber({ strapi: faked.strapi })
  const documentCalls = (uid: string, method: string) =>
    faked.strapi.documents.mock.calls.flatMap(([u]: [string], i: number) =>
      u === uid
        ? faked.strapi.documents.mock.results[i].value[method].mock.calls.map(
            (c: any[]) => c[0]
          )
        : []
    )
  const rowUpdates = (uid: string) =>
    faked.strapi.db.query.mock.calls.flatMap(([u]: [string], i: number) =>
      u === uid
        ? faked.strapi.db.query.mock.results[i].value.update.mock.calls.map(
            (c: any[]) => c[0]
          )
        : []
    )

  return { ...faked, hooks: () => hooks, documentCalls, rowUpdates }
}

const libraryFields = {
  id: 1,
  documentId: "l1",
  slug: "old",
  entityRef: "europe:gb:eng:old",
  completeness: 13,
  website: "https://a.example",
  continent: { slug: "europe" },
  country: { slug: "gb" },
  region: { slug: "eng" },
  publishedAt: null,
}
// Gaps already match the fields above, so a write that doesn't change them
// doesn't trigger a store (mirrors the real row once backfilled).
const library = { ...libraryFields, gaps: computeGaps(libraryFields) }

describe("entityRef lifecycle guards (E5)", () => {
  it("ignores its own entityRef and completeness writes", async () => {
    const { hooks, strapi } = build({ [LIBRARY]: [library] })
    for (const data of [
      { entityRef: "x", updatedAt: "now" },
      { completeness: 50 },
    ]) {
      await hooks().afterUpdate({
        model: { uid: LIBRARY },
        result: { ...library },
        params: { data },
      })
    }

    expect(strapi.documents).not.toHaveBeenCalled()
    expect(strapi.db.query).not.toHaveBeenCalled()
  })

  it("recomputes the ref only when slug or a location relation is written", async () => {
    const { hooks, documentCalls } = build({ [LIBRARY]: [library] })
    await hooks().afterUpdate({
      model: { uid: LIBRARY },
      result: { ...library },
      params: { data: { name: "Renamed" } },
    })
    expect(documentCalls(LIBRARY, "findOne")).toHaveLength(0)

    await hooks().afterUpdate({
      model: { uid: LIBRARY },
      result: { ...library, slug: "new" },
      params: { data: { slug: "new" } },
    })
    const refUpdates = documentCalls(LIBRARY, "update")
    expect(refUpdates).toHaveLength(0) // the fake row still has slug "old"
    expect(documentCalls(LIBRARY, "findOne").length).toBeGreaterThan(0)
  })

  it("stores a changed completeness on the written row, by id", async () => {
    const { hooks, rowUpdates } = build({ [LIBRARY]: [library] })
    await hooks().afterUpdate({
      model: { uid: LIBRARY },
      result: { ...library },
      params: { data: { website: "https://a.example" } },
    })

    // One of eight sections (contact) is filled: 13 → no write, and gaps
    // already match the row's fields. Now fill another and both change.
    expect(rowUpdates(LIBRARY)).toEqual([])
    const addressedFields = { ...libraryFields, streetAddress: "1 High St" }
    const { hooks: hooks2, rowUpdates: rowUpdates2 } = build({
      [LIBRARY]: [{ ...library, streetAddress: "1 High St" }],
    })
    await hooks2().afterUpdate({
      model: { uid: LIBRARY },
      result: { ...library },
      params: { data: { streetAddress: "1 High St" } },
    })
    expect(rowUpdates2(LIBRARY)).toEqual([
      {
        where: { id: 1 },
        data: { completeness: 25, gaps: computeGaps(addressedFields) },
      },
    ])
  })

  it("refreshes a region's libraries only when its slug really changed", async () => {
    const seed = {
      [REGION]: [{ id: 7, documentId: "eng", slug: "england" }],
      [LIBRARY]: [
        { ...library, region: { documentId: "eng", slug: "england" } },
        {
          ...library,
          id: 2,
          documentId: "l2",
          region: { documentId: "other", slug: "x" },
        },
      ],
    }
    const same = build(seed)
    const event: any = {
      model: { uid: REGION },
      params: { where: { id: 7 }, data: { slug: "england", name: "England" } },
      state: {},
    }
    await same.hooks().beforeUpdate(event)
    await same.hooks().afterUpdate({
      ...event,
      result: { id: 7, documentId: "eng", slug: "england" },
    })
    expect(
      same.documentCalls(LIBRARY, "findMany").filter((p) => p.filters?.region)
    ).toHaveLength(0)

    const changed = build(seed)
    const event2: any = {
      model: { uid: REGION },
      params: { where: { id: 7 }, data: { slug: "england-new" } },
      state: {},
    }
    await changed.hooks().beforeUpdate(event2)
    expect(event2.state.previousSlug).toBe("england")
    await changed.hooks().afterUpdate({
      ...event2,
      result: { id: 7, documentId: "eng", slug: "england-new" },
    })
    const pages = changed
      .documentCalls(LIBRARY, "findMany")
      .filter((p) => p.filters?.region)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({
      filters: { region: { documentId: { $eq: "eng" } } },
      start: 0,
      limit: 200,
      sort: "id:asc",
    })
    // Only the library in that region had its ref recomputed.
    expect(
      changed.documentCalls(LIBRARY, "findOne").map((p) => p.documentId)
    ).toEqual(["l1"])
  })
})

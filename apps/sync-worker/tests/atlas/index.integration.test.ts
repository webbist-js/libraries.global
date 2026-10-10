import { createRequire } from "node:module"
import path from "node:path"

import { projectAtlasLibrary, type AtlasLibrarySource } from "@repo/shared-data"
import knex, { type Knex } from "knex"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { AtlasMeiliIndex } from "../../src/atlas/meili-index"
import { AtlasIndexRebuild } from "../../src/atlas/rebuild-index"
import { AtlasStore } from "../../src/atlas/store"

describe.skipIf(
  !process.env.ATLAS_TEST_DATABASE_URL || !process.env.ATLAS_TEST_MEILI_URL
)("Atlas index recovery on real PostgreSQL + Meili", () => {
  let db: Knex, store: AtlasStore, index: AtlasMeiliIndex, token: string
  beforeAll(async () => {
    const database = new URL(process.env.ATLAS_TEST_DATABASE_URL!),
      search = new URL(process.env.ATLAS_TEST_MEILI_URL!)
    if (
      database.hostname !== "127.0.0.1" ||
      database.port !== "15432" ||
      database.pathname !== "/atlas_test" ||
      search.origin !== "http://127.0.0.1:17700"
    )
      throw new Error("Use isolated local Atlas fixtures")
    db = knex({
      client: "pg",
      connection: database.toString(),
      pool: { min: 0, max: 4 },
    })
    const require = createRequire(path.resolve("package.json"))
    await require("../strapi/database/migrations/2026.10.08T00.00.00.atlas-projection.js").up(
      db
    )
  })
  afterAll(async () => {
    await db?.destroy()
  })
  beforeEach(async () => {
    await db.raw(
      "TRUNCATE atlas_changes, atlas_index_batches, atlas_outbox, atlas_records RESTART IDENTITY CASCADE"
    )
    await db("atlas_state").where({ key: "current" }).update({
      projection_revision: "0",
      indexed_through: "0",
      lease_token: null,
      lease_until: null,
      rebuild: null,
      backfill: null,
    })
    store = new AtlasStore(db, "index-fixture")
    token = (await store.acquire())!
    index = new AtlasMeiliIndex(
      store,
      process.env.ATLAS_TEST_MEILI_URL!,
      "atlas-test-local-only"
    )
    const indexes = await index.request("/indexes?limit=100")
    for (const row of indexes.results)
      if (
        row.uid === index.index ||
        /^atlas-library-staging-[a-f0-9-]{36}$/.test(row.uid)
      ) {
        const task = await index.request(`/indexes/${row.uid}`, "DELETE")
        await index.wait(task.taskUid)
      }
    await index.ensure(token)
  })
  async function put(id: string, name: string | null) {
    await db("atlas_outbox").insert({ kind: "document", entity_id: id })
    const jobs = await store.claim(token),
      ids = await store.allocate(token, [id])
    const source: AtlasLibrarySource | null =
      name === null
        ? null
        : {
            documentId: id,
            name,
            slug: id,
            locale: "en",
            published: true,
            location: { lat: 51.5, lng: -0.1 },
          }
    const projection = source
      ? projectAtlasLibrary(source, {
          atlasId: ids.get(id)!,
          canonicalLocale: "en",
          now: new Date("2026-10-08T12:00:00Z"),
        })
      : null
    await store.apply(
      token,
      jobs,
      new Map([[id, projection]]),
      new Map([[id, source]])
    )
  }
  it("advances only contiguous successful batches and removes tombstones", async () => {
    await put("one", "One")
    await put("two", "Two")
    await put("one", null)
    while (await index.flush(token)) {
      /* drain accepted tasks */
    }
    expect((await db("atlas_state").first()).indexed_through).toBe("3")
    const results = await index.request(
      `/indexes/${index.index}/search`,
      "POST",
      { filter: 'locale = "en"', facets: ["locale"] }
    )
    expect(results.hits.map((hit: any) => hit.documentId)).toEqual(["two"])
    expect(results.facetDistribution.locale.en).toBe(1)
  })
  it("resumes a submitted task after a worker failure", async () => {
    await put("one", "One")
    const wait = vi
      .spyOn(index, "wait")
      .mockRejectedValueOnce(new Error("task pending; will resume"))
    await expect(index.flush(token)).rejects.toThrow("task pending")
    wait.mockRestore()
    const batch = await db("atlas_index_batches").first()
    expect(batch.task_ids.upserts).toEqual(expect.any(Number))
    expect((await db("atlas_state").first()).indexed_through).toBe("0")
    await db("atlas_index_batches").update({ not_before: new Date(0) })
    const resumed = new AtlasMeiliIndex(
      store,
      process.env.ATLAS_TEST_MEILI_URL!,
      "atlas-test-local-only"
    )
    expect(await resumed.flush(token)).toBe(true)
    expect((await db("atlas_state").first()).indexed_through).toBe("1")
  })
  it("keeps a failed task pending instead of advancing its watermark", async () => {
    await put("one", "One")
    await db("atlas_index_batches").update({
      payload: JSON.stringify({
        upserts: [{ name: "Missing primary key" }],
        removedIds: [],
      }),
    })
    await expect(index.flush(token)).rejects.toThrow("failed")
    expect((await db("atlas_state").first()).indexed_through).toBe("0")
    expect(await db("atlas_index_batches").first()).toMatchObject({
      attempts: 1,
      completed_at: null,
      task_ids: {},
    })
  })
  it("rebuilds in staging, replays concurrent changes and recovers an unrecorded swap", async () => {
    await put("one", "One")
    await put("two", "Two")
    while (await index.flush(token)) {
      /* drain accepted tasks */
    }
    const oldEpoch = (await db("atlas_state").first()).query_epoch
    const rebuild = new AtlasIndexRebuild(store, index)
    await rebuild.begin(token)
    await put("one", "One renamed")
    await put("two", null)
    await put("three", "Three")
    for (let step = 0; step < 20; step++) {
      if (!(await rebuild.step(token))) break
    }
    const state = await db("atlas_state").first()
    expect(state.rebuild.phase).toBe("complete")
    expect(state.query_epoch).not.toBe(oldEpoch)
    const results = await index.request(
      `/indexes/${index.index}/search`,
      "POST",
      { filter: 'locale = "en"', facets: ["locale"] }
    )
    expect(new Set(results.hits.map((hit: any) => hit.name))).toEqual(
      new Set(["One renamed", "Three"])
    )
    const checkpoint = { ...state.rebuild, phase: "swap", writerPaused: true }
    delete checkpoint.swapTask
    await db("atlas_state").update({
      query_epoch: oldEpoch,
      rebuild: JSON.stringify(checkpoint),
    })
    expect(await new AtlasIndexRebuild(store, index).step(token)).toBe(false)
    expect((await db("atlas_state").first()).query_epoch).toBe(
      state.query_epoch
    )
    expect(
      (
        await index.request(`/indexes/${index.index}/search`, "POST", {
          filter: 'locale = "en"',
          facets: ["locale"],
        })
      ).facetDistribution.locale.en
    ).toBe(2)
  })
})

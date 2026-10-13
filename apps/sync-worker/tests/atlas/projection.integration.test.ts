import { createRequire } from "node:module"
import path from "node:path"

import { projectAtlasLibrary, type AtlasLibrarySource } from "@repo/shared-data"
import knex, { type Knex } from "knex"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  AtlasLeaseLost,
  AtlasStore,
  mergeAtlasDictionary,
} from "../../src/atlas/store"

const source = (
  name = "Library",
  location: { lat: number; lng: number } | undefined = undefined
): AtlasLibrarySource => ({
  documentId: "library-one",
  name,
  location: location ?? { lat: 51.5, lng: -0.1 },
  slug: "library-one",
  locale: "en",
  published: true,
  openingTimes: null,
})
describe.skipIf(!process.env.ATLAS_TEST_DATABASE_URL)(
  "Atlas durable projection on real PostgreSQL",
  () => {
    let db: Knex, store: AtlasStore, token: string
    beforeAll(async () => {
      const url = new URL(process.env.ATLAS_TEST_DATABASE_URL!)
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        url.port !== "15432" ||
        url.pathname !== "/atlas_test"
      )
        throw new Error("Use the isolated local Atlas test DB")
      db = knex({
        client: "pg",
        connection: url.toString(),
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
      await db("atlas_state")
        .where({ key: "current" })
        .update({
          projection_revision: "0",
          indexed_through: "0",
          lease_token: null,
          lease_until: null,
          dictionary: JSON.stringify({ version: "initial", entries: [] }),
        })
      store = new AtlasStore(db, "integration-fixture")
      token = (await store.acquire())!
    })
    async function project(row: AtlasLibrarySource | null) {
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "library-one",
      })
      const jobs = await store.claim(token),
        ids = await store.allocate(token, ["library-one"])
      const projection = row
        ? projectAtlasLibrary(row, {
            atlasId: ids.get("library-one")!,
            canonicalLocale: "en",
            now: new Date("2026-10-08T12:00:00Z"),
          })
        : null
      await store.apply(
        token,
        jobs,
        new Map([["library-one", projection]]),
        new Map([["library-one", row]])
      )

      return ids.get("library-one")!
    }
    it("persists stable IDs, ordered revisions and tombstones through republish", async () => {
      const id = await project(source())
      await project(source()) // JSONB ordering must not manufacture a revision.
      expect(await db("atlas_changes").count("* as n").first()).toMatchObject({
        n: "1",
      })
      await project(source("Moved", { lat: -33, lng: 151 }))
      await project(null)
      expect(await project(source())).toBe(id)
      const changes = await db("atlas_changes").orderBy("revision")
      expect(changes.map((change) => change.revision)).toEqual([
        "1",
        "2",
        "3",
        "4",
      ])
      expect(changes[1]).toMatchObject({ old_lat: 51.5, new_lat: -33 })
      expect(changes[2]).toMatchObject({ removed: true, new_projection: null })
      expect(
        await db("atlas_index_batches").select(
          "from_revision",
          "through_revision"
        )
      ).toHaveLength(4)
    })
    it("finishes only claimed jobs and leaves a later mutation pending", async () => {
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "library-one",
      })
      const jobs = await store.claim(token),
        ids = await store.allocate(token, ["library-one"])
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "library-one",
      })
      const row = source(),
        projection = projectAtlasLibrary(row, {
          atlasId: ids.get(row.documentId)!,
          canonicalLocale: "en",
          now: new Date(),
        })
      await store.apply(
        token,
        jobs,
        new Map([[row.documentId, projection]]),
        new Map([[row.documentId, row]])
      )
      expect(await db("atlas_outbox").whereNull("finished_at")).toHaveLength(1)
    })
    it("fences a dead worker after takeover and recovers its expired claim", async () => {
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "library-one",
      })
      await store.claim(token)
      expect(await new AtlasStore(db, "other").acquire()).toBeNull()
      await db("atlas_state").update({ lease_until: new Date(0) })
      await db("atlas_outbox").update({ claim_until: new Date(0) })
      const replacement = (await new AtlasStore(db, "other").acquire())!
      await expect(
        store.allocate(token, ["library-one"])
      ).rejects.toBeInstanceOf(AtlasLeaseLost)
      await expect(store.renew(token)).rejects.toBeInstanceOf(AtlasLeaseLost)
      expect(await store.claim(replacement)).toHaveLength(1)
    })
    it("persists bounded retries without dropping failed jobs", async () => {
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "library-one",
        attempts: 10,
      })
      const jobs = await store.claim(token)
      await store.fail(token, jobs, new Error("source unavailable"))
      const row = await db("atlas_outbox").first()
      expect(row).toMatchObject({
        attempts: 11,
        finished_at: null,
        claimed_by: null,
        last_error: "source unavailable",
      })
      expect(
        new Date(row.not_before).getTime() - Date.now()
      ).toBeLessThanOrEqual(60000)
      expect(await store.claim(token)).toHaveLength(0)
    })
    it("fans out by owned previous projection in bounded keyset pages", async () => {
      await db("atlas_records").insert(
        Array.from({ length: 501 }, (_, i) => ({
          document_id: `fanout-${i}`,
          active: true,
          projection: JSON.stringify({ country_id: "country-old" }),
        }))
      )
      await db("atlas_outbox").insert({
        kind: "fanout",
        entity_id: "country-old",
        payload: JSON.stringify({ field: "country_id" }),
      })
      const jobs = await store.claim(token)
      expect(await store.fanout(token, jobs[0])).toBe(500)
      const continued = (await store.claim(token)).find(
        (job) => job.kind === "fanout"
      )!
      expect(await store.fanout(token, continued)).toBe(1)
      expect(
        (
          await db("atlas_outbox")
            .where({ kind: "document" })
            .count("* as n")
            .first()
        )?.n
      ).toBe("501")
    })
    it("schedules an overdue clock once and catches it up after projection", async () => {
      await project(source())
      await db("atlas_records").update({ clock_due: new Date(0) })
      expect(await store.clocks(token)).toBe(1)
      expect(await store.clocks(token)).toBe(0)
      const jobs = await store.claim(token)
      await store.apply(
        token,
        jobs,
        new Map([["library-one", null]]),
        new Map([["library-one", null]])
      )
      expect(await db("atlas_records").first()).toMatchObject({
        clock_queued: false,
        clock_due: null,
      })
    })
  }
)

describe("retained facility dictionary", () => {
  it("retains former names across rename and deletion", () => {
    const a = mergeAtlasDictionary({ version: "initial", entries: [] }, [
      { ...source(), amenities: [{ documentId: "wifi", name: "Wi-Fi" }] },
    ])
    const b = mergeAtlasDictionary(a, [
      { ...source(), amenities: [{ documentId: "wifi", name: "Wireless" }] },
    ])
    expect(b.entries).toEqual([
      {
        code: "amenity:wifi",
        kind: "amenity",
        name: "Wireless",
        aliases: ["Wi-Fi"],
      },
    ])
    expect(mergeAtlasDictionary(b, [])).toBe(b)
  })
})

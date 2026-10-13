import { createRequire } from "node:module"
import path from "node:path"

import { projectAtlasLibrary, type AtlasLibrarySource } from "@repo/shared-data"
import knex, { type Knex } from "knex"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  atlasArchivePage,
  atlasChanges,
  atlasExportJournal,
  parseAtlasChangeRequest,
} from "../../../strapi/src/utils/atlas-read-store"
import { AtlasStore } from "../../src/atlas/store"

describe.skipIf(!process.env.ATLAS_TEST_DATABASE_URL)(
  "Atlas reconciliation from the real durable journal",
  () => {
    let db: Knex, store: AtlasStore, token: string
    beforeAll(async () => {
      const url = new URL(process.env.ATLAS_TEST_DATABASE_URL!)
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "15432" ||
        url.pathname !== "/atlas_test"
      )
        throw new Error("Use the isolated Atlas fixture")
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
          journal_floor: "0",
          lease_until: null,
          lease_token: null,
          rebuild: null,
        })
      const state = await db("atlas_state").first()
      await db("atlas_state").update({
        manifest: JSON.stringify({
          buildId: "fixture",
          builtAgainstQueryEpoch: state.query_epoch,
          sourceStartRevision: "0",
          sourceEndRevision: "0",
        }),
      })
      store = new AtlasStore(db, "change-fixture")
      token = (await store.acquire())!
    })
    async function put(
      location: { lat: number; lng: number } | null,
      name = "Library"
    ) {
      await db("atlas_outbox").insert({ kind: "document", entity_id: "one" })
      const jobs = await store.claim(token),
        ids = await store.allocate(token, ["one"])
      const source: AtlasLibrarySource | null = location
        ? {
            documentId: "one",
            name,
            slug: "one",
            locale: "en",
            published: true,
            location,
          }
        : null
      const projected = source
        ? projectAtlasLibrary(source, {
            atlasId: ids.get("one")!,
            canonicalLocale: "en",
            now: new Date(),
          })
        : null
      await store.apply(
        token,
        jobs,
        new Map([["one", projected]]),
        new Map([["one", source]])
      )
    }
    const window = (
      since = "0",
      bbox = { west: -1, east: 1, south: -1, north: 1 }
    ) => parseAtlasChangeRequest({ buildId: "fixture", since, bbox })
    it("returns the indexed state even when current projection is newer", async () => {
      await put({ lat: 0, lng: 0 }, "Indexed")
      await put({ lat: 40, lng: 40 }, "Unindexed")
      await db("atlas_state").update({ indexed_through: "1" })
      const changes = await atlasChanges(db, window())
      if (changes.status !== "complete") throw new Error("fixture")
      expect(changes.throughRevision).toBe("1")
      expect(changes.upserts[0]?.properties.n).toBe("Indexed")
    })
    it("includes old or new geometry and uses the latest state through the watermark", async () => {
      await put({ lat: 0, lng: 0 })
      await put({ lat: 40, lng: 40 })
      await put({ lat: 50, lng: 50 })
      await db("atlas_state").update({ indexed_through: "3" })
      const changes = await atlasChanges(db, window("1"))
      expect(changes).toMatchObject({
        status: "complete",
        removedIds: ["one"],
        upserts: [],
      })
    })
    it("handles wrapped and polar display scopes", async () => {
      await put({ lat: 90, lng: 179.9 })
      await db("atlas_state").update({ indexed_through: "1" })
      const changes = await atlasChanges(
        db,
        window("0", { west: 170, east: -170, south: 89, north: 90 })
      )
      expect(changes.status).toBe("complete")
      if (changes.status === "complete") expect(changes.upserts).toHaveLength(1)
    })
    it("returns expired for journal/manifest mismatch and rejects excessive revisions", async () => {
      await db("atlas_state").update({ journal_floor: "1" })
      expect((await atlasChanges(db, window())).status).toBe("expired")
      expect(() =>
        parseAtlasChangeRequest({ ...window(), since: "9999999999999999999" })
      ).toThrow("revision")
    })
    it("keeps archive pages bounded and exposes stable numeric IDs", async () => {
      await put({ lat: 0, lng: 0 })
      const page = await atlasArchivePage(db, 0, undefined, 1)
      expect(page.points).toHaveLength(1)
      expect(page.points[0].id).toBe(1)
      expect(
        await atlasArchivePage(db, page.next!, page.upper, 1)
      ).toMatchObject({ next: null, points: [] })
      await expect(atlasArchivePage(db, 0, undefined, 1001)).rejects.toThrow(
        "window"
      )
    })
    it("validates exports only through indexed history after capture drains", async () => {
      await put({ lat: 0, lng: 0 })
      await db("atlas_state").update({ indexed_through: "1" })
      const state = await db("atlas_state").first()
      const request = {
        since: "0",
        through: "1",
        queryEpoch: state.query_epoch,
        dictionaryVersion: state.dictionary.version,
      }
      const result = await atlasExportJournal(db, request)
      expect(result.stable).toBe(true)
      expect(result.changes).toHaveLength(1)
      await db("atlas_outbox").insert({
        kind: "document",
        entity_id: "pending",
      })
      expect(await atlasExportJournal(db, request)).toEqual({ stable: false })
      await db("atlas_outbox").delete()
      expect(
        await atlasExportJournal(db, { ...request, queryEpoch: "old" })
      ).toEqual({ stable: false })
      await db("atlas_state").update({ journal_floor: "1" })
      expect(await atlasExportJournal(db, request)).toEqual({ stable: false })
    })
    it("prunes only indexed history and keeps stable tombstone IDs", async () => {
      await put({ lat: 0, lng: 0 })
      await put(null)
      await db("atlas_changes").update({ created_at: new Date(0) })
      await db("atlas_state").update({ indexed_through: "1" })
      await store.prune(token)
      expect(
        (await db("atlas_changes").select("revision")).map(
          (row) => row.revision
        )
      ).toEqual(["2"])
      expect(await db("atlas_records").first()).toMatchObject({
        atlas_id: "1",
        active: false,
      })
    })
  }
)

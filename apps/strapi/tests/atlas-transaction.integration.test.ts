import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createAtlasFixture } from "./helpers/atlas-fixture"
import { withAtlasLibraryWrite } from "../src/utils/atlas-outbox"

describe.skipIf(!process.env.ATLAS_TEST_DATABASE_URL)(
  "Atlas capture on pinned Strapi + real PostgreSQL",
  () => {
    let fixture: Awaited<ReturnType<typeof createAtlasFixture>>
    beforeAll(async () => {
      fixture = await createAtlasFixture()
    }, 60000)
    afterAll(async () => {
      await fixture?.destroy()
    }, 30000)
    const jobs = () =>
      fixture.strapi.db.connection("atlas_outbox").select("kind", "entity_id")

    it("commits create/publish/update/unpublish/delete jobs with content", async () => {
      const documents = fixture.strapi.documents("api::library.library")
      const row = await documents.create({ data: { name: "Test library" } })
      expect((await jobs()).map((job: any) => job.entity_id)).toEqual([
        row.documentId,
      ])
      await documents.publish({ documentId: row.documentId })
      await documents.update({
        documentId: row.documentId,
        data: { name: "Updated" },
      })
      await documents.unpublish({ documentId: row.documentId })
      await documents.delete({ documentId: row.documentId })
      expect(
        (await jobs()).filter((job: any) => job.entity_id === row.documentId)
      ).toHaveLength(5)
    })
    it("rolls back both canonical and outbox rows on an outer transaction failure", async () => {
      const before = (await jobs()).length
      await expect(
        fixture.strapi.db.transaction(async () => {
          await fixture.strapi
            .documents("api::library.library")
            .create({ data: { name: "Must roll back" } })
          throw new Error("rollback fixture")
        })
      ).rejects.toThrow("rollback fixture")
      expect(
        await fixture.strapi
          .documents("api::library.library")
          .findFirst({ filters: { name: "Must roll back" } })
      ).toBeNull()
      expect(await jobs()).toHaveLength(before)
    })
    it("refuses the content commit if enqueue fails", async () => {
      const db = fixture.strapi.db.connection
      await db.raw(
        "ALTER TABLE atlas_outbox ADD CONSTRAINT atlas_fixture_reject CHECK (false) NOT VALID"
      )
      try {
        await expect(
          fixture.strapi
            .documents("api::library.library")
            .create({ data: { name: "No queue, no commit" } })
        ).rejects.toThrow()
        expect(
          await fixture.strapi
            .documents("api::library.library")
            .findFirst({ filters: { name: "No queue, no commit" } })
        ).toBeNull()
      } finally {
        await db.raw(
          "ALTER TABLE atlas_outbox DROP CONSTRAINT atlas_fixture_reject"
        )
      }
    })
    it("captures raw derived writes inside the same nested transaction", async () => {
      const row = await fixture.strapi
        .documents("api::library.library")
        .create({ data: { name: "Derived", completeness: 10 } })
      const before = (await jobs()).length
      await expect(
        fixture.strapi.db.transaction(async () => {
          await withAtlasLibraryWrite(fixture.strapi, [row.documentId], () =>
            fixture.strapi.db
              .query("api::library.library")
              .update({ where: { id: row.id }, data: { completeness: 90 } })
          )
          throw new Error("rollback derived")
        })
      ).rejects.toThrow("rollback derived")
      expect(
        (
          await fixture.strapi.db
            .query("api::library.library")
            .findOne({ where: { id: row.id } })
        )?.completeness
      ).toBe(10)
      expect(await jobs()).toHaveLength(before)
    })
    it("queues both Notice owners when a notice moves, then its owner on delete", async () => {
      const documents = fixture.strapi.documents("api::library.library")
      const a = await documents.create({
          data: { name: "Owner A" },
          status: "published",
        }),
        b = await documents.create({
          data: { name: "Owner B" },
          status: "published",
        })
      const notices = fixture.strapi.documents(
        "api::library-notice.library-notice"
      )
      const row = await notices.create({
        data: { type: "closure", library: a.documentId },
      })
      await fixture.strapi.db.connection("atlas_outbox").delete()
      await notices.update({
        documentId: row.documentId,
        data: { library: b.documentId },
      })
      expect(new Set((await jobs()).map((job: any) => job.entity_id))).toEqual(
        new Set([a.documentId, b.documentId])
      )
      await fixture.strapi.db.connection("atlas_outbox").delete()
      await notices.delete({ documentId: row.documentId })
      expect((await jobs()).map((job: any) => job.entity_id)).toEqual([
        b.documentId,
      ])
    })
  }
)

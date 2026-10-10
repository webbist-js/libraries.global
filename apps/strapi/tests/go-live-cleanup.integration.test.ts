import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { applyCleanup, cleanupReport } from "../scripts/go-live-cleanup"
import { readLocalPopulation } from "../src/utils/local-population-ingest"
import { readPopulationObservations } from "../src/utils/population-ingest"

const requireDb = createRequire(require.resolve("@strapi/database"))
const createKnex = requireDb("knex")
const migration = requireDb(
  path.resolve(
    process.cwd(),
    "database/migrations/2026.10.10T00.00.00.population-on-places"
  )
)
const storage = requireDb(
  path.resolve(process.cwd(), "database/migrations/shared/population-storage")
)

const json = (value: any) =>
  typeof value === "string" ? JSON.parse(value) : value
const database = process.env.GO_LIVE_TEST_DATABASE

// Only a disposable copy can opt into these tests. Never accept the app database name.
describe.skipIf(!database)(
  "go-live data on a disposable PostgreSQL copy",
  () => {
    let db: any
    beforeAll(() => {
      if (!database?.endsWith("_go_live_check"))
        throw new Error("A disposable _go_live_check database is required")
      const env = Object.fromEntries(
        readFileSync(path.resolve(process.cwd(), ".env"), "utf8")
          .split(/\r?\n/)
          .filter((line) => /^[A-Z_\d]+=/.test(line))
          .map((line) => {
            const i = line.indexOf("=")

            return [
              line.slice(0, i),
              line.slice(i + 1).replace(/^(["'])(.*)\1$/, "$2"),
            ]
          })
      )
      db = createKnex({
        client: "pg",
        connection: {
          host: env.DATABASE_HOST,
          port: Number(env.DATABASE_PORT),
          database,
          user: env.DATABASE_USERNAME,
          password: env.DATABASE_PASSWORD,
        },
      })
    })
    afterAll(async () => {
      await db?.destroy()
    })

    it("retains all 579 estimates on geography and supplies the Atlas contracts", async () => {
      const strapi = { db: { connection: db } }
      const countries = await readPopulationObservations(strapi)
      const local = await readLocalPopulation(strapi)
      expect(countries).toHaveLength(217)
      expect(local).toHaveLength(361)
      const england = await db("countries")
        .where({ iso_2: "GB-ENG" })
        .whereNotNull("published_at")
        .first()
      expect(england.population_count).toBeNull()
      expect(json(england.population_estimates)[0].reportingCode).toBe("GBR")
      expect(await db.schema.hasTable("population_observations")).toBe(false)
    })

    it("migrates the original catalogue without losing years, provenance or draft edits", async () => {
      const rollback = new Error("verified migration rollback")
      await expect(
        db.transaction(async (trx) => {
          const rows = []
          for (const table of [
            "countries",
            "areas",
            "regions",
            "site_configs",
          ]) {
            const query = trx(table).whereNotNull("population_estimates")
            if (table !== "site_configs")
              query.where({ locale: "en" }).whereNotNull("published_at")
            for (const place of await query)
              rows.push(...json(place.population_estimates))
          }
          expect(rows).toHaveLength(579)
          await trx.schema.createTable("population_observations", (t) => {
            t.increments("id")
            t.string("key")
            t.string("level")
            t.string("reporting_code")
            t.string("iso_2")
            t.string("name")
            t.bigInteger("population")
            t.integer("year")
            t.string("source")
            t.text("source_url")
            t.string("licence")
            t.timestamp("retrieved_at")
            t.string("method")
            t.string("boundary_version")
            t.string("parent_reporting_code")
          })
          await trx("population_observations").insert(
            rows.map((r) => ({
              key: r.key,
              level: r.level,
              reporting_code: r.reportingCode,
              iso_2: r.iso2,
              name: r.name,
              population: r.population,
              year: r.year,
              source: r.source,
              source_url: r.sourceUrl,
              licence: r.licence,
              retrieved_at: r.retrievedAt,
              method: r.method,
              boundary_version: r.boundaryVersion,
              parent_reporting_code: r.parentReportingCode,
            }))
          )
          for (const table of ["countries", "areas", "regions", "site_configs"])
            await trx(table).update({ population_estimates: null })
          await trx("countries").whereIn("iso_2", ["MV", "MU", "SC"]).delete()
          await trx("areas")
            .where({ name: "Barnsley" })
            .update({ gss_code: "E08000038" })
          await trx("areas")
            .where({ document_id: "puthk05od4va44dzdi87sd7a" })
            .update({ gss_code: "E08000039" })
          const france = await trx("countries")
            .where({ iso_2: "FR" })
            .whereNull("published_at")
            .first()
          await trx("countries")
            .where({ id: france.id })
            .update({ summary: "Keep this unrelated draft edit" })
          await migration.up(trx)
          const result = await storage.readPopulationEstimates(
            trx,
            ["countries", "areas", "regions"],
            () => true
          )
          expect(result).toHaveLength(578)
          expect(new Set(result.map((r) => r.key))).toEqual(
            new Set(rows.filter((r) => r.level !== "world").map((r) => r.key))
          )
          for (const r of result)
            expect(r).toMatchObject(
              rows.find((original) => original.key === r.key)
            )
          expect(
            (await trx("countries").where({ id: france.id }).first()).summary
          ).toBe("Keep this unrelated draft edit")
          expect(
            (await trx("areas").where({ name: "Barnsley" }).first()).gss_code
          ).toBe("E08000016")
          expect(await trx.schema.hasTable("population_observations")).toBe(
            false
          )
          throw rollback
        })
      ).rejects.toBe(rollback)
    })

    it("rejects ambiguous/unmatched data before writing and keeps the account guard", async () => {
      const before = await cleanupReport(db, "info@alex-bennett.co.uk")
      await expect(applyCleanup(db, "missing@example.test")).rejects.toThrow(
        "preserved email"
      )
      await expect(
        storage.populationPlan(db, [
          {
            key: "unmatched",
            level: "country",
            reportingCode: "ZZZ",
            iso2: "ZZ",
            name: "Missing",
            population: 100,
            year: 2024,
            source: "Test",
            sourceUrl: "https://example.test",
            licence: "Test",
            retrievedAt: new Date().toISOString(),
            method: "direct",
          },
        ])
      ).rejects.toThrow("geographic owner")
      expect(await cleanupReport(db, "info@alex-bennett.co.uk")).toEqual(before)
    })

    it("keeps one account across all identity stores and one initial row per library version", async () => {
      const report = await cleanupReport(db, "info@alex-bennett.co.uk")
      expect(Object.values(report.accountsToRemove)).toEqual([0, 0, 0, 0])
      expect(Object.values(report.tablesToEmpty).every((n) => n === 0)).toBe(
        true
      )
      expect(report.libraryDocuments).toBe(21389)
      const [{ n: changes }] = await db("library_changes").count({ n: "*" })
      const [{ n: libraries }] = await db("libraries").count({ n: "*" })
      expect(changes).toBe(libraries)
      expect(
        await db("library_changes").whereNot({
          source: "import",
          actor_kind: "system",
          actor_id: "libraries-global-bot",
          action: "create",
        })
      ).toHaveLength(0)
    })
  }
)

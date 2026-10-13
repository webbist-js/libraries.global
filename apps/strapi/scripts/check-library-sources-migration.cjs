const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const localRequire = createRequire(require.resolve("@strapi/database"))
const knexFactory = localRequire("knex")
const {
  migrateLibrarySources,
} = require("../database/migrations/shared/library-sources")

process.loadEnvFile(path.join(root, ".env"))
if (!["127.0.0.1", "localhost", "0.0.0.0"].includes(process.env.DATABASE_HOST))
  throw new Error("Local database required")
const config = {
  host: "127.0.0.1",
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
}
const fixture = `library_sources_check_${Date.now()}`
const admin = knexFactory({
  client: "pg",
  connection: { ...config, database: process.env.DATABASE_NAME },
})
;(async () => {
  await admin.raw(`create database ${fixture}`)
  const db = knexFactory({
    client: "pg",
    connection: { ...config, database: fixture },
  })
  try {
    await db.raw(
      `create table libraries(id serial primary key,document_id text,locale text,published_at timestamptz,updated_at timestamptz default now(),source text,source_url text);create table components_library_source_records(id serial primary key,dataset text,record_id text,retrieved_at date,url text);create table libraries_cmps(id serial primary key,entity_id integer,cmp_id integer,component_type text,field text,"order" float);`
    )
    await db("libraries").insert([
      {
        document_id: "same",
        locale: "en",
        source: "a",
        source_url: "https://draft.test",
      },
      {
        document_id: "same",
        locale: "en",
        published_at: new Date(),
        source: "a",
        source_url: "https://live.test",
      },
      {
        document_id: "same",
        locale: "fr",
        source: null,
        source_url: "https://fr.test",
      },
      {
        document_id: "other",
        locale: "en",
        source: "b",
        source_url: "https://b.test",
      },
    ])
    await db("components_library_source_records").insert([
      {
        dataset: "a",
        record_id: "KEEP",
        retrieved_at: "2026-01-01",
        url: null,
      },
      { dataset: "b", record_id: "B", url: "https://different.test" },
    ])
    await db("libraries_cmps").insert([
      {
        entity_id: 1,
        cmp_id: 1,
        component_type: "library.source-record",
        field: "sourceRecords",
        order: 1,
      },
      {
        entity_id: 2,
        cmp_id: 1,
        component_type: "library.source-record",
        field: "sourceRecords",
        order: 1,
      },
      {
        entity_id: 4,
        cmp_id: 2,
        component_type: "library.source-record",
        field: "sourceRecords",
        order: 1,
      },
    ])
    const before = await db("libraries").select("*")
    const report = await migrateLibrarySources(db)
    assert.equal(report.versions, 4)
    assert.equal(report.added, 2)
    assert.deepEqual(await db("libraries").select("*"), before)
    const refs = await db("libraries_cmps as j")
      .join("components_library_source_records as c", "c.id", "j.cmp_id")
      .select("c.*", "j.entity_id")
    assert.equal(refs.find((r) => r.entity_id === 1).url, "https://draft.test")
    assert.equal(refs.find((r) => r.entity_id === 2).url, "https://live.test")
    assert.equal(refs.find((r) => r.entity_id === 1).record_id, "KEEP")
    assert(
      refs.some(
        (r) => r.url === "https://different.test" && r.record_id === "B"
      )
    )
    assert.deepEqual(await migrateLibrarySources(db), {
      versions: 4,
      added: 0,
      updated: 0,
    })
    // Fail in a later batch after earlier writes, proving the whole transaction rolls back.
    await db("libraries").insert(
      Array.from({ length: 600 }, (_, i) => ({
        source: "rollback",
        source_url: `https://rollback.test/${i}`,
      }))
    )
    await db("libraries_cmps").insert({
      entity_id: 600,
      cmp_id: 99999,
      component_type: "library.source-record",
      field: "sourceRecords",
      order: 9,
    })
    await db("libraries").insert({
      source: "rollback",
      source_url: "https://rollback.test",
    })
    const count = await db("components_library_source_records")
      .count("* as n")
      .first()
    await assert.rejects(migrateLibrarySources(db), /no component/)
    assert.deepEqual(
      await db("components_library_source_records").count("* as n").first(),
      count
    )
    console.log(
      JSON.stringify({
        result: "passed",
        report,
        cases: [
          "all versions and locales",
          "shared component clone",
          "record IDs and dates",
          "conflicting URLs",
          "idempotent",
          "rollback on broken link",
          "publication and timestamps unchanged",
        ],
      })
    )
  } finally {
    await db.destroy()
    await admin.raw(`drop database ${fixture}`)
  }
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => admin.destroy())

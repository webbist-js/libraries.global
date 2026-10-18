const assert = require("node:assert/strict")
const { createRequire } = require("node:module")
const path = require("node:path")

const {
  migrateLibraryTypes,
} = require("../database/migrations/shared/library-types")

process.loadEnvFile(path.resolve(__dirname, "../.env"))
if (
  !["localhost", "127.0.0.1", "0.0.0.0"].includes(process.env.DATABASE_HOST) ||
  process.env.DATABASE_URL
)
  throw new Error("Local database required")
const req = createRequire(require.resolve("@strapi/database"))
const knex = req("knex")
const connection = {
  host: "127.0.0.1",
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
}
const fixture = `library_types_check_${Date.now()}`
const admin = knex({
  client: "pg",
  connection: { ...connection, database: process.env.DATABASE_NAME },
})

async function main() {
  await admin.raw("CREATE DATABASE ??", [fixture])
  const db = knex({
    client: "pg",
    connection: { ...connection, database: fixture },
  })
  try {
    await db.schema.createTable("libraries", (table) => {
      table.increments("id")
      table.string("document_id")
      table.string("locale")
      table.string("library_type")
      table.datetime("published_at")
      table.datetime("updated_at")
    })
    const now = new Date()
    await db("libraries").insert([
      {
        document_id: "one",
        locale: "en",
        library_type: "Public",
        published_at: null,
        updated_at: now,
      },
      {
        document_id: "one",
        locale: "en",
        library_type: "Public",
        published_at: now,
        updated_at: now,
      },
      {
        document_id: "one",
        locale: "fr",
        library_type: "Archive",
        published_at: null,
        updated_at: now,
      },
      {
        document_id: "custom",
        locale: "cs",
        library_type: "Community",
        published_at: now,
        updated_at: now,
      },
    ])
    const before = await db("libraries").orderBy("id")
    assert.deepEqual(await migrateLibraryTypes(db, { apply: false }), {
      versions: 4,
      linked: 4,
      createdTypes: 3,
    })
    assert.equal(await db.schema.hasTable("library_types"), false)
    assert.deepEqual(await migrateLibraryTypes(db), {
      versions: 4,
      linked: 4,
      createdTypes: 3,
    })
    assert.deepEqual(await db("libraries").orderBy("id"), before)
    assert.deepEqual(await migrateLibraryTypes(db), {
      versions: 4,
      linked: 0,
      createdTypes: 0,
    })
    const links = await db("libraries as l")
      .join("libraries_library_type_lnk as j", "j.library_id", "l.id")
      .join("library_types as t", "t.id", "j.library_type_id")
      .select(
        "l.library_type",
        "l.published_at as library_published",
        "t.name",
        "t.published_at as type_published"
      )
    for (const link of links) {
      assert.equal(link.library_type, link.name)
      assert.equal(
        Boolean(link.library_published),
        Boolean(link.type_published)
      )
    }
    // The first batch would write links, then a conflicting later row must roll it all back.
    await db("libraries").insert(
      Array.from({ length: 1001 }, (_, i) => ({
        document_id: `batch-${i}`,
        library_type: "Public",
      }))
    )
    const archive = await db("library_types")
      .where({ name: "Archive", published_at: null })
      .first()
    await db("libraries_library_type_lnk").insert({
      library_id: 1005,
      library_type_id: archive.id,
    })
    await assert.rejects(migrateLibraryTypes(db), /Conflicting type/)
    assert.equal(
      Number((await db("libraries_library_type_lnk").count("* as n"))[0].n),
      5
    )
    await db("libraries_library_type_lnk").where({ library_id: 1005 }).del()
    await migrateLibraryTypes(db)
    await db.schema.alterTable("libraries", (table) =>
      table.dropColumn("library_type")
    )
    assert.deepEqual(await migrateLibraryTypes(db), {
      versions: 1005,
      linked: 0,
      createdTypes: 0,
    })
    await db("libraries_library_type_lnk").where({ library_id: 1005 }).del()
    await assert.rejects(migrateLibraryTypes(db), /no type relation/)
    console.log(
      "Passed: all versions/locales, custom types, draft/publication pairing, unchanged libraries, dry run, idempotency, transaction rollback, post-sync verification"
    )
  } finally {
    await db.destroy()
    await admin.raw("DROP DATABASE ??", [fixture])
  }
}
main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => admin.destroy())

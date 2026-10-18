"use strict"

const { randomBytes } = require("node:crypto")

const TYPES = "library_types"
const LINKS = "libraries_library_type_lnk"

/** Run before schema sync drops libraries.library_type. Link physical versions separately. */
async function migrateLibraryTypes(knex, { apply = true } = {}) {
  if (!(await knex.schema.hasTable("libraries")))
    return { versions: 0, linked: 0, createdTypes: 0 }
  const db = await knex.transaction()
  try {
    await db.raw("SET LOCAL lock_timeout = '10s'")
    await db.raw("SELECT pg_advisory_xact_lock(716294804)")
    await db.raw("LOCK TABLE libraries IN SHARE ROW EXCLUSIVE MODE")
    const legacy = await db.schema.hasColumn("libraries", "library_type")
    if (!legacy) {
      if (!(await db.schema.hasTable(LINKS)))
        throw new Error(
          "Legacy library types and relation table are both missing"
        )
      const [{ count }] = await db("libraries as l")
        .leftJoin(`${LINKS} as j`, "j.library_id", "l.id")
        .leftJoin(`${TYPES} as t`, "t.id", "j.library_type_id")
        .where((query) =>
          query
            .whereNull("t.id")
            .orWhereRaw("(t.published_at IS NULL) <> (l.published_at IS NULL)")
        )
        .count("l.id as count")
      if (Number(count))
        throw new Error(`${count} library versions have no type relation`)
      const duplicates = await db(LINKS)
        .select("library_id")
        .groupBy("library_id")
        .havingRaw("count(*) > 1")
        .limit(1)
      if (duplicates.length)
        throw new Error("A library version has multiple type relations")
      const versions = Number((await db("libraries").count("* as n"))[0].n)
      await (apply ? db.commit() : db.rollback())

      return {
        versions,
        linked: 0,
        createdTypes: 0,
      }
    }
    // A new catalogue may not have been schema-synchronised yet. Strapi adds the
    // remaining optional columns and its standard indexes during schema sync.
    if (!(await db.schema.hasTable(TYPES)))
      await db.schema.createTable(TYPES, (table) => {
        table.increments("id")
        table.string("document_id")
        table.string("name")
        table.string("category").defaultTo("Other")
        table.datetime("created_at")
        table.datetime("updated_at")
        table.datetime("published_at")
      })
    if (!(await db.schema.hasTable(LINKS)))
      await db.schema.createTable(LINKS, (table) => {
        table.increments("id")
        table.integer("library_id").unsigned()
        table.integer("library_type_id").unsigned()
        table.unique(["library_id", "library_type_id"], `${LINKS}_uq`)
      })
    await db.raw(`LOCK TABLE ${TYPES}, ${LINKS} IN SHARE ROW EXCLUSIVE MODE`)

    const names = await db("libraries").distinct("library_type")
    if (names.some((row) => !row.library_type?.trim()))
      throw new Error(
        "A library has an empty legacy type; resolve it before migration"
      )
    const targets = new Map()
    let createdTypes = 0
    for (const { library_type: name } of names) {
      let rows = await db(TYPES).where({ name }).orderBy("id")
      const documents = new Set(rows.map((row) => row.document_id))
      if (documents.size > 1 || rows.length > 2)
        throw new Error(`Ambiguous library type: ${name}`)
      if (!rows.length) {
        const documentId = randomBytes(12).toString("hex")
        const now = new Date()
        rows = await db(TYPES)
          .insert([
            {
              document_id: documentId,
              name,
              category: "Other",
              created_at: now,
              updated_at: now,
              published_at: null,
            },
            {
              document_id: documentId,
              name,
              category: "Other",
              created_at: now,
              updated_at: now,
              published_at: now,
            },
          ])
          .returning("*")
        createdTypes++
      }
      const published = rows.find((row) => row.published_at)
      if (!published) throw new Error(`Library type is not published: ${name}`)
      let draft = rows.find((row) => !row.published_at)
      if (!draft) {
        const { id, ...copy } = published
        ;[draft] = await db(TYPES)
          .insert({ ...copy, published_at: null })
          .returning("*")
      }
      targets.set(name, { draft: draft.id, published: published.id })
    }

    const report = { versions: 0, linked: 0, createdTypes }
    let after = 0
    for (;;) {
      const libraries = await db("libraries")
        .select("id", "library_type", "published_at")
        .where("id", ">", after)
        .orderBy("id")
        .limit(1000)
      if (!libraries.length) break
      const existing = await db(LINKS).whereIn(
        "library_id",
        libraries.map((row) => row.id)
      )
      const byLibrary = new Map()
      for (const link of existing) {
        if (byLibrary.has(link.library_id))
          throw new Error(
            `Multiple types on library version ${link.library_id}`
          )
        byLibrary.set(link.library_id, link.library_type_id)
      }
      const added = []
      for (const library of libraries) {
        const target = targets.get(library.library_type)[
          library.published_at ? "published" : "draft"
        ]
        const current = byLibrary.get(library.id)
        if (current != null && current !== target)
          throw new Error(`Conflicting type on library version ${library.id}`)
        if (current == null)
          added.push({ library_id: library.id, library_type_id: target })
      }
      if (added.length) await db(LINKS).insert(added)
      report.versions += libraries.length
      report.linked += added.length
      after = libraries.at(-1).id
    }
    const [{ count }] = await db("libraries as l")
      .leftJoin(`${LINKS} as j`, "j.library_id", "l.id")
      .leftJoin(`${TYPES} as t`, "t.id", "j.library_type_id")
      .where((q) =>
        q
          .whereNull("t.id")
          .orWhereColumn("t.name", "<>", "l.library_type")
          .orWhereRaw("(t.published_at IS NULL) <> (l.published_at IS NULL)")
      )
      .count("l.id as count")
    if (Number(count))
      throw new Error(`${count} library versions failed relation verification`)
    await (apply ? db.commit() : db.rollback())

    return report
  } catch (error) {
    await db.rollback()
    throw error
  }
}

module.exports = { migrateLibraryTypes }

"use strict"

const COMPONENT = "components_library_source_records"
const TYPE = "library.source-record"

/** Merge one physical version only. Never borrow citations from its draft or another locale. */
function sourcePlan(library, records) {
  const result = records.map((record) => ({
    ...record,
    role: record.role || "reference",
  }))
  const dataset = library.source || null
  const url = library.source_url || null
  if (!dataset && !url) return result
  const match = result.find(
    (r) => (r.dataset || null) === dataset && (!url || !r.url || r.url === url)
  )
  if (match) {
    match.role = "origin"
    if (url && !match.url) match.url = url
  } else {
    result.push({
      dataset,
      record_id: null,
      retrieved_at: null,
      url,
      role: "origin",
    })
  }

  return result
}

async function migrateLibrarySources(knex) {
  if (!(await knex.schema.hasTable("libraries")))
    return { versions: 0, added: 0, updated: 0 }

  return knex.transaction(async (db) => {
    await db.raw("select pg_advisory_xact_lock(716294803)")
    await db.raw(
      `lock table libraries, libraries_cmps, ${COMPONENT} in share row exclusive mode`
    )
    // The migration runs before Strapi's schema synchronisation removes the old fields.
    for (const [name, type] of [
      ["role", "string"],
      ["label", "string"],
      ["fields", "jsonb"],
      ["submission_document_id", "string"],
    ]) {
      if (!(await db.schema.hasColumn(COMPONENT, name)))
        await db.schema.alterTable(COMPONENT, (table) => table[type](name))
    }
    const legacy = await db.schema.hasColumn("libraries", "source")
    const legacyUrl = await db.schema.hasColumn("libraries", "source_url")
    const shared = new Set(
      (
        await db("libraries_cmps")
          .select("cmp_id")
          .where({ field: "sourceRecords", component_type: TYPE })
          .groupBy("cmp_id")
          .havingRaw("count(*) > 1")
      ).map((r) => r.cmp_id)
    )
    const report = { versions: 0, added: 0, updated: 0 }
    let last = 0
    for (;;) {
      const libraries = await db("libraries")
        .select(
          "id",
          ...(legacy ? ["source"] : []),
          ...(legacyUrl ? ["source_url"] : [])
        )
        .where("id", ">", last)
        .orderBy("id")
        .limit(500)
      if (!libraries.length) break
      const links = await db("libraries_cmps as j")
        .leftJoin(`${COMPONENT} as c`, "c.id", "j.cmp_id")
        .select(
          "c.*",
          "j.id as link_id",
          "j.entity_id",
          "j.order as link_order"
        )
        .whereIn(
          "j.entity_id",
          libraries.map((r) => r.id)
        )
        .where({ "j.field": "sourceRecords", "j.component_type": TYPE })
        .orderBy("j.order")
      if (links.some((r) => r.id == null))
        throw new Error(
          "A sourceRecords link has no component; refusing to retire legacy sources"
        )
      const byLibrary = new Map()
      for (const link of links) {
        if (!byLibrary.has(link.entity_id)) byLibrary.set(link.entity_id, [])
        byLibrary.get(link.entity_id).push(link)
      }
      for (const library of libraries) {
        const before = byLibrary.get(library.id) || []
        const plan = sourcePlan(library, before)
        for (const [index, record] of plan.entries()) {
          if (record.id != null) {
            const previous = before[index]
            if (record.url === previous.url && record.role === previous.role)
              continue
            const patch = { url: record.url, role: record.role }
            if (shared.has(record.id)) {
              const { link_id, entity_id, link_order, id, ...values } = record
              const [clone] = await db(COMPONENT).insert(values).returning("id")
              await db("libraries_cmps")
                .where({ id: link_id })
                .update({ cmp_id: clone.id })
            } else await db(COMPONENT).where({ id: record.id }).update(patch)
            report.updated++
          } else {
            const [added] = await db(COMPONENT).insert(record).returning("id")
            const order =
              before.reduce((max, r) => Math.max(max, r.link_order || 0), 0) +
              index +
              1
            await db("libraries_cmps").insert({
              entity_id: library.id,
              cmp_id: added.id,
              component_type: TYPE,
              field: "sourceRecords",
              order,
            })
            report.added++
          }
        }
        // Check the complete legacy pair in the stored result before committing.
        if (library.source || library.source_url) {
          const query = db("libraries_cmps as j")
            .join(`${COMPONENT} as c`, "c.id", "j.cmp_id")
            .where({
              "j.entity_id": library.id,
              "j.field": "sourceRecords",
              "j.component_type": TYPE,
              "c.role": "origin",
            })
          if (library.source) query.where("c.dataset", library.source)
          if (library.source_url) query.where("c.url", library.source_url)
          if (!(await query.first("c.id")))
            throw new Error(
              `Legacy provenance missing for library version ${library.id}`
            )
        }
        report.versions++
      }
      last = libraries.at(-1).id
    }

    return report
  })
}

module.exports = { sourcePlan, migrateLibrarySources }

"use strict"

/**
 * Spec §3.1 (community moderation): index `role_grants.ba_user_id`, read on
 * every session-profile refresh and every submission policy check.
 *
 * The statement lives in `./shared/hot-path-index-sql.js` with the other
 * hot-path indexes. `2026.09.30T00.00.01.hot-path-indexes` has already run
 * on existing databases, so this migration applies just the role_grants
 * entry. The usual caveats hold: Postgres only, and a table that doesn't
 * exist yet (a fresh database, where user migrations run before Strapi's
 * schema sync) is skipped with a warning; `ensureHotPathIndexes` in
 * bootstrap creates the index once the table exists.
 */

const { HOT_PATH_INDEXES } = require("./shared/hot-path-index-sql")

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])
const TABLE = "role_grants"

function isPostgres(knex) {
  const client = knex?.client?.config?.client
  const name = typeof client === "string" ? client : knex?.client?.dialect

  return PG_CLIENTS.has(String(name ?? "").toLowerCase())
}

const entries = () => HOT_PATH_INDEXES.filter((i) => i.table === TABLE)

async function up(knex) {
  if (!isPostgres(knex)) return
  if (!(await knex.schema.hasTable(TABLE))) {
    console.warn(
      `[migration] ${TABLE} not found; its index waits for bootstrap`
    )

    return
  }
  for (const entry of entries()) await knex.raw(entry.sql)
}

async function down(knex) {
  if (!isPostgres(knex)) return
  for (const entry of entries()) {
    await knex.raw(`DROP INDEX IF EXISTS ${entry.name}`)
  }
}

module.exports = { up, down }

"use strict"

/**
 * E1 (2026-09-29 Strapi review): index the hot paths and enforce the
 * uniqueness the code assumes (one vote per user and suggestion, one badge
 * award per user and badge, one leaderboard snapshot per period), plus a
 * sequence for `user_profiles.contributor_number`.
 *
 * - Postgres only; other clients (sqlite in tests) are skipped.
 * - Tables that don't exist yet (a fresh database: user migrations run
 *   before Strapi's schema sync) are skipped with a warning. On a brand-new
 *   database this migration is therefore a no-op; the bootstrap fallback in
 *   `src/utils/ensure-hot-path-indexes.ts` re-applies the same statements
 *   once the tables exist.
 * - Duplicate rows are removed before each unique index (votes and badge
 *   awards keep the lowest id, snapshots the highest).
 *
 * The SQL lives in `./shared/hot-path-index-sql.js`, shared with that
 * bootstrap fallback.
 */

const {
  HOT_PATH_INDEXES,
  CONTRIBUTOR_NUMBER_SEQUENCE,
} = require("./shared/hot-path-index-sql")

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

function isPostgres(knex) {
  const client = knex?.client?.config?.client
  const name = typeof client === "string" ? client : knex?.client?.dialect

  return PG_CLIENTS.has(String(name ?? "").toLowerCase())
}

async function up(knex) {
  if (!isPostgres(knex)) return

  const tableExists = new Map()
  const hasTable = async (table) => {
    if (!tableExists.has(table)) {
      tableExists.set(table, await knex.schema.hasTable(table))
    }

    return tableExists.get(table)
  }

  for (const entry of HOT_PATH_INDEXES) {
    if (!(await hasTable(entry.table))) {
      console.warn(
        `[migration] ${entry.table} not found; ${entry.name} not created`
      )
      continue
    }
    for (const before of entry.before ?? []) await knex.raw(before)
    await knex.raw(entry.sql)
  }

  if (await hasTable(CONTRIBUTOR_NUMBER_SEQUENCE.table)) {
    for (const sql of CONTRIBUTOR_NUMBER_SEQUENCE.sql) await knex.raw(sql)
  } else {
    console.warn(
      `[migration] ${CONTRIBUTOR_NUMBER_SEQUENCE.table} not found; ${CONTRIBUTOR_NUMBER_SEQUENCE.name} not created`
    )
  }
}

async function down(knex) {
  if (!isPostgres(knex)) return
  for (const entry of HOT_PATH_INDEXES) {
    await knex.raw(`DROP INDEX IF EXISTS ${entry.name}`)
  }
  await knex.raw(`DROP SEQUENCE IF EXISTS ${CONTRIBUTOR_NUMBER_SEQUENCE.name}`)
}

module.exports = { up, down }

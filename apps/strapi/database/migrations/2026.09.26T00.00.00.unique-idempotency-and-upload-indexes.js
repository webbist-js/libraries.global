"use strict"

/**
 * I2: enforce in the database what the schemas only declare.
 *
 * Strapi v5 does not create DB constraints for `"unique": true`, so
 * `rw_point_events.idempotency_key` (rewards idempotency) and
 * `cm_submission_uploads.file_id` (upload ownership) were only checked in
 * application code, which a concurrent pair of requests can race past.
 *
 * - Postgres only; other clients (sqlite in tests) are skipped.
 * - Tables that don't exist yet (a fresh database: user migrations run
 *   before Strapi's schema sync) are skipped with a warning. On a brand-new
 *   database that means this migration is a no-op (see the fresh-DB
 *   follow-up in `src/utils/ensure-unique-indexes.ts`, run from bootstrap,
 *   which re-applies the same statements once the tables exist).
 * - Duplicate `file_id` rows are removed first, keeping the lowest id, so
 *   the unique index can be built.
 *
 * The SQL itself lives in `./shared/idempotency-index-sql.js`, shared with
 * that bootstrap fallback.
 */

const {
  RW_POINT_EVENTS_TABLE,
  CM_SUBMISSION_UPLOADS_TABLE,
  RW_POINT_EVENTS_INDEX_SQL,
  CM_SUBMISSION_UPLOADS_DEDUPE_SQL,
  CM_SUBMISSION_UPLOADS_INDEX_SQL,
} = require("./shared/idempotency-index-sql")

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

function isPostgres(knex) {
  const client = knex?.client?.config?.client
  const name = typeof client === "string" ? client : knex?.client?.dialect

  return PG_CLIENTS.has(String(name ?? "").toLowerCase())
}

async function up(knex) {
  if (!isPostgres(knex)) return

  if (await knex.schema.hasTable(RW_POINT_EVENTS_TABLE)) {
    await knex.raw(RW_POINT_EVENTS_INDEX_SQL)
  } else {
    console.warn(
      "[migration] rw_point_events not found; idempotency_key unique index not created"
    )
  }

  if (await knex.schema.hasTable(CM_SUBMISSION_UPLOADS_TABLE)) {
    await knex.raw(CM_SUBMISSION_UPLOADS_DEDUPE_SQL)
    await knex.raw(CM_SUBMISSION_UPLOADS_INDEX_SQL)
  } else {
    console.warn(
      "[migration] cm_submission_uploads not found; file_id unique index not created"
    )
  }
}

async function down(knex) {
  if (!isPostgres(knex)) return
  await knex.raw("DROP INDEX IF EXISTS rw_point_events_idempotency_key_uq")
  await knex.raw("DROP INDEX IF EXISTS cm_submission_uploads_file_id_uq")
}

module.exports = { up, down }

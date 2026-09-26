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
 *   before Strapi's schema sync) are skipped with a warning.
 * - Duplicate `file_id` rows are removed first, keeping the lowest id, so
 *   the unique index can be built.
 */

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

function isPostgres(knex) {
  const client = knex?.client?.config?.client
  const name = typeof client === "string" ? client : knex?.client?.dialect

  return PG_CLIENTS.has(String(name ?? "").toLowerCase())
}

async function up(knex) {
  if (!isPostgres(knex)) return

  if (await knex.schema.hasTable("rw_point_events")) {
    await knex.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS rw_point_events_idempotency_key_uq " +
        "ON rw_point_events (idempotency_key) WHERE idempotency_key IS NOT NULL"
    )
  } else {
    console.warn(
      "[migration] rw_point_events not found; idempotency_key unique index not created"
    )
  }

  if (await knex.schema.hasTable("cm_submission_uploads")) {
    await knex.raw(
      "DELETE FROM cm_submission_uploads a USING cm_submission_uploads b " +
        "WHERE a.file_id = b.file_id AND a.id > b.id"
    )
    await knex.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS cm_submission_uploads_file_id_uq " +
        "ON cm_submission_uploads (file_id)"
    )
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

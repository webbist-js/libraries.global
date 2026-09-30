"use strict"

/**
 * Events: the unique index the worker's upsert targets, and the index behind
 * the public `libraryEntityRef` filter.
 *
 * - `ev_events (source_provider, external_id)` UNIQUE — the sync-worker
 *   writes `INSERT ... ON CONFLICT (source_provider, external_id)`, which
 *   Postgres refuses without a matching unique index.
 * - `ev_events (library_entity_ref)` — the public library and ICS handlers
 *   filter on this denormalised column (added to the event schema alongside
 *   the `library` relation).
 *
 * Guards, in the style of `2026.09.26T00.00.00…`:
 * - Postgres only; other clients (sqlite in tests) are skipped.
 * - Strapi runs user migrations before its schema sync, so on a fresh
 *   database the table doesn't exist yet, and on the first boot after the
 *   schema change the `library_entity_ref` column doesn't exist yet. Both
 *   cases are skipped with a warning; the events plugin's bootstrap
 *   (`server/utils/ensure-event-indexes.ts`) re-applies the same idempotent
 *   statements once schema sync has run. The statements are mirrored there
 *   rather than shared, since a plain-.js migration can't import from the
 *   compiled plugin.
 * - Duplicate `(source_provider, external_id)` rows are removed first,
 *   keeping the lowest id, so the unique index can be built.
 * - Existing rows get `library_entity_ref` backfilled from the relation's
 *   join table `ev_events_library_lnk`.
 */

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

const TABLE = "ev_events"
const COLUMN = "library_entity_ref"

const DEDUPE_SQL =
  "DELETE FROM ev_events a USING ev_events b " +
  "WHERE a.source_provider = b.source_provider " +
  "AND a.external_id = b.external_id AND a.id > b.id"

const UNIQUE_INDEX_SQL =
  "CREATE UNIQUE INDEX IF NOT EXISTS ev_events_provider_external_uq " +
  "ON ev_events (source_provider, external_id)"

const REF_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS ev_events_library_entity_ref_idx " +
  "ON ev_events (library_entity_ref)"

const BACKFILL_SQL =
  "UPDATE ev_events e SET library_entity_ref = l.entity_ref " +
  "FROM ev_events_library_lnk lnk JOIN libraries l ON l.id = lnk.library_id " +
  "WHERE lnk.event_id = e.id AND e.library_entity_ref IS NULL"

function isPostgres(knex) {
  const client = knex?.client?.config?.client
  const name = typeof client === "string" ? client : knex?.client?.dialect

  return PG_CLIENTS.has(String(name ?? "").toLowerCase())
}

async function up(knex) {
  if (!isPostgres(knex)) return

  if (!(await knex.schema.hasTable(TABLE))) {
    console.warn(`[migration] ${TABLE} not found; event indexes not created`)

    return
  }
  if (!(await knex.schema.hasColumn(TABLE, COLUMN))) {
    console.warn(
      `[migration] ${TABLE}.${COLUMN} not found (schema sync has not run yet); event indexes not created`
    )

    return
  }

  await knex.raw(DEDUPE_SQL)
  await knex.raw(UNIQUE_INDEX_SQL)
  await knex.raw(BACKFILL_SQL)
  await knex.raw(REF_INDEX_SQL)
}

async function down(knex) {
  if (!isPostgres(knex)) return
  await knex.raw("DROP INDEX IF EXISTS ev_events_provider_external_uq")
  await knex.raw("DROP INDEX IF EXISTS ev_events_library_entity_ref_idx")
}

module.exports = { up, down }

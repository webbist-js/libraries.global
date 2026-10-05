/**
 * Indexes the events pipeline relies on but Strapi's schema sync never
 * creates:
 *
 * - `ev_events (source_provider, external_id)` UNIQUE — the worker's upsert
 *   targets it with `ON CONFLICT (source_provider, external_id)`; without it
 *   every sync fails with "no unique or exclusion constraint matching".
 * - `ev_events (library_entity_ref)` — the public library and ICS handlers
 *   filter on the denormalised entity ref.
 * - `ev_event_credentials (status)` — the worker's `loadCredentials` and the
 *   cron's auto-pause scan filter by status.
 * - `ev_credential_events (credential_document_id, created_at)` — the
 *   reveal and review-history reads page one feed's audit log in order.
 *
 * The same statements live in the migration
 * `database/migrations/2026.09.30T00.00.02.events-unique-external-id.js`.
 * Strapi runs user migrations *before* its schema sync, so on a fresh
 * database — and on the first boot after `libraryEntityRef` was added to the
 * schema — the migration finds no table or no column and does nothing (yet is
 * recorded as applied). This bootstrap fallback runs after schema sync, when
 * the column exists, and re-applies the idempotent statements. Same
 * reasoning as `src/utils/ensure-unique-indexes.ts`.
 *
 * Duplicate `(source_provider, external_id)` rows are removed first, keeping
 * the lowest id (the earliest import and therefore the documentId any link
 * was built on). Existing rows get `library_entity_ref` backfilled from the
 * relation's join table.
 *
 * Postgres only. Raw SQL is sanctioned here: DDL and a set-based backfill
 * aren't expressible through the Document Service.
 */

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

export const EV_EVENTS_TABLE = "ev_events"
export const EV_EVENTS_LIBRARY_LINK_TABLE = "ev_events_library_lnk"
export const EV_EVENTS_LIBRARY_ENTITY_REF_COLUMN = "library_entity_ref"

export const EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME =
  "ev_events_provider_external_uq"
export const EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME =
  "ev_events_library_entity_ref_idx"

export const EV_EVENTS_DEDUPE_SQL =
  "DELETE FROM ev_events a USING ev_events b " +
  "WHERE a.source_provider = b.source_provider " +
  "AND a.external_id = b.external_id AND a.id > b.id"

export const EV_EVENTS_PROVIDER_EXTERNAL_INDEX_SQL =
  `CREATE UNIQUE INDEX IF NOT EXISTS ${EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME} ` +
  "ON ev_events (source_provider, external_id)"

export const EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS ${EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME} ` +
  "ON ev_events (library_entity_ref)"

export const EV_EVENTS_BACKFILL_ENTITY_REF_SQL =
  "UPDATE ev_events e SET library_entity_ref = l.entity_ref " +
  "FROM ev_events_library_lnk lnk JOIN libraries l ON l.id = lnk.library_id " +
  "WHERE lnk.event_id = e.id AND e.library_entity_ref IS NULL"

export const EV_CREDENTIALS_STATUS_INDEX_NAME =
  "ev_event_credentials_status_idx"
export const EV_CREDENTIAL_EVENTS_INDEX_NAME =
  "ev_credential_events_credential_idx"

export const EV_CREDENTIALS_STATUS_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS ${EV_CREDENTIALS_STATUS_INDEX_NAME} ` +
  "ON ev_event_credentials (status)"
export const EV_CREDENTIAL_EVENTS_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS ${EV_CREDENTIAL_EVENTS_INDEX_NAME} ` +
  "ON ev_credential_events (credential_document_id, created_at)"

type Txn = { raw: (sql: string, bindings?: unknown[]) => Promise<unknown> }

async function indexExists(trx: Txn, indexName: string): Promise<boolean> {
  const result = (await trx.raw(
    "select 1 from pg_indexes where indexname = ?",
    [indexName]
  )) as { rows?: unknown[] } | undefined

  return Array.isArray(result?.rows) && result.rows.length > 0
}

export async function ensureEventIndexes(strapi: any): Promise<void> {
  try {
    const dialect = strapi.db?.dialect?.client
    if (!PG_CLIENTS.has(String(dialect ?? "").toLowerCase())) return

    const connection = strapi.db.connection
    if (!(await connection.schema.hasTable(EV_EVENTS_TABLE))) {
      strapi.log.warn(
        `[events] ${EV_EVENTS_TABLE} not found; event indexes not created`
      )

      return
    }
    if (
      !(await connection.schema.hasColumn(
        EV_EVENTS_TABLE,
        EV_EVENTS_LIBRARY_ENTITY_REF_COLUMN
      ))
    ) {
      strapi.log.warn(
        `[events] ${EV_EVENTS_TABLE}.${EV_EVENTS_LIBRARY_ENTITY_REF_COLUMN} not found; event indexes not created`
      )

      return
    }

    await connection.transaction(async (trx: Txn) => {
      // Fail fast instead of hanging bootstrap behind another DDL lock.
      await trx.raw("SET LOCAL lock_timeout = '5s'")

      if (!(await indexExists(trx, EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME))) {
        // The dedupe is a self-join over the whole table: only while the
        // unique index doesn't exist yet.
        await trx.raw(EV_EVENTS_DEDUPE_SQL)
        await trx.raw(EV_EVENTS_PROVIDER_EXTERNAL_INDEX_SQL)
      }

      if (!(await indexExists(trx, EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME))) {
        await trx.raw(EV_EVENTS_BACKFILL_ENTITY_REF_SQL)
        await trx.raw(EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_SQL)
      }

      if (!(await indexExists(trx, EV_CREDENTIALS_STATUS_INDEX_NAME))) {
        await trx.raw(EV_CREDENTIALS_STATUS_INDEX_SQL)
      }

      if (!(await indexExists(trx, EV_CREDENTIAL_EVENTS_INDEX_NAME))) {
        await trx.raw(EV_CREDENTIAL_EVENTS_INDEX_SQL)
      }
    })
  } catch (err) {
    strapi.log.error("[events] ensureEventIndexes failed", err)
  }
}

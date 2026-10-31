/** Event identity includes its feed installation. Keep the existing index name
 * so older CMS bootstrap code cannot run its destructive cross-feed dedupe.
 * Existing row IDs, document IDs, saved-event references and approval states
 * are never rewritten. An incompatible old worker fails closed on conflict.
 */

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

export const EV_EVENTS_TABLE = "ev_events"
export const EV_EVENTS_LIBRARY_LINK_TABLE = "ev_events_library_lnk"
export const EV_EVENTS_LIBRARY_ENTITY_REF_COLUMN = "library_entity_ref"

export const EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME =
  "ev_events_provider_external_uq"
export const EV_EVENTS_LIBRARY_ENTITY_REF_INDEX_NAME =
  "ev_events_library_entity_ref_idx"

export const EV_EVENTS_PROVIDER_EXTERNAL_INDEX_SQL =
  `CREATE UNIQUE INDEX IF NOT EXISTS ${EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME} ` +
  "ON ev_events (credential_id, source_provider, external_id)"

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

export const EV_EVENTS_CREDENTIAL_START_INDEX_NAME =
  "ev_events_credential_start_idx"
export const EV_EVENTS_CREDENTIAL_START_INDEX_SQL =
  `CREATE INDEX IF NOT EXISTS ${EV_EVENTS_CREDENTIAL_START_INDEX_NAME} ` +
  "ON ev_events (credential_id, start_time)"

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

      const identity = (await trx.raw(
        "select indexdef from pg_indexes where schemaname = current_schema() and indexname = ?",
        [EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME]
      )) as { rows: { indexdef: string }[] }
      if (
        !identity.rows[0]?.indexdef.includes(
          "(credential_id, source_provider, external_id)"
        )
      ) {
        await trx.raw("LOCK TABLE ev_events IN SHARE ROW EXCLUSIVE MODE")
        await trx.raw(
          `DROP INDEX IF EXISTS ${EV_EVENTS_PROVIDER_EXTERNAL_INDEX_NAME}`
        )
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

      if (!(await indexExists(trx, EV_EVENTS_CREDENTIAL_START_INDEX_NAME))) {
        await trx.raw(EV_EVENTS_CREDENTIAL_START_INDEX_SQL)
      }
    })
  } catch (err) {
    strapi.log.error("[events] ensureEventIndexes failed", err)
    throw err
  }
}

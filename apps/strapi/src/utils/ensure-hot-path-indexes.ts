import path from "node:path"

import type { Core } from "@strapi/strapi"

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

type HotPathIndex = {
  name: string
  table: string
  unique: boolean
  before?: string[]
  sql: string
}

type HotPathSql = {
  HOT_PATH_INDEXES: HotPathIndex[]
  CONTRIBUTOR_NUMBER_SEQUENCE: { name: string; table: string; sql: string[] }
}

// Resolved from the app root (not relative to this file) for the same
// reason as `ensure-unique-indexes.ts`: `database/migrations` is never
// compiled, so a path relative to `src/` breaks once the app is built.
function loadHotPathSql(appRoot: string): HotPathSql {
  const modulePath = path.join(
    appRoot,
    "database/migrations/shared/hot-path-index-sql"
  )

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(modulePath) as HotPathSql
}

type Txn = { raw: (sql: string, bindings?: unknown[]) => Promise<unknown> }

async function hasRows(trx: Txn, sql: string, bindings: unknown[]) {
  const result = (await trx.raw(sql, bindings)) as
    | { rows?: unknown[] }
    | undefined

  return Array.isArray(result?.rows) && result.rows.length > 0
}

const indexExists = (trx: Txn, name: string) =>
  hasRows(trx, "select 1 from pg_indexes where indexname = ?", [name])

const sequenceExists = (trx: Txn, name: string) =>
  hasRows(trx, "select 1 from pg_class where relkind = 'S' and relname = ?", [
    name,
  ])

/**
 * E1 fresh-DB follow-up for `2026.09.30T00.00.01.hot-path-indexes`.
 *
 * Strapi runs user migrations before its schema sync creates the tables, so
 * on a brand-new database that migration finds nothing, warns, and is still
 * recorded as applied. This re-applies the same idempotent statements from
 * bootstrap (after schema sync), a no-op on every later boot and on any
 * non-Postgres database.
 *
 * Each index is checked against `pg_indexes` first so the dedupe deletes
 * that precede a unique index only ever run once; the sequence is only
 * seeded when it is first created, so a restart never rewinds it. A
 * `SET LOCAL lock_timeout` keeps bootstrap from hanging behind another DDL
 * lock: it fails fast and only logs.
 */
export async function ensureHotPathIndexes(strapi: Core.Strapi): Promise<void> {
  try {
    const dialect = strapi.db?.dialect?.client
    if (!PG_CLIENTS.has(String(dialect ?? "").toLowerCase())) return

    const { HOT_PATH_INDEXES, CONTRIBUTOR_NUMBER_SEQUENCE } = loadHotPathSql(
      strapi.dirs.app.root
    )
    const connection = strapi.db.connection

    const tables = new Set([
      ...HOT_PATH_INDEXES.map((i) => i.table),
      CONTRIBUTOR_NUMBER_SEQUENCE.table,
    ])
    const present = new Set<string>()
    for (const table of tables) {
      if (await connection.schema.hasTable(table)) present.add(table)
      else strapi.log.warn(`[bootstrap] ${table} not found; its indexes wait`)
    }
    if (present.size === 0) return

    await connection.transaction(async (trx: Txn) => {
      await trx.raw("SET LOCAL lock_timeout = '5s'")

      for (const entry of HOT_PATH_INDEXES) {
        if (!present.has(entry.table)) continue
        if (await indexExists(trx, entry.name)) continue
        for (const before of entry.before ?? []) await trx.raw(before)
        await trx.raw(entry.sql)
      }

      if (
        present.has(CONTRIBUTOR_NUMBER_SEQUENCE.table) &&
        !(await sequenceExists(trx, CONTRIBUTOR_NUMBER_SEQUENCE.name))
      ) {
        for (const sql of CONTRIBUTOR_NUMBER_SEQUENCE.sql) await trx.raw(sql)
      }
    })
  } catch (err) {
    strapi.log.error("[bootstrap] ensureHotPathIndexes failed", err)
  }
}

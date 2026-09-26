import path from "node:path"

import type { Core } from "@strapi/strapi"

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

// The shared SQL module lives under `database/migrations/shared/`, a
// sibling of `src/` (and of `dist/` once built) at the app root — never
// compiled itself, since `database/migrations` isn't part of the `src`
// TypeScript build. A path relative to *this* source file would resolve
// differently once compiled (`dist/src/utils/...` vs `src/utils/...`), so
// it's resolved from `strapi.dirs.app.root` instead, which is stable in
// both dev (ts-node/swc over `src/`) and a built app (`dist/`).
function loadIdempotencySql(appRoot: string) {
  const modulePath = path.join(
    appRoot,
    "database/migrations/shared/idempotency-index-sql"
  )

  // CommonJS module shared with the plain-.js migration (Strapi's migration
  // runner only discovers `.js`/`.sql` files); `require` keeps tsc from
  // trying to resolve it as an ES module, and its path is only known at
  // runtime (built from `appRoot`).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(modulePath) as {
    RW_POINT_EVENTS_TABLE: string
    CM_SUBMISSION_UPLOADS_TABLE: string
    RW_POINT_EVENTS_INDEX_SQL: string
    CM_SUBMISSION_UPLOADS_DEDUPE_SQL: string
    CM_SUBMISSION_UPLOADS_INDEX_SQL: string
  }
}

/**
 * I2 fresh-DB follow-up.
 *
 * The `2026.09.26T00.00.00.unique-idempotency-and-upload-indexes` migration
 * enforces uniqueness on `rw_point_events.idempotency_key` and
 * `cm_submission_uploads.file_id` in the database, since Strapi v5 doesn't
 * create a DB constraint for `"unique": true` in a schema. But Strapi runs
 * user migrations *before* its schema sync creates the content-type tables,
 * so on a brand-new database that migration finds neither table, warns, and
 * does nothing — and is still recorded as applied, so it never runs again.
 * Production's first deploy would end up with no indexes at all.
 *
 * This re-applies the same idempotent `CREATE UNIQUE INDEX IF NOT EXISTS`
 * statements (and the same file_id dedupe) from bootstrap, which runs after
 * schema sync, so the tables are guaranteed to exist by the time this runs
 * on Postgres. It's a no-op every subsequent boot, and a no-op on any
 * non-Postgres database (sqlite in tests/dev).
 *
 * This is a sanctioned raw-SQL use per constraints.md: DB-level uniqueness
 * isn't expressible through the Document Service, and it's the same
 * raw-SQL shape the migration already uses for the same reason.
 */
export async function ensureUniqueIndexes(strapi: Core.Strapi): Promise<void> {
  try {
    const dialect = strapi.db?.dialect?.client
    if (!PG_CLIENTS.has(String(dialect ?? "").toLowerCase())) return

    const {
      RW_POINT_EVENTS_TABLE,
      CM_SUBMISSION_UPLOADS_TABLE,
      RW_POINT_EVENTS_INDEX_SQL,
      CM_SUBMISSION_UPLOADS_DEDUPE_SQL,
      CM_SUBMISSION_UPLOADS_INDEX_SQL,
    } = loadIdempotencySql(strapi.dirs.app.root)

    const connection = strapi.db.connection

    if (await connection.schema.hasTable(RW_POINT_EVENTS_TABLE)) {
      await connection.raw(RW_POINT_EVENTS_INDEX_SQL)
    }

    if (await connection.schema.hasTable(CM_SUBMISSION_UPLOADS_TABLE)) {
      await connection.raw(CM_SUBMISSION_UPLOADS_DEDUPE_SQL)
      await connection.raw(CM_SUBMISSION_UPLOADS_INDEX_SQL)
    }
  } catch (err) {
    strapi.log.error("[bootstrap] ensureUniqueIndexes failed", err)
  }
}

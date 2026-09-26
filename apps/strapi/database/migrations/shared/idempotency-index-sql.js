"use strict"

/**
 * Shared SQL for I2: unique indexes on `rw_point_events.idempotency_key`
 * (rewards idempotency) and `cm_submission_uploads.file_id` (upload
 * ownership). Strapi v5 does not create DB constraints for `"unique": true`,
 * so these are only checked in application code otherwise, which a
 * concurrent pair of requests can race past.
 *
 * Used by both:
 * - the migration `2026.09.26T00.00.00.unique-idempotency-and-upload-indexes.js`
 * - the `ensureUniqueIndexes` bootstrap fallback in `src/utils/ensure-unique-indexes.ts`
 *   (fresh-DB follow-up: Strapi runs user migrations before its schema sync
 *   creates these tables, so on a brand-new database the migration above is
 *   a no-op — and still gets marked done — leaving no indexes. Bootstrap
 *   runs after schema sync and re-applies the same idempotent statements.)
 *
 * Kept as plain CommonJS so the `.js` migration file (Strapi's migration
 * runner only discovers `.js`/`.sql` files unless `useTypescriptMigrations`
 * is set, which it isn't here) can `require()` it directly.
 */

module.exports = {
  RW_POINT_EVENTS_TABLE: "rw_point_events",
  CM_SUBMISSION_UPLOADS_TABLE: "cm_submission_uploads",

  RW_POINT_EVENTS_INDEX_SQL:
    "CREATE UNIQUE INDEX IF NOT EXISTS rw_point_events_idempotency_key_uq " +
    "ON rw_point_events (idempotency_key) WHERE idempotency_key IS NOT NULL",

  // Dedupe first, keeping the lowest id, so the unique index below can build.
  CM_SUBMISSION_UPLOADS_DEDUPE_SQL:
    "DELETE FROM cm_submission_uploads a USING cm_submission_uploads b " +
    "WHERE a.file_id = b.file_id AND a.id > b.id",

  CM_SUBMISSION_UPLOADS_INDEX_SQL:
    "CREATE UNIQUE INDEX IF NOT EXISTS cm_submission_uploads_file_id_uq " +
    "ON cm_submission_uploads (file_id)",
}

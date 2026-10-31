"use strict"

/** Preserve row/document IDs and saved-event relations. The historical index
 * name deliberately stays occupied: old CMS bootstrap must not run its
 * cross-feed deduplication. Old workers fail closed until their matching
 * source is restored; a rollback needs the pre-migration database backup.
 */
module.exports = {
  async up(knex) {
    if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
      return
    if (!(await knex.schema.hasTable("ev_events"))) return
    await knex.transaction(async (trx) => {
      await trx.raw("SET LOCAL lock_timeout = '5s'")
      await trx.raw("LOCK TABLE ev_events IN SHARE ROW EXCLUSIVE MODE")
      await trx.raw("DROP INDEX IF EXISTS ev_events_provider_external_uq")
      await trx.raw(
        "CREATE UNIQUE INDEX ev_events_provider_external_uq ON ev_events (credential_id, source_provider, external_id)"
      )
    })
  },
  async down() {
    throw new Error(
      "Restore the pre-migration backup before using an unscoped event worker"
    )
  },
}

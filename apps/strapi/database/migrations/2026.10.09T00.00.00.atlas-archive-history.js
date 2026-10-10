"use strict"

// Also covers local installations that applied the initial Atlas migration
// before archive retention was implemented. No CMS schema is changed.
async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await knex.raw(
    "ALTER TABLE atlas_state ADD COLUMN IF NOT EXISTS archive_history JSONB NOT NULL DEFAULT '[]'::jsonb"
  )
}
async function down() {}
module.exports = { up, down }

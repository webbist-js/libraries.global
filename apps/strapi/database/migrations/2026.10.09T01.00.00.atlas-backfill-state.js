"use strict"

// Installations that ran the original projection migration before backfill
// support need this column through a new migration, not an edited old one.
async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await knex.raw(
    "ALTER TABLE atlas_state ADD COLUMN IF NOT EXISTS backfill JSONB"
  )
}

// Retain progress on rollback.
async function down() {}

module.exports = { up, down }

"use strict"

const { migrateLibrarySources } = require("./shared/library-sources")

async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await migrateLibrarySources(knex)
}

// Reversing would discard references added since the migration.
async function down() {}

module.exports = { up, down }

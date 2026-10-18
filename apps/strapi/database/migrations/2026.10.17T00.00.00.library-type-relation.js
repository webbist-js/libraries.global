"use strict"

const { migrateLibraryTypes } = require("./shared/library-types")

async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await migrateLibraryTypes(knex)
}

async function down() {}

module.exports = { up, down }

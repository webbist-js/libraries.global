"use strict"
module.exports = {
  async up(knex) {
    if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
      return
    if (!(await knex.schema.hasTable("libraries"))) return
    await knex.transaction(async (trx) => {
      await trx.raw("SET LOCAL lock_timeout = '5s'")
      await trx.raw(
        "CREATE INDEX IF NOT EXISTS libraries_name_id_idx ON libraries (name, id)"
      )
      await trx.raw(
        "CREATE INDEX IF NOT EXISTS libraries_completeness_name_id_idx ON libraries (completeness, name, id)"
      )
      await trx.raw(
        "CREATE INDEX IF NOT EXISTS libraries_created_at_id_idx ON libraries (created_at, id)"
      )
      await trx.raw(
        "CREATE INDEX IF NOT EXISTS libraries_updated_at_id_idx ON libraries (updated_at, id)"
      )
    })
  },
  async down() {},
}

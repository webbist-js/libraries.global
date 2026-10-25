"use strict"

module.exports = {
  async up(knex) {
    await knex.raw(`CREATE INDEX IF NOT EXISTS atlas_analysis_claim
      ON atlas_analysis_jobs (priority DESC, created_at)
      WHERE state = 'pending'`)
  },
  async down() {},
}

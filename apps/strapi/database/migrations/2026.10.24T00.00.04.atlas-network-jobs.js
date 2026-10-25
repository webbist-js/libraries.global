"use strict"
module.exports = {
  async up(knex) {
    // At most 250 server-resolved origins; large geometry remains in files.
    await knex.raw(`ALTER TABLE atlas_analysis_jobs DROP CONSTRAINT IF EXISTS atlas_analysis_jobs_payload_check;
      ALTER TABLE atlas_analysis_jobs ADD CONSTRAINT atlas_analysis_jobs_payload_check CHECK (octet_length(payload::text) <= 131072);`)
  },
  async down() {},
}

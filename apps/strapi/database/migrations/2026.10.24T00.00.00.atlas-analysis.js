"use strict"

/** Small, bounded work metadata only. Population cells/graphs/results are files. */
async function up(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS atlas_analysis_jobs (
      key CHAR(64) PRIMARY KEY,
      document_id VARCHAR(100) NOT NULL,
      coordinate_hash CHAR(64) NOT NULL,
      release_id VARCHAR(128) NOT NULL,
      mode VARCHAR(16) NOT NULL CHECK (mode IN ('walking','cycling')),
      payload JSONB NOT NULL CHECK (octet_length(payload::text) <= 16384),
      state VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending','running','ready','failed','unroutable','unsupported','missing_population')),
      result_key CHAR(64),
      attempts SMALLINT NOT NULL DEFAULT 0,
      priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),
      not_before TIMESTAMPTZ NOT NULL DEFAULT now(),
      claim_until TIMESTAMPTZ,
      claim_token UUID,
      last_error VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
    );
    CREATE INDEX IF NOT EXISTS atlas_analysis_pending ON atlas_analysis_jobs(state, not_before);
    CREATE INDEX IF NOT EXISTS atlas_analysis_expiry ON atlas_analysis_jobs(expires_at);
    CREATE INDEX IF NOT EXISTS atlas_analysis_library ON atlas_analysis_jobs(document_id);
    CREATE TABLE IF NOT EXISTS atlas_analysis_budgets (
      key CHAR(64) NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      used INTEGER NOT NULL CHECK (used > 0),
      PRIMARY KEY(key, window_start)
    );
    CREATE OR REPLACE FUNCTION atlas_analysis_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        DELETE FROM atlas_analysis_jobs WHERE document_id = OLD.document_id;
        RETURN OLD;
      END IF;
      IF NOT NEW.active OR OLD.projection->>'original_lat' IS DISTINCT FROM NEW.projection->>'original_lat'
        OR OLD.projection->>'original_lng' IS DISTINCT FROM NEW.projection->>'original_lng'
        OR OLD.projection->>'status' IS DISTINCT FROM NEW.projection->>'status'
        OR OLD.projection->>'type_group' IS DISTINCT FROM NEW.projection->>'type_group' THEN
        DELETE FROM atlas_analysis_jobs WHERE document_id = NEW.document_id;
      END IF;
      RETURN NEW;
    END $$;
    DROP TRIGGER IF EXISTS atlas_analysis_record_changed ON atlas_records;
    CREATE TRIGGER atlas_analysis_record_changed AFTER UPDATE OR DELETE ON atlas_records
      FOR EACH ROW EXECUTE FUNCTION atlas_analysis_invalidate();
  `)
  await require("./shared/atlas-analysis-grants")(knex)
}

async function down() {
  // Retain durable jobs for recovery. Runtime code does not require a destructive rollback.
}

module.exports = { up, down }

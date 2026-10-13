"use strict"

/** Owned read-model tables. No CMS content schema or canonical row is altered. */
async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS atlas_records (
      atlas_id BIGSERIAL PRIMARY KEY CHECK (atlas_id <= 9007199254740991),
      document_id VARCHAR(200) NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      projection JSONB,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      revision BIGINT NOT NULL DEFAULT 0,
      clock_due TIMESTAMPTZ,
      clock_queued BOOLEAN NOT NULL DEFAULT FALSE,
      projected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS atlas_records_clock_idx ON atlas_records(clock_due) WHERE active;
    CREATE INDEX IF NOT EXISTS atlas_records_projection_idx ON atlas_records USING GIN(projection jsonb_path_ops) WHERE active;
    CREATE TABLE IF NOT EXISTS atlas_outbox (
      id BIGSERIAL PRIMARY KEY,
      kind VARCHAR(20) NOT NULL CHECK (kind IN ('document', 'fanout')),
      entity_id VARCHAR(200) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      attempts INTEGER NOT NULL DEFAULT 0,
      not_before TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      claimed_by UUID,
      claim_until TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS atlas_outbox_pending_idx ON atlas_outbox(not_before, id) WHERE finished_at IS NULL;
    CREATE TABLE IF NOT EXISTS atlas_changes (
      revision BIGINT PRIMARY KEY,
      document_id VARCHAR(200) NOT NULL,
      atlas_id BIGINT NOT NULL REFERENCES atlas_records(atlas_id),
      old_projection JSONB,
      new_projection JSONB,
      old_lat DOUBLE PRECISION,
      old_lng DOUBLE PRECISION,
      new_lat DOUBLE PRECISION,
      new_lng DOUBLE PRECISION,
      removed BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS atlas_changes_old_geo_idx ON atlas_changes(old_lat, old_lng, revision);
    CREATE INDEX IF NOT EXISTS atlas_changes_new_geo_idx ON atlas_changes(new_lat, new_lng, revision);
    CREATE INDEX IF NOT EXISTS atlas_changes_document_idx ON atlas_changes(document_id, revision DESC);
    CREATE INDEX IF NOT EXISTS atlas_changes_retention_idx ON atlas_changes(created_at, revision);
    CREATE TABLE IF NOT EXISTS atlas_state (
      key VARCHAR(32) PRIMARY KEY,
      projection_revision BIGINT NOT NULL DEFAULT 0,
      indexed_through BIGINT NOT NULL DEFAULT 0,
      journal_floor BIGINT NOT NULL DEFAULT 0,
      query_epoch UUID NOT NULL,
      canonical_locale VARCHAR(32) NOT NULL DEFAULT 'en',
      dictionary_version VARCHAR(200) NOT NULL DEFAULT 'initial',
      dictionary JSONB NOT NULL DEFAULT '{"version":"initial","entries":[]}',
      lease_token UUID,
      lease_owner VARCHAR(200),
      lease_until TIMESTAMPTZ,
      heartbeat_at TIMESTAMPTZ,
      build_token UUID,
      build_until TIMESTAMPTZ,
      rebuild JSONB,
      manifest JSONB,
      archive_history JSONB NOT NULL DEFAULT '[]'::jsonb
    );
    CREATE TABLE IF NOT EXISTS atlas_index_batches (
      id BIGSERIAL PRIMARY KEY,
      from_revision BIGINT NOT NULL,
      through_revision BIGINT NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      task_ids JSONB NOT NULL DEFAULT '{}',
      attempts INTEGER NOT NULL DEFAULT 0,
      not_before TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS atlas_index_batches_pending_idx ON atlas_index_batches(id) WHERE completed_at IS NULL;
    ALTER TABLE atlas_state ADD COLUMN IF NOT EXISTS backfill JSONB;
    ALTER TABLE atlas_state ADD COLUMN IF NOT EXISTS archive_history JSONB NOT NULL DEFAULT '[]'::jsonb;
  `)
  const { randomUUID } = require("node:crypto")
  await knex("atlas_state")
    .insert({ key: "current", query_epoch: randomUUID() })
    .onConflict("key")
    .ignore()
}

// This durable queue/journal is intentionally retained on code rollback.
async function down() {}

module.exports = { up, down }

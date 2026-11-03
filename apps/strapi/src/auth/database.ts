import type { Core } from "@strapi/strapi"

/** PostgreSQL invariants not represented by the adapter's generated field schema. */
export async function ensureAuthDatabase(strapi: Core.Strapi) {
  await strapi.db.connection.transaction(async (trx) => {
    await trx.raw("SET LOCAL lock_timeout = '5s'")
    // The adapter uses scalar user IDs, so its schema generator does not create FKs.
    for (const table of ["ba_account", "ba_session", "ba_passkey"]) {
      await trx.raw(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='${table}_auth_user_fk' AND conrelid='${table}'::regclass) THEN
          ALTER TABLE ${table} ADD CONSTRAINT ${table}_auth_user_fk FOREIGN KEY (user_id) REFERENCES ba_user(id) ON DELETE CASCADE;
        END IF;
      END $$`)
    }
    await trx.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS ba_passkey_credential_unique ON ba_passkey (credential_id)"
    )
    await trx.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS ba_account_provider_subject_unique ON ba_account (provider_id, account_id)"
    )
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS ba_session_user_expiry ON ba_session (user_id, expires_at)"
    )
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS ba_account_user ON ba_account (user_id)"
    )
    await trx.raw(`CREATE TABLE IF NOT EXISTS auth_activity_events (
      id bigserial PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('users','sessions')),
      source_id integer NOT NULL,
      user_id integer NOT NULL REFERENCES ba_user(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      UNIQUE(kind,source_id)
    )`)
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS auth_activity_events_feed ON auth_activity_events(kind,id)"
    )
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS auth_activity_events_retention ON auth_activity_events(created_at)"
    )
    await trx.raw(`CREATE OR REPLACE FUNCTION record_strapi_auth_activity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME = 'ba_user' THEN
          INSERT INTO auth_activity_events(kind,source_id,user_id) VALUES('users',NEW.id,NEW.id) ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO auth_activity_events(kind,source_id,user_id) VALUES('sessions',NEW.id,NEW.user_id) ON CONFLICT DO NOTHING;
        END IF;
        RETURN NEW;
      END;
    $$`)
    await trx.raw("DROP TRIGGER IF EXISTS auth_user_created ON ba_user")
    await trx.raw(
      "CREATE TRIGGER auth_user_created AFTER INSERT ON ba_user FOR EACH ROW EXECUTE FUNCTION record_strapi_auth_activity()"
    )
    await trx.raw("DROP TRIGGER IF EXISTS auth_session_created ON ba_session")
    await trx.raw(
      "CREATE TRIGGER auth_session_created AFTER INSERT ON ba_session FOR EACH ROW EXECUTE FUNCTION record_strapi_auth_activity()"
    )
  })
}

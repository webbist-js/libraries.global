-- Minimal committed account/session events. No credentials, emails, IPs or user agents.
-- Apply as the application role before enabling internal notifications.
CREATE TABLE IF NOT EXISTS internal_activity_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('users', 'sessions')),
  source_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (kind, source_id)
);
CREATE INDEX IF NOT EXISTS internal_activity_events_feed ON internal_activity_events (kind, id);
CREATE INDEX IF NOT EXISTS internal_activity_events_retention ON internal_activity_events (created_at);

CREATE OR REPLACE FUNCTION record_internal_auth_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'user' THEN
    INSERT INTO internal_activity_events(kind, source_id, user_id) VALUES ('users', NEW.id, NEW.id) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO internal_activity_events(kind, source_id, user_id) VALUES ('sessions', NEW.id, NEW."userId") ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS internal_user_created ON "user";
CREATE TRIGGER internal_user_created AFTER INSERT ON "user" FOR EACH ROW EXECUTE FUNCTION record_internal_auth_activity();
DROP TRIGGER IF EXISTS internal_session_created ON "session";
CREATE TRIGGER internal_session_created AFTER INSERT ON "session" FOR EACH ROW EXECUTE FUNCTION record_internal_auth_activity();

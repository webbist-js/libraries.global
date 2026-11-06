-- Explicit migration: run billing:migrate before enabling purchases.
-- Shared billing infrastructure, independent of Better Auth's plugin schema.
-- Product tables are in api-schema.sql.
CREATE TABLE IF NOT EXISTS billing_events (
  event_id text PRIMARY KEY,
  subscription_id text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','ignored')),
  event_type text NOT NULL,
  object_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS billing_events_pending ON billing_events(next_attempt_at) WHERE state='pending';
CREATE INDEX IF NOT EXISTS billing_events_completed ON billing_events(completed_at) WHERE completed_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS billing_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 1,
  resets_at timestamptz NOT NULL
);

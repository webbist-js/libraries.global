-- Explicit migration: run billing:migrate before enabling purchases.
-- These tables belong to billing, not to Better Auth's plugin schema.
CREATE TABLE IF NOT EXISTS billing_accounts (
  user_id text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox','live')),
  customer_id text UNIQUE,
  create_token uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleting boolean NOT NULL DEFAULT false,
  erased_at timestamptz
);
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sandbox';
CREATE INDEX IF NOT EXISTS billing_accounts_erased ON billing_accounts(erased_at) WHERE erased_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS billing_attempts (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES billing_accounts(user_id),
  plan text NOT NULL CHECK (plan IN ('supporter','pro')),
  interval text NOT NULL CHECK (interval IN ('month','year')),
  price_id text NOT NULL,
  terms_version text NOT NULL,
  session_id text UNIQUE,
  subscription_id text,
  checkout_url text,
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','open','complete','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE billing_attempts ADD COLUMN IF NOT EXISTS reconciled_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS billing_attempts_one_open
  ON billing_attempts(user_id) WHERE state IN ('preparing','open');
ALTER TABLE billing_attempts ADD COLUMN IF NOT EXISTS subscription_id text;
CREATE TABLE IF NOT EXISTS billing_memberships (
  subscription_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES billing_accounts(user_id),
  snapshot jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  synced_revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_memberships_owner ON billing_memberships(user_id);
ALTER TABLE billing_memberships ADD COLUMN IF NOT EXISTS reconciled_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE billing_memberships ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE billing_memberships ADD COLUMN IF NOT EXISTS next_sync_at timestamptz NOT NULL DEFAULT now();
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
CREATE TABLE IF NOT EXISTS billing_plan_changes (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES billing_accounts(user_id),
  subscription_id text NOT NULL,
  price_id text NOT NULL,
  period_end bigint NOT NULL,
  schedule_id text,
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','scheduled','released')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_plan_changes_pending ON billing_plan_changes(subscription_id) WHERE state IN ('preparing','scheduled');

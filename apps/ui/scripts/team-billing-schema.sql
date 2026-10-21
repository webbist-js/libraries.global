-- Team subscriptions are organisation-owned and independent of personal/API billing.
CREATE TABLE IF NOT EXISTS team_billing_erasing_users (
  user_id text PRIMARY KEY,
  erased_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_billing_accounts (
  id uuid PRIMARY KEY,
  team_id text UNIQUE,
  creator_id text NOT NULL,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('sandbox','live')),
  customer_id text UNIQUE,
  customer_payload jsonb,
  customer_started_at timestamptz,
  current_subscription_id text,
  revision bigint NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_billing_creator ON team_billing_accounts(creator_id);
CREATE TABLE IF NOT EXISTS team_billing_attempts (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES team_billing_accounts(id),
  actor_id text NOT NULL,
  price_id text NOT NULL,
  seats integer NOT NULL CHECK (seats BETWEEN 5 AND 500),
  terms_version text NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','fr','cs')),
  session_id text UNIQUE,
  subscription_id text,
  checkout_url text,
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','open','complete','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_billing_one_open ON team_billing_attempts(account_id) WHERE state IN ('preparing','open');
CREATE TABLE IF NOT EXISTS team_billing_memberships (
  subscription_id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES team_billing_accounts(id),
  snapshot jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  synced_revision bigint NOT NULL DEFAULT 0,
  sync_attempts integer NOT NULL DEFAULT 0,
  next_sync_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_billing_membership_account ON team_billing_memberships(account_id);

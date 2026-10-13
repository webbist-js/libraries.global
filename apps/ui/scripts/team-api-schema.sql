-- Owned by the Team API module; no credentials or user-profile content here.
CREATE TABLE IF NOT EXISTS team_api_accounts (
  team_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('sandbox','live')),
  customer_id text UNIQUE,
  create_token uuid NOT NULL,
  customer_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_api_attempts (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES team_api_accounts(team_id),
  actor_id text,
  price_id text NOT NULL,
  terms_version text NOT NULL,
  limits jsonb NOT NULL,
  locale text NOT NULL CHECK (locale IN ('en','cs','fr')),
  session_id text UNIQUE,
  subscription_id text,
  checkout_url text,
  state text NOT NULL DEFAULT 'preparing' CHECK (state IN ('preparing','open','complete','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_api_attempt_one_open
  ON team_api_attempts(team_id) WHERE state IN ('preparing','open');
CREATE TABLE IF NOT EXISTS team_api_memberships (
  subscription_id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES team_api_accounts(team_id),
  snapshot jsonb NOT NULL,
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_api_membership_team ON team_api_memberships(team_id);
CREATE TABLE IF NOT EXISTS team_api_keys (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES team_api_accounts(team_id),
  name text NOT NULL,
  prefix text NOT NULL,
  digest text NOT NULL UNIQUE,
  scopes text[] NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS team_api_key_team ON team_api_keys(team_id);
CREATE TABLE IF NOT EXISTS team_api_usage (
  team_id text NOT NULL REFERENCES team_api_accounts(team_id),
  month timestamptz NOT NULL,
  requests bigint NOT NULL DEFAULT 0 CHECK (requests >= 0),
  bytes bigint NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  PRIMARY KEY(team_id,month)
);
CREATE TABLE IF NOT EXISTS team_api_requests (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES team_api_accounts(team_id),
  key_id uuid NOT NULL REFERENCES team_api_keys(id),
  month timestamptz NOT NULL,
  endpoint text NOT NULL,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','complete')),
  reserved_bytes bigint NOT NULL,
  response_bytes bigint NOT NULL DEFAULT 0,
  status integer,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS team_api_requests_team_time ON team_api_requests(team_id,started_at);
CREATE INDEX IF NOT EXISTS team_api_requests_team_month ON team_api_requests(team_id,month);
CREATE INDEX IF NOT EXISTS team_api_requests_key_month ON team_api_requests(key_id,month);
CREATE INDEX IF NOT EXISTS team_api_requests_reserved ON team_api_requests(started_at) WHERE state='reserved';
CREATE TABLE IF NOT EXISTS team_api_audit (
  id bigserial PRIMARY KEY,
  team_id text NOT NULL,
  actor_id text,
  key_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

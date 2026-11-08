-- API account billing and usage ledger (November 2026 beta reset).
-- Owned by apps/ui/src/lib/team-api. No credentials, query text, request
-- bodies, IP addresses or user-profile content are stored here.

-- One API account per organisation (CMS Team document id).
CREATE TABLE IF NOT EXISTS api_accounts (
  team_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('sandbox','live')),
  customer_id text UNIQUE,
  create_token uuid NOT NULL,
  customer_payload jsonb,
  -- Current overage settings; every change is also in api_overage_changes.
  overage_enabled boolean NOT NULL DEFAULT false,
  overage_cap_pence integer NOT NULL DEFAULT 0
    CHECK (overage_cap_pence BETWEEN 0 AND 50000 AND overage_cap_pence % 1000 = 0),
  overage_revision integer NOT NULL DEFAULT 0,
  overage_updated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Versioned, append-only audit of overage consent and cap changes.
CREATE TABLE IF NOT EXISTS api_overage_changes (
  id bigserial PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  revision integer NOT NULL,
  actor_id text NOT NULL,
  enabled boolean NOT NULL,
  cap_pence integer NOT NULL,
  terms_version text,
  rates jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, revision)
);

CREATE TABLE IF NOT EXISTS api_attempts (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  actor_id text,
  price_id text NOT NULL,
  -- Immutable purchase snapshot: offer version, price, tax behaviour, limits,
  -- overage rates and prices, and consent version.
  offer jsonb NOT NULL,
  locale text NOT NULL CHECK (locale IN ('cs','en','es','fr','ja')),
  session_id text UNIQUE,
  subscription_id text,
  checkout_url text,
  state text NOT NULL DEFAULT 'preparing'
    CHECK (state IN ('preparing','open','complete','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS api_attempt_one_open
  ON api_attempts(team_id) WHERE state IN ('preparing','open');

-- Paid projection from settled invoice lines. The CMS session profile reads
-- snapshot->>'paidThrough', 'revoked' and 'mode' for session apiAccounts.
CREATE TABLE IF NOT EXISTS api_subscriptions (
  subscription_id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  snapshot jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  reconciled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_subscription_team ON api_subscriptions(team_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
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
CREATE INDEX IF NOT EXISTS api_key_team ON api_keys(team_id);

-- One row per settled paid period: the customer/period lock and its counters.
-- settled_* are successful, billable units; reserved_* are in flight.
CREATE TABLE IF NOT EXISTS api_periods (
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  subscription_id text NOT NULL,
  -- The purchase snapshot's included limits and overage rates for this period.
  limits jsonb NOT NULL,
  rates jsonb NOT NULL,
  settled_requests bigint NOT NULL DEFAULT 0 CHECK (settled_requests >= 0),
  settled_bytes bigint NOT NULL DEFAULT 0 CHECK (settled_bytes >= 0),
  settled_credits bigint NOT NULL DEFAULT 0 CHECK (settled_credits >= 0),
  reserved_requests bigint NOT NULL DEFAULT 0 CHECK (reserved_requests >= 0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  reserved_credits bigint NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  reconciliation text NOT NULL DEFAULT 'open'
    CHECK (reconciliation IN ('open','reconciled','mismatch','unpaid')),
  reconciliation_detail jsonb,
  reconciliation_checked_at timestamptz,
  PRIMARY KEY (team_id, period_start),
  CHECK (period_end > period_start)
);
CREATE INDEX IF NOT EXISTS api_periods_unreconciled
  ON api_periods(period_end) WHERE reconciliation <> 'reconciled';

CREATE TABLE IF NOT EXISTS api_requests (
  id uuid PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  key_id uuid NOT NULL REFERENCES api_keys(id),
  period_start timestamptz,
  endpoint text NOT NULL,
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','complete')),
  reserved_bytes bigint NOT NULL DEFAULT 0,
  reserved_credits integer NOT NULL DEFAULT 0,
  response_bytes bigint NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  status integer,
  refusal text,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_requests_team_time ON api_requests(team_id,started_at);
CREATE INDEX IF NOT EXISTS api_requests_team_period ON api_requests(team_id,period_start);
CREATE INDEX IF NOT EXISTS api_requests_key_period ON api_requests(key_id,period_start);
CREATE INDEX IF NOT EXISTS api_requests_reserved ON api_requests(started_at) WHERE state='reserved';
CREATE INDEX IF NOT EXISTS api_requests_concurrent ON api_requests(team_id) WHERE state='reserved';

-- Asynchronous analysis credit reservations, exactly once per stable job id.
CREATE TABLE IF NOT EXISTS api_analysis_jobs (
  job_id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  period_start timestamptz NOT NULL,
  credits integer NOT NULL CHECK (credits > 0 AND credits <= 1000),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','settled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_analysis_reserved ON api_analysis_jobs(created_at) WHERE state='reserved';

-- Immutable usage events: one per settled request or completed job. The id is
-- the Stripe meter idempotency identifier for each dimension delivered.
CREATE TABLE IF NOT EXISTS api_usage_events (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  period_start timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('request','analysis')),
  endpoint text,
  requests integer NOT NULL CHECK (requests >= 0),
  bytes bigint NOT NULL CHECK (bytes >= 0),
  credits integer NOT NULL CHECK (credits >= 0),
  overage_requests bigint NOT NULL DEFAULT 0 CHECK (overage_requests >= 0),
  overage_kib bigint NOT NULL DEFAULT 0 CHECK (overage_kib >= 0),
  overage_credits bigint NOT NULL DEFAULT 0 CHECK (overage_credits >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_usage_events_period ON api_usage_events(team_id,period_start);
CREATE OR REPLACE FUNCTION api_usage_events_immutable() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'api_usage_events are immutable';
END $$;
DROP TRIGGER IF EXISTS api_usage_events_no_update ON api_usage_events;
CREATE TRIGGER api_usage_events_no_update BEFORE UPDATE ON api_usage_events
  FOR EACH ROW EXECUTE FUNCTION api_usage_events_immutable();

-- Stripe meter delivery queue with bounded retries and a dead-letter state.
CREATE TABLE IF NOT EXISTS api_meter_deliveries (
  event_id text NOT NULL REFERENCES api_usage_events(id),
  dimension text NOT NULL CHECK (dimension IN ('requests','bytes','credits')),
  team_id text NOT NULL,
  period_start timestamptz NOT NULL,
  quantity bigint NOT NULL CHECK (quantity > 0),
  occurred_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','delivered','dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  delivered_at timestamptz,
  PRIMARY KEY (event_id, dimension)
);
CREATE INDEX IF NOT EXISTS api_meter_pending ON api_meter_deliveries(next_attempt_at) WHERE state='pending';
CREATE INDEX IF NOT EXISTS api_meter_period ON api_meter_deliveries(team_id,period_start,dimension);

-- Deduplicated 50/80/100% warnings per allowance and for the overage cap.
CREATE TABLE IF NOT EXISTS api_warnings (
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  period_start timestamptz NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('requests','bytes','credits','cap')),
  threshold integer NOT NULL CHECK (threshold IN (50,80,100)),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  PRIMARY KEY (team_id, period_start, dimension, threshold)
);
CREATE INDEX IF NOT EXISTS api_warnings_pending ON api_warnings(next_attempt_at) WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS api_audit (
  id bigserial PRIMARY KEY,
  team_id text NOT NULL,
  actor_id text,
  key_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Machine analysis jobs (summary and Reach). One row per accepted job; the
-- job id is also the api_analysis_jobs credit reservation id. `input` holds
-- only canonical published refs and enumerated options, never query text.
-- Results are deleted at result_expires_at; rows at expires_at + 30 days.
CREATE TABLE IF NOT EXISTS api_jobs (
  id text PRIMARY KEY CHECK (id ~ '^(reach|summary):[A-Za-z0-9_-]{22}$'),
  team_id text NOT NULL REFERENCES api_accounts(team_id),
  key_id uuid NOT NULL REFERENCES api_keys(id),
  kind text NOT NULL CHECK (kind IN ('summary','reach')),
  operation text NOT NULL,
  input_hash text NOT NULL,
  input jsonb NOT NULL,
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 1000),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','complete','failed','expired')),
  charge text NOT NULL DEFAULT 'reserved'
    CHECK (charge IN ('reserved','settled','refunded')),
  -- Credits settled for this job: 0 for a cached result, else `credits`.
  spent integer CHECK (spent >= 0 AND spent <= credits),
  cached boolean NOT NULL DEFAULT false,
  error text,
  result jsonb,
  result_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  result_expires_at timestamptz
);
-- Replay protection: one open job per account and identical input.
CREATE UNIQUE INDEX IF NOT EXISTS api_jobs_one_open
  ON api_jobs(team_id, input_hash) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS api_jobs_reuse
  ON api_jobs(team_id, input_hash, result_expires_at) WHERE state = 'complete';
CREATE INDEX IF NOT EXISTS api_jobs_open_expiry
  ON api_jobs(expires_at) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS api_jobs_open_team
  ON api_jobs(team_id) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS api_jobs_result_expiry
  ON api_jobs(result_expires_at) WHERE result IS NOT NULL;
CREATE INDEX IF NOT EXISTS api_jobs_created ON api_jobs(created_at);

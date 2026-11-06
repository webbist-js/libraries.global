import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"

import type { Pool, PoolClient } from "pg"

import { BillingError } from "@/lib/billing/config"

import { apiAccessActive, apiConfig } from "./config"
import { API_WARNING_THRESHOLDS } from "./constants"
import {
  admit,
  capThresholdsCrossed,
  overageDeltas,
  overageScaled,
  thresholdsCrossed,
  totalsOf,
  type Demand,
  type LedgerState,
  type QuotaCode,
} from "./ledger"
import { currentPeriod, overagePermitted } from "./period"
import type {
  ApiKeyView,
  ApiLimits,
  ApiMembership,
  ApiOverageRates,
  ApiPeriod,
  ApiScope,
  ApiUsageTotals,
} from "./types"

// API credentials are generated below from 32 CSPRNG bytes; callers cannot
// choose their value. SHA-256 gives indexed lookup of these high-entropy tokens.
// User passwords use Better Auth's password-hashing scheme instead.
export const keyDigest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex")
const token = () => `lg_api_${randomBytes(32).toString("base64url")}`
type Queryable = Pick<Pool, "query">

/** Reservations abandoned for this long are refunded by maintenance. */
export const REQUEST_RESERVATION_TTL_SECONDS = 120
export const ANALYSIS_RESERVATION_TTL_SECONDS = 3600
/** A useful response needs at least this much byte allowance. */
const MIN_RESPONSE_BYTES = 128

export type KeyRow = {
  id: string
  team_id: string
  created_by: string | null
  name: string
  prefix: string
  scopes: ApiScope[]
  created_at: Date
  expires_at: Date | null
  last_used_at: Date | null
  revoked_at: Date | null
}

type AccountRow = {
  team_id: string
  mode: string
  customer_id: string | null
  overage_enabled: boolean
  overage_cap_pence: number
  overage_revision: number
  overage_updated_at: Date | null
  closed_at: Date | null
}

type PeriodRow = {
  team_id: string
  period_start: Date
  period_end: Date
  subscription_id: string
  limits: ApiLimits
  rates: ApiOverageRates
  settled_requests: string
  settled_bytes: string
  settled_credits: string
  reserved_requests: string
  reserved_bytes: string
  reserved_credits: string
}

export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>
) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")

    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Lock order everywhere: account row, then period row, then request/job row. */
async function lockAccount(client: PoolClient, teamId: string) {
  const result = await client.query<AccountRow>(
    "select * from api_accounts where team_id=$1 for update",
    [teamId]
  )

  return result.rows[0] ?? null
}

/** The covered subscription if any, else the most recently reconciled one. */
export async function apiSubscription(db: Queryable, teamId: string) {
  const result = await db.query<{
    subscription_id: string
    snapshot: ApiMembership
  }>(
    "select subscription_id,snapshot from api_subscriptions where team_id=$1 order by reconciled_at desc limit 10",
    [teamId]
  )
  const row =
    result.rows.find((r) => apiAccessActive(r.snapshot)) ?? result.rows[0]

  return row
    ? { subscriptionId: row.subscription_id, membership: row.snapshot }
    : null
}

export async function apiMembership(db: Queryable, teamId: string) {
  return (await apiSubscription(db, teamId))?.membership ?? null
}

const ledgerState = (row: PeriodRow): LedgerState => ({
  settled: {
    requests: Number(row.settled_requests),
    bytes: Number(row.settled_bytes),
    credits: Number(row.settled_credits),
  },
  reserved: {
    requests: Number(row.reserved_requests),
    bytes: Number(row.reserved_bytes),
    credits: Number(row.reserved_credits),
  },
})

async function lockPeriod(
  client: PoolClient,
  teamId: string,
  subscriptionId: string,
  period: ApiPeriod,
  membership: ApiMembership
) {
  await client.query(
    "insert into api_periods(team_id,period_start,period_end,subscription_id,limits,rates) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
    [
      teamId,
      period.start,
      period.end,
      subscriptionId,
      membership.offer.limits,
      membership.offer.overageRates,
    ]
  )

  return lockExistingPeriod(client, teamId, period.start)
}

async function lockExistingPeriod(
  client: PoolClient,
  teamId: string,
  start: Date | string
) {
  const result = await client.query<PeriodRow>(
    "select * from api_periods where team_id=$1 and period_start=$2 for update",
    [teamId, start]
  )
  if (!result.rows[0]) throw new BillingError("api_period_missing")

  return result.rows[0]
}

/** Overage applies only with consent, the feature flag and good standing. */
function overagePolicy(
  account: AccountRow,
  membership: ApiMembership,
  now: Date
) {
  const config = apiConfig()

  return account.overage_enabled &&
    account.overage_cap_pence > 0 &&
    config.overage &&
    overagePermitted(membership, config.mode, now)
    ? { capPence: account.overage_cap_pence }
    : null
}

async function recordWarnings(
  client: PoolClient,
  teamId: string,
  periodStart: Date | string,
  warnings: { dimension: string; threshold: number }[]
) {
  for (const w of warnings)
    await client.query(
      "insert into api_warnings(team_id,period_start,dimension,threshold) values($1,$2,$3,$4) on conflict do nothing",
      [teamId, periodStart, w.dimension, w.threshold]
    )
}

const QUOTA_DIMENSION: Record<QuotaCode, string> = {
  quota_requests: "requests",
  quota_bytes: "bytes",
  quota_analysis: "credits",
  overage_cap: "cap",
}

/** Apply a settlement to the period and record its immutable usage event. */
async function settleUsage(
  client: PoolClient,
  account: AccountRow,
  period: PeriodRow,
  usage: {
    eventId: string
    kind: "request" | "analysis"
    endpoint: string | null
    reserved: ApiUsageTotals
    actual: ApiUsageTotals
  }
) {
  const before = ledgerState(period).settled
  const after = {
    requests: before.requests + usage.actual.requests,
    bytes: before.bytes + usage.actual.bytes,
    credits: before.credits + usage.actual.credits,
  }
  await client.query(
    "update api_periods set reserved_requests=reserved_requests-$3,reserved_bytes=reserved_bytes-$4,reserved_credits=reserved_credits-$5,settled_requests=settled_requests+$6,settled_bytes=settled_bytes+$7,settled_credits=settled_credits+$8 where team_id=$1 and period_start=$2",
    [
      period.team_id,
      period.period_start,
      usage.reserved.requests,
      usage.reserved.bytes,
      usage.reserved.credits,
      usage.actual.requests,
      usage.actual.bytes,
      usage.actual.credits,
    ]
  )
  if (!usage.actual.requests && !usage.actual.bytes && !usage.actual.credits)
    return
  const limits = period.limits
  const deltas = overageDeltas(before, after, limits)
  // A Stripe meter event may carry a timestamp only within its paid period.
  const occurred = new Date(
    Math.min(Date.now(), period.period_end.getTime() - 1000)
  )
  const inserted = await client.query(
    "insert into api_usage_events(id,team_id,period_start,kind,endpoint,requests,bytes,credits,overage_requests,overage_kib,overage_credits,occurred_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(id) do nothing returning id",
    [
      usage.eventId,
      period.team_id,
      period.period_start,
      usage.kind,
      usage.endpoint,
      usage.actual.requests,
      usage.actual.bytes,
      usage.actual.credits,
      deltas.requests,
      deltas.kib,
      deltas.credits,
      occurred,
    ]
  )
  if (!inserted.rowCount) throw new BillingError("api_usage_event_conflict")
  for (const [dimension, quantity] of [
    ["requests", deltas.requests],
    ["bytes", deltas.kib],
    ["credits", deltas.credits],
  ] as const)
    if (quantity > 0)
      await client.query(
        "insert into api_meter_deliveries(event_id,dimension,team_id,period_start,quantity,occurred_at) values($1,$2,$3,$4,$5,$6)",
        [
          usage.eventId,
          dimension,
          period.team_id,
          period.period_start,
          quantity,
          occurred,
        ]
      )
  const warnings = [
    ...(["requests", "bytes", "credits"] as const).flatMap((dimension) =>
      thresholdsCrossed(
        before[dimension],
        after[dimension],
        dimension === "credits" ? limits.analysisCredits : limits[dimension],
        API_WARNING_THRESHOLDS
      ).map((threshold) => ({ dimension, threshold }))
    ),
    ...capThresholdsCrossed(
      overageScaled(before, limits, period.rates),
      overageScaled(after, limits, period.rates),
      account.overage_cap_pence,
      API_WARNING_THRESHOLDS
    ).map((threshold) => ({ dimension: "cap", threshold })),
  ]
  await recordWarnings(client, period.team_id, period.period_start, warnings)
}

export async function createApiKey(
  pool: Pool,
  teamId: string,
  actorId: string,
  input: { name: string; scopes: ApiScope[]; expiresAt: string | null }
) {
  return transaction(pool, async (client) => {
    const account = await lockAccount(client, teamId)
    const membership = account ? await apiMembership(client, teamId) : null
    if (!account || account.closed_at || !apiAccessActive(membership))
      throw new BillingError("api_access_required", 403)
    const secret = token(),
      id = randomUUID()
    await client.query(
      "insert into api_keys(id,team_id,name,prefix,digest,scopes,created_by,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        teamId,
        input.name,
        secret.slice(0, 17),
        keyDigest(secret),
        input.scopes,
        actorId,
        input.expiresAt,
      ]
    )
    await client.query(
      "insert into api_audit(team_id,actor_id,key_id,action) values($1,$2,$3,'created')",
      [teamId, actorId, id]
    )

    return { id, secret }
  })
}

export async function changeApiKey(
  pool: Pool,
  teamId: string,
  actorId: string,
  id: string,
  rotate: boolean
) {
  return transaction(pool, async (client) => {
    await lockAccount(client, teamId)
    const row = await client.query<KeyRow>(
      "select * from api_keys where id=$1 and team_id=$2 for update",
      [id, teamId]
    )
    if (!row.rows[0]) throw new BillingError("api_key_not_found", 404)
    if (
      rotate &&
      (row.rows[0].revoked_at ||
        (row.rows[0].expires_at && row.rows[0].expires_at <= new Date()))
    )
      throw new BillingError("api_key_inactive", 409)
    if (rotate && !apiAccessActive(await apiMembership(client, teamId)))
      throw new BillingError("api_access_required", 403)
    const secret = rotate ? token() : null
    await (secret
      ? client.query("update api_keys set digest=$2,prefix=$3 where id=$1", [
          id,
          keyDigest(secret),
          secret.slice(0, 17),
        ])
      : client.query(
          "update api_keys set revoked_at=coalesce(revoked_at,now()) where id=$1",
          [id]
        ))
    await client.query(
      "insert into api_audit(team_id,actor_id,key_id,action) values($1,$2,$3,$4)",
      [teamId, actorId, id, rotate ? "regenerated" : "revoked"]
    )

    return { id, secret }
  })
}

export async function findApiKey(pool: Pool, secret: string): Promise<KeyRow> {
  if (!/^lg_api_[\w-]{43}$/.test(secret))
    throw new BillingError("invalid_api_key", 401)
  const result = await pool.query<KeyRow>(
    "select * from api_keys where digest=$1 and revoked_at is null and (expires_at is null or expires_at>now())",
    [keyDigest(secret)]
  )
  if (!result.rows[0]) throw new BillingError("invalid_api_key", 401)

  return result.rows[0]
}

export type ApiRemaining = { requests: number; bytes: number; credits: number }

export type ApiReservation = {
  id: string
  teamId: string
  keyId: string
  periodStart: string
  /** Most response bytes this request may deliver. */
  budget: number
  /** Analysis credits reserved for this request. */
  credits: number
  resetsAt: string
  /** Included units left after this reservation (overage not counted). */
  remaining: ApiRemaining
}

/** A refused admission; `retryAfter` is in seconds when meaningful. */
export class ApiRefusal extends BillingError {
  constructor(
    code: string,
    status: number,
    public readonly retryAfter: number | null,
    public readonly resetsAt: string | null = null
  ) {
    super(code, status)
  }
}

const remainingOf = (state: LedgerState, limits: ApiLimits): ApiRemaining => {
  const used = totalsOf(state)

  return {
    requests: Math.max(0, limits.requests - used.requests),
    bytes: Math.max(0, limits.bytes - used.bytes),
    credits: Math.max(0, limits.analysisCredits - used.credits),
  }
}

const secondsUntil = (iso: string | Date, now: Date) =>
  Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / 1000))

export async function reserveApiRequest(
  pool: Pool,
  key: KeyRow,
  secret: string,
  scope: ApiScope,
  endpoint: string,
  options: { analysisCredits?: number } = {}
): Promise<ApiReservation> {
  const credits = options.analysisCredits ?? 0
  if (!Number.isSafeInteger(credits) || credits < 0 || credits > 1000)
    throw new BillingError("api_operation_invalid", 500)
  const now = new Date()
  const result = await transaction(pool, async (client) => {
    const account = await lockAccount(client, key.team_id)
    if (!account || account.closed_at)
      throw new BillingError("api_access_inactive", 403)
    const current = await client.query<KeyRow>(
      "select * from api_keys where id=$1 and digest=$2 and revoked_at is null and (expires_at is null or expires_at>now()) for update",
      [key.id, keyDigest(secret)]
    )
    if (!current.rows[0]) throw new BillingError("invalid_api_key", 401)
    const subscription = await apiSubscription(client, key.team_id)
    const membership = subscription?.membership ?? null
    if (!subscription || !apiAccessActive(membership, now))
      throw new BillingError("api_access_inactive", 403)
    const limits = membership.offer.limits
    const period = currentPeriod(membership, now)!
    const refuse = async (
      code: string,
      status: number,
      retryAfter: number | null,
      resetsAt: string | null = null
    ) => {
      await client.query(
        "insert into api_requests(id,team_id,key_id,period_start,endpoint,state,status,refusal,finished_at) values($1,$2,$3,$4,$5,'complete',$6,$7,now())",
        [
          randomUUID(),
          key.team_id,
          key.id,
          period.start,
          endpoint,
          status,
          code,
        ]
      )

      return { refused: new ApiRefusal(code, status, retryAfter, resetsAt) }
    }
    // Rate counters are committed even on refusal. Regenerating a key keeps its
    // id; every key of the account shares the account counter.
    const rates = await client.query<{ hits: number; resets_at: Date }>(
      "insert into billing_rate_limits(key,hits,resets_at) select unnest($1::text[]),1,now()+interval '1 minute' on conflict(key) do update set hits=case when billing_rate_limits.resets_at<=now() then 1 else billing_rate_limits.hits+1 end,resets_at=case when billing_rate_limits.resets_at<=now() then now()+interval '1 minute' else billing_rate_limits.resets_at end returning hits,resets_at",
      [[`api:account:${key.team_id}`, `api:key:${key.id}`]]
    )
    const limited = rates.rows.filter((rate) => rate.hits > limits.perMinute)
    if (limited.length)
      return refuse(
        "rate_limit",
        429,
        Math.max(...limited.map((rate) => secondsUntil(rate.resets_at, now)))
      )
    if (!current.rows[0].scopes.includes(scope))
      return refuse("api_scope_refused", 403, null)
    const concurrent = await client.query<{ count: string }>(
      "select count(*) from api_requests where team_id=$1 and state='reserved'",
      [key.team_id]
    )
    if (Number(concurrent.rows[0]?.count) >= limits.concurrency)
      return refuse("concurrency_limit", 429, 1)
    const row = await lockPeriod(
      client,
      key.team_id,
      subscription.subscriptionId,
      period,
      membership
    )
    const state = ledgerState(row)
    const demand: Demand = {
      requests: 1,
      maxBytes: limits.responseBytes,
      credits,
      minBytes: MIN_RESPONSE_BYTES,
    }
    const admission = admit(
      state,
      demand,
      row.limits,
      row.rates,
      overagePolicy(account, membership, now)
    )
    if (!admission.ok) {
      await recordWarnings(client, key.team_id, period.start, [
        { dimension: QUOTA_DIMENSION[admission.code], threshold: 100 },
      ])

      return refuse(
        admission.code,
        429,
        secondsUntil(period.end, now),
        period.end
      )
    }
    const id = randomUUID()
    await client.query(
      "update api_periods set reserved_requests=reserved_requests+1,reserved_bytes=reserved_bytes+$3,reserved_credits=reserved_credits+$4 where team_id=$1 and period_start=$2",
      [key.team_id, period.start, admission.bytes, credits]
    )
    await client.query(
      "insert into api_requests(id,team_id,key_id,period_start,endpoint,reserved_bytes,reserved_credits) values($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        key.team_id,
        key.id,
        period.start,
        endpoint,
        admission.bytes,
        credits,
      ]
    )
    const after: LedgerState = {
      settled: state.settled,
      reserved: {
        requests: state.reserved.requests + 1,
        bytes: state.reserved.bytes + admission.bytes,
        credits: state.reserved.credits + credits,
      },
    }

    return {
      reservation: {
        id,
        teamId: key.team_id,
        keyId: key.id,
        periodStart: new Date(period.start).toISOString(),
        budget: admission.bytes,
        credits,
        resetsAt: new Date(period.end).toISOString(),
        remaining: remainingOf(after, row.limits),
      },
    }
  })
  if ("refused" in result) throw result.refused

  return result.reservation
}

/**
 * Settle a request exactly once: successful bytes and credits become billable
 * usage events; failures refund the whole reservation. Returns false when the
 * reservation was already settled (accounting retries never charge twice).
 */
export async function finishApiRequest(
  pool: Pool,
  reservation: Pick<ApiReservation, "id" | "teamId">,
  outcome: { status: number; bytes: number; credits?: number; duration: number }
) {
  return transaction(pool, async (client) => {
    const account = await lockAccount(client, reservation.teamId)
    const query = await client.query<{
      period_start: Date
      reserved_bytes: string
      reserved_credits: number
      key_id: string
      endpoint: string
    }>(
      "select period_start,reserved_bytes,reserved_credits,key_id,endpoint from api_requests where id=$1 and team_id=$2 and state='reserved' for update",
      [reservation.id, reservation.teamId]
    )
    const row = query.rows[0]
    if (!row || !account) return false
    const successful = outcome.status >= 200 && outcome.status < 300
    const bytes = successful ? outcome.bytes : 0
    const credits = successful ? (outcome.credits ?? row.reserved_credits) : 0
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      bytes > Number(row.reserved_bytes)
    )
      throw new BillingError("api_response_too_large", 502)
    if (
      !Number.isSafeInteger(credits) ||
      credits < 0 ||
      credits > row.reserved_credits
    )
      throw new BillingError("api_operation_invalid", 500)
    const period = await lockExistingPeriod(
      client,
      reservation.teamId,
      row.period_start
    )
    await settleUsage(client, account, period, {
      eventId: `req:${reservation.id}`,
      kind: "request",
      endpoint: row.endpoint,
      reserved: {
        requests: 1,
        bytes: Number(row.reserved_bytes),
        credits: row.reserved_credits,
      },
      actual: { requests: successful ? 1 : 0, bytes, credits },
    })
    await client.query(
      "update api_requests set state='complete',status=$2,response_bytes=$3,credits=$4,duration_ms=$5,finished_at=now() where id=$1",
      [
        reservation.id,
        outcome.status,
        bytes,
        credits,
        Math.max(0, Math.min(3_600_000, Math.round(outcome.duration))),
      ]
    )
    if (successful)
      await client.query("update api_keys set last_used_at=now() where id=$1", [
        row.key_id,
      ])

    return true
  })
}

/** Stable job ids; short enough for Stripe meter identifiers (`job:<id>:<dimension>`). */
const JOB_ID = /^[\w:.-]{1,80}$/

export type AnalysisReservation = {
  jobId: string
  state: "reserved" | "settled" | "refunded"
  credits: number
  resetsAt: string
}

/**
 * Reserve analysis credits for an asynchronous job, exactly once per stable
 * job id. A repeated call returns the existing reservation without spending
 * again. Refuses early (429 `quota_analysis` / `overage_cap`) when the worst
 * case cannot fit.
 */
export async function reserveAnalysisCredits(
  pool: Pool,
  teamId: string,
  jobId: string,
  credits: number
): Promise<AnalysisReservation> {
  if (
    !JOB_ID.test(jobId) ||
    !Number.isSafeInteger(credits) ||
    credits < 1 ||
    credits > 1000
  )
    throw new BillingError("api_operation_invalid", 500)
  const now = new Date()
  const result = await transaction(pool, async (client) => {
    const account = await lockAccount(client, teamId)
    const existing = await client.query<{
      team_id: string
      state: AnalysisReservation["state"]
      credits: number
      period_start: Date
    }>(
      "select j.team_id,j.state,j.credits,j.period_start from api_analysis_jobs j where j.job_id=$1 for update",
      [jobId]
    )
    const job = existing.rows[0]
    if (job) {
      if (job.team_id !== teamId)
        throw new BillingError("api_job_conflict", 409)
      const period = await client.query<{ period_end: Date }>(
        "select period_end from api_periods where team_id=$1 and period_start=$2",
        [teamId, job.period_start]
      )

      return {
        jobId,
        state: job.state,
        credits: job.credits,
        resetsAt: period.rows[0]?.period_end.toISOString() ?? "",
      }
    }
    if (!account || account.closed_at)
      throw new BillingError("api_access_inactive", 403)
    const subscription = await apiSubscription(client, teamId)
    const membership = subscription?.membership ?? null
    if (!subscription || !apiAccessActive(membership, now))
      throw new BillingError("api_access_inactive", 403)
    const period = currentPeriod(membership, now)!
    const row = await lockPeriod(
      client,
      teamId,
      subscription.subscriptionId,
      period,
      membership
    )
    const admission = admit(
      ledgerState(row),
      { requests: 0, maxBytes: 0, credits },
      row.limits,
      row.rates,
      overagePolicy(account, membership, now)
    )
    if (!admission.ok) {
      await recordWarnings(client, teamId, period.start, [
        { dimension: QUOTA_DIMENSION[admission.code], threshold: 100 },
      ])

      return {
        refused: new ApiRefusal(
          admission.code,
          429,
          secondsUntil(period.end, now),
          period.end
        ),
      }
    }
    await client.query(
      "update api_periods set reserved_credits=reserved_credits+$3 where team_id=$1 and period_start=$2",
      [teamId, period.start, credits]
    )
    await client.query(
      "insert into api_analysis_jobs(job_id,team_id,period_start,credits) values($1,$2,$3,$4)",
      [jobId, teamId, period.start, credits]
    )

    return {
      jobId,
      state: "reserved" as const,
      credits,
      resetsAt: new Date(period.end).toISOString(),
    }
  })
  if ("refused" in result) throw result.refused

  return result
}

async function finishAnalysis(
  pool: Pool,
  jobId: string,
  outcome: "settled" | "refunded",
  credits?: number
): Promise<AnalysisReservation["state"] | null> {
  if (!JOB_ID.test(jobId)) throw new BillingError("api_operation_invalid", 500)
  const owner = await pool.query<{ team_id: string }>(
    "select team_id from api_analysis_jobs where job_id=$1",
    [jobId]
  )
  const teamId = owner.rows[0]?.team_id
  if (!teamId) return null

  return transaction(pool, async (client) => {
    const account = await lockAccount(client, teamId)
    const query = await client.query<{
      state: AnalysisReservation["state"]
      credits: number
      period_start: Date
    }>(
      "select state,credits,period_start from api_analysis_jobs where job_id=$1 for update",
      [jobId]
    )
    const job = query.rows[0]
    if (!job || !account) return null
    if (job.state !== "reserved") return job.state
    const spent = outcome === "settled" ? (credits ?? job.credits) : 0
    if (!Number.isSafeInteger(spent) || spent < 0 || spent > job.credits)
      throw new BillingError("api_operation_invalid", 500)
    const period = await lockExistingPeriod(client, teamId, job.period_start)
    await settleUsage(client, account, period, {
      eventId: `job:${jobId}`,
      kind: "analysis",
      endpoint: null,
      reserved: { requests: 0, bytes: 0, credits: job.credits },
      actual: { requests: 0, bytes: 0, credits: spent },
    })
    await client.query(
      "update api_analysis_jobs set state=$2,finished_at=now() where job_id=$1",
      [jobId, outcome]
    )

    return outcome
  })
}

/** Settle a completed job's credits once. Returns the job's final state. */
export const settleAnalysisCredits = (
  pool: Pool,
  jobId: string,
  credits?: number
) => finishAnalysis(pool, jobId, "settled", credits)

/** Refund a failed, cancelled or expired job's credits once. */
export const refundAnalysisCredits = (pool: Pool, jobId: string) =>
  finishAnalysis(pool, jobId, "refunded")

export async function apiUsage(
  pool: Pool,
  teamId: string,
  periodStart: string | null,
  keyOffset = 0
) {
  const today = Date.parse(new Date().toISOString().slice(0, 10))
  const windowStart = new Date(today - 29 * 86_400_000)
  const [period, keys, days, endpoints, activation, activeKeys] =
    await Promise.all([
      periodStart
        ? pool.query<PeriodRow>(
            "select * from api_periods where team_id=$1 and period_start=$2",
            [teamId, periodStart]
          )
        : null,
      pool.query<KeyRow & { requests: string; bytes: string }>(
        "select k.*,count(r.id) filter(where r.status between 200 and 299) as requests,coalesce(sum(r.response_bytes),0) as bytes from api_keys k left join api_requests r on r.key_id=k.id and r.period_start=$2 where k.team_id=$1 group by k.id order by (k.revoked_at is null and (k.expires_at is null or k.expires_at>now())) desc,k.created_at desc,k.id desc limit 51 offset $3",
        [teamId, periodStart, keyOffset]
      ),
      pool.query<{
        day: string
        requests: string
        bytes: string
        errors: string
      }>(
        "select to_char(started_at at time zone 'UTC','YYYY-MM-DD') as day,count(*) filter(where status between 200 and 299) as requests,coalesce(sum(response_bytes),0) as bytes,count(*) filter(where status>=400) as errors from api_requests where team_id=$1 and started_at>=$2 and state='complete' group by day order by day",
        [teamId, windowStart]
      ),
      pool.query<{
        endpoint: string
        requests: string
        bytes: string
        errors: string
      }>(
        "select endpoint,count(*) filter(where status between 200 and 299) as requests,coalesce(sum(response_bytes),0) as bytes,count(*) filter(where status>=400) as errors from api_requests where team_id=$1 and period_start=$2 and state='complete' group by endpoint order by endpoint",
        [teamId, periodStart]
      ),
      // A checkout alone must not generate usage history.
      pool.query<{ started_at: Date | null }>(
        "select min((snapshot->>'startedAt')::timestamptz) as started_at from api_subscriptions where team_id=$1 and snapshot->>'paidThrough' is not null",
        [teamId]
      ),
      pool.query<{ count: string }>(
        "select count(*) from api_keys where team_id=$1 and revoked_at is null and (expires_at is null or expires_at>now())",
        [teamId]
      ),
    ])
  const keyViews: ApiKeyView[] = keys.rows.slice(0, 50).map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    createdAt: key.created_at.toISOString(),
    expiresAt: key.expires_at?.toISOString() ?? null,
    lastUsedAt: key.last_used_at?.toISOString() ?? null,
    revokedAt: key.revoked_at?.toISOString() ?? null,
    requests: Number(key.requests),
    bytes: Number(key.bytes),
  }))
  const byDay = new Map(days.rows.map((day) => [day.day, day]))
  const startedAt = activation.rows[0]?.started_at
  const start = startedAt
    ? Math.max(
        windowStart.getTime(),
        Date.parse(startedAt.toISOString().slice(0, 10))
      )
    : today + 86_400_000
  const length = Math.max(0, Math.floor((today - start) / 86_400_000) + 1)
  const calendar = Array.from({ length }, (_, index) => {
    const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10)
    const row = byDay.get(day)

    return {
      day,
      requests: Number(row?.requests ?? 0),
      bytes: Number(row?.bytes ?? 0),
      errors: Number(row?.errors ?? 0),
    }
  })
  const row = period?.rows[0]

  return {
    totals: row
      ? totalsOf(ledgerState(row))
      : { requests: 0, bytes: 0, credits: 0 },
    settled: row
      ? ledgerState(row).settled
      : { requests: 0, bytes: 0, credits: 0 },
    keys: keyViews,
    keyPage: {
      offset: keyOffset,
      hasMore: keys.rows.length > 50,
      activeCount: Number(activeKeys.rows[0]?.count ?? 0),
    },
    days: calendar,
    endpoints: endpoints.rows.map((r) => ({
      ...r,
      requests: Number(r.requests),
      bytes: Number(r.bytes),
      errors: Number(r.errors),
    })),
  }
}

/** Deduplicated warnings recorded for a period, for the dashboard flags. */
export async function apiWarnings(
  db: Queryable,
  teamId: string,
  periodStart: string
) {
  const result = await db.query<{ dimension: string; threshold: number }>(
    "select dimension,threshold from api_warnings where team_id=$1 and period_start=$2 order by dimension,threshold",
    [teamId, periodStart]
  )

  return result.rows
}

/**
 * Billing maintenance: refund abandoned request and analysis reservations and
 * trim detailed request history. Runs even while checkout is disabled.
 */
export async function maintainApiUsage(pool: Pool) {
  const expired = await pool.query<{ id: string; team_id: string }>(
    `select id,team_id from api_requests where state='reserved' and started_at<now()-interval '${REQUEST_RESERVATION_TTL_SECONDS} seconds' order by started_at limit 100`
  )
  for (const row of expired.rows)
    await finishApiRequest(
      pool,
      { id: row.id, teamId: row.team_id },
      {
        status: 503,
        bytes: 0,
        duration: REQUEST_RESERVATION_TTL_SECONDS * 1000,
      }
    )
  const jobs = await pool.query<{ job_id: string }>(
    `select job_id from api_analysis_jobs where state='reserved' and created_at<now()-interval '${ANALYSIS_RESERVATION_TTL_SECONDS} seconds' order by created_at limit 100`
  )
  for (const job of jobs.rows) await refundAnalysisCredits(pool, job.job_id)
  // Keep chart detail for 90 days. Period totals, usage events and audit stay.
  await pool.query(
    "delete from api_requests where id in (select id from api_requests where state='complete' and finished_at<now()-interval '90 days' order by finished_at limit 10000)"
  )

  return (expired.rowCount ?? 0) + (jobs.rowCount ?? 0)
}

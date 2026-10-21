import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"

import type { Pool, PoolClient } from "pg"

import { BillingError } from "@/lib/billing/config"

import { apiAccessActive, apiMonth } from "./config"
import type { ApiMembership, ApiScope, ApiKeyView } from "./types"

// API credentials are generated below from 32 CSPRNG bytes; callers cannot
// choose their value. SHA-256 gives indexed lookup of these high-entropy tokens.
// User passwords use Better Auth's password-hashing scheme instead.
export const keyDigest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex")
const token = () => `lg_api_${randomBytes(32).toString("base64url")}`
type Queryable = Pick<Pool, "query">
type KeyRow = {
  id: string
  team_id: string
  name: string
  prefix: string
  scopes: ApiScope[]
  created_at: Date
  expires_at: Date | null
  last_used_at: Date | null
  revoked_at: Date | null
}

export async function apiMembership(db: Queryable, teamId: string) {
  const result = await db.query<{ snapshot: ApiMembership }>(
    "select snapshot from team_api_memberships where team_id=$1 order by reconciled_at desc",
    [teamId]
  )

  return (
    result.rows.find((row) => apiAccessActive(row.snapshot))?.snapshot ??
    result.rows[0]?.snapshot ??
    null
  )
}

async function transaction<T>(
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

async function lockTeam(client: PoolClient, teamId: string) {
  await client.query(
    "select team_id from team_api_accounts where team_id=$1 for update",
    [teamId]
  )
}

export async function createApiKey(
  pool: Pool,
  teamId: string,
  actorId: string,
  input: { name: string; scopes: ApiScope[]; expiresAt: string | null }
) {
  return transaction(pool, async (client) => {
    await lockTeam(client, teamId)
    const membership = await apiMembership(client, teamId)
    if (!apiAccessActive(membership))
      throw new BillingError("api_addon_required", 403)
    const count = await client.query<{ count: string }>(
      "select count(*) from team_api_keys where team_id=$1 and revoked_at is null and (expires_at is null or expires_at>now())",
      [teamId]
    )
    if (Number(count.rows[0]?.count) >= membership!.limits.keys)
      throw new BillingError("api_key_limit_reached", 409)
    const secret = token(),
      id = randomUUID()
    await client.query(
      "insert into team_api_keys(id,team_id,name,prefix,digest,scopes,created_by,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)",
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
      "insert into team_api_audit(team_id,actor_id,key_id,action) values($1,$2,$3,'created')",
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
    await lockTeam(client, teamId)
    const row = await client.query<KeyRow>(
      "select * from team_api_keys where id=$1 and team_id=$2 for update",
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
      throw new BillingError("api_addon_required", 403)
    const secret = rotate ? token() : null
    await (secret
      ? client.query(
          "update team_api_keys set digest=$2,prefix=$3 where id=$1",
          [id, keyDigest(secret), secret.slice(0, 17)]
        )
      : client.query(
          "update team_api_keys set revoked_at=coalesce(revoked_at,now()) where id=$1",
          [id]
        ))
    await client.query(
      "insert into team_api_audit(team_id,actor_id,key_id,action) values($1,$2,$3,$4)",
      [teamId, actorId, id, rotate ? "regenerated" : "revoked"]
    )

    return { id, secret }
  })
}

export async function findApiKey(pool: Pool, secret: string): Promise<KeyRow> {
  if (!/^lg_api_[\w-]{43}$/.test(secret))
    throw new BillingError("invalid_api_key", 401)
  const result = await pool.query<KeyRow>(
    "select * from team_api_keys where digest=$1 and revoked_at is null and (expires_at is null or expires_at>now())",
    [keyDigest(secret)]
  )
  if (!result.rows[0]) throw new BillingError("invalid_api_key", 401)

  return result.rows[0]
}

export type ApiReservation = {
  id: string
  teamId: string
  budget: number
  resetsAt: string
  remaining: number
}

export async function reserveApiRequest(
  pool: Pool,
  key: KeyRow,
  secret: string,
  scope: ApiScope,
  endpoint: string
): Promise<ApiReservation> {
  const month = apiMonth()
  const result = await transaction(pool, async (client) => {
    await lockTeam(client, key.team_id)
    const current = await client.query<KeyRow>(
      "select * from team_api_keys where id=$1 and digest=$2 and revoked_at is null and (expires_at is null or expires_at>now()) for update",
      [key.id, keyDigest(secret)]
    )
    if (!current.rows[0]) throw new BillingError("invalid_api_key", 401)
    const membership = await apiMembership(client, key.team_id)
    if (!apiAccessActive(membership))
      throw new BillingError("api_addon_inactive", 403)
    const limits = membership!.limits
    const refuse = async (code: string, status = 429) => {
      await client.query(
        "insert into team_api_requests(id,team_id,key_id,month,endpoint,state,reserved_bytes,status,finished_at) values($1,$2,$3,$4,$5,'complete',0,$6,now())",
        [randomUUID(), key.team_id, key.id, month.start, endpoint, status]
      )

      return { refused: code, status }
    }
    // Rate counters are committed even on refusal. Regenerating a key keeps its
    // id; multiple keys still share the Team counter.
    const rates = await client.query<{ hits: number }>(
      "insert into billing_rate_limits(key,hits,resets_at) select unnest($1::text[]),1,now()+interval '1 minute' on conflict(key) do update set hits=case when billing_rate_limits.resets_at<=now() then 1 else billing_rate_limits.hits+1 end,resets_at=case when billing_rate_limits.resets_at<=now() then now()+interval '1 minute' else billing_rate_limits.resets_at end returning hits",
      [[`team-api:team:${key.team_id}`, `team-api:key:${key.id}`]]
    )
    if (rates.rows.some((rate) => rate.hits > limits.perMinute))
      return refuse("api_rate_limit")
    if (!current.rows[0].scopes.includes(scope))
      return refuse("api_scope_refused", 403)
    const concurrent = await client.query<{ count: string }>(
      "select count(*) from team_api_requests where team_id=$1 and state='reserved'",
      [key.team_id]
    )
    if (Number(concurrent.rows[0]?.count) >= limits.concurrency)
      return refuse("api_concurrency_limit")
    await client.query(
      "insert into team_api_usage(team_id,month) values($1,$2) on conflict do nothing",
      [key.team_id, month.start]
    )
    const usage = await client.query<{ requests: string; bytes: string }>(
      "select requests,bytes from team_api_usage where team_id=$1 and month=$2 for update",
      [key.team_id, month.start]
    )
    const used = usage.rows[0]!
    if (Number(used.requests) >= limits.requests)
      return refuse("api_request_allowance_exhausted")
    const budget = Math.min(
      limits.responseBytes,
      limits.bytes - Number(used.bytes)
    )
    if (budget < 128) return refuse("api_byte_allowance_exhausted")
    const id = randomUUID()
    await client.query(
      "update team_api_usage set requests=requests+1,bytes=bytes+$3 where team_id=$1 and month=$2",
      [key.team_id, month.start, budget]
    )
    await client.query(
      "insert into team_api_requests(id,team_id,key_id,month,endpoint,reserved_bytes) values($1,$2,$3,$4,$5,$6)",
      [id, key.team_id, key.id, month.start, endpoint, budget]
    )

    return {
      id,
      teamId: key.team_id,
      budget,
      resetsAt: month.end.toISOString(),
      remaining: limits.requests - Number(used.requests) - 1,
    }
  })
  if ("refused" in result)
    throw new BillingError(result.refused!, result.status)

  return result
}

export async function finishApiRequest(
  pool: Pool,
  reservation: ApiReservation,
  status: number,
  bytes: number,
  duration: number
) {
  return transaction(pool, async (client) => {
    await lockTeam(client, reservation.teamId)
    const query = await client.query<{
      month: Date
      reserved_bytes: string
      key_id: string
    }>(
      "select month,reserved_bytes,key_id from team_api_requests where id=$1 and team_id=$2 and state='reserved' for update",
      [reservation.id, reservation.teamId]
    )
    const row = query.rows[0]
    if (!row) return // Accounting retries never charge twice.
    const successful = status >= 200 && status < 300
    const actual = successful ? bytes : 0
    if (
      !Number.isSafeInteger(actual) ||
      actual < 0 ||
      actual > Number(row.reserved_bytes)
    )
      throw new BillingError("api_response_too_large", 502)
    await client.query(
      "update team_api_usage set requests=requests-$3,bytes=bytes-$4 where team_id=$1 and month=$2",
      [
        reservation.teamId,
        row.month,
        successful ? 0 : 1,
        Number(row.reserved_bytes) - actual,
      ]
    )
    await client.query(
      "update team_api_requests set state='complete',status=$2,response_bytes=$3,duration_ms=$4,finished_at=now() where id=$1",
      [
        reservation.id,
        status,
        actual,
        Math.max(0, Math.min(120_000, Math.round(duration))),
      ]
    )
    if (successful)
      await client.query(
        "update team_api_keys set last_used_at=now() where id=$1",
        [row.key_id]
      )
  })
}

export async function apiUsage(pool: Pool, teamId: string) {
  const month = apiMonth()
  const today = Date.parse(new Date().toISOString().slice(0, 10))
  const windowStart = new Date(today - 29 * 86_400_000)
  const [usage, keys, days, endpoints, activation] = await Promise.all([
    pool.query<{ requests: string; bytes: string }>(
      "select requests,bytes from team_api_usage where team_id=$1 and month=$2",
      [teamId, month.start]
    ),
    pool.query<KeyRow & { requests: string; bytes: string }>(
      "select k.*,count(r.id) filter(where r.status between 200 and 299) as requests,coalesce(sum(r.response_bytes),0) as bytes from team_api_keys k left join team_api_requests r on r.key_id=k.id and r.month=$2 where k.team_id=$1 group by k.id order by (k.revoked_at is null and (k.expires_at is null or k.expires_at>now())) desc,k.created_at desc limit 100",
      [teamId, month.start]
    ),
    pool.query<{
      day: string
      requests: string
      bytes: string
      errors: string
    }>(
      "select to_char(started_at at time zone 'UTC','YYYY-MM-DD') as day,count(*) filter(where status between 200 and 299) as requests,coalesce(sum(response_bytes),0) as bytes,count(*) filter(where status>=400) as errors from team_api_requests where team_id=$1 and started_at>=$2 and state='complete' group by day order by day",
      [teamId, windowStart]
    ),
    pool.query<{
      endpoint: string
      requests: string
      bytes: string
      errors: string
    }>(
      "select endpoint,count(*) filter(where status between 200 and 299) as requests,coalesce(sum(response_bytes),0) as bytes,count(*) filter(where status>=400) as errors from team_api_requests where team_id=$1 and month=$2 and state='complete' group by endpoint order by endpoint",
      [teamId, month.start]
    ),
    // Legacy paid snapshots predate startedAt; the API account is their earliest
    // known start. A checkout alone must not generate usage history.
    pool.query<{ started_at: Date | null }>(
      "select min(coalesce((m.snapshot->>'startedAt')::timestamptz,a.created_at)) as started_at from team_api_memberships m join team_api_accounts a on a.team_id=m.team_id where m.team_id=$1 and m.snapshot->>'paidThrough' is not null",
      [teamId]
    ),
  ])
  const keyViews: ApiKeyView[] = keys.rows.map((key) => ({
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

  return {
    usage: {
      requests: Number(usage.rows[0]?.requests ?? 0),
      bytes: Number(usage.rows[0]?.bytes ?? 0),
      resetsAt: month.end.toISOString(),
    },
    keys: keyViews,
    days: calendar,
    endpoints: endpoints.rows.map((row) => ({
      ...row,
      requests: Number(row.requests),
      bytes: Number(row.bytes),
      errors: Number(row.errors),
    })),
  }
}

export async function maintainApiUsage(pool: Pool) {
  const expired = await pool.query<{
    id: string
    team_id: string
    reserved_bytes: string
  }>(
    "select id,team_id,reserved_bytes from team_api_requests where state='reserved' and started_at<now()-interval '2 minutes' order by started_at limit 100"
  )
  for (const row of expired.rows)
    await finishApiRequest(
      pool,
      {
        id: row.id,
        teamId: row.team_id,
        budget: Number(row.reserved_bytes),
        remaining: 0,
        resetsAt: "",
      },
      503,
      0,
      120_000
    )
  // Keep chart detail for 90 days. The monthly totals and audit survive cleanup.
  await pool.query(
    "delete from team_api_requests where id in (select id from team_api_requests where state='complete' and finished_at<now()-interval '90 days' order by finished_at limit 10000)"
  )

  return expired.rowCount ?? 0
}

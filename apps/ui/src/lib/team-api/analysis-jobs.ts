import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { isLibraryEntityRef } from "@repo/shared-data"
import type { Pool, PoolClient } from "pg"
import { z } from "zod"

import { BillingError } from "@/lib/billing/config"
import { readJsonCapped } from "@/lib/bridge-params"
import { LIVE_LOCALES } from "@/lib/live-locales"

import { refundAnalysis, reserveAnalysis, settleAnalysis } from "./analysis"
import {
  ApiDetailError,
  apiResourceEnabled,
  bridgeErrorCode,
  resourceBridge,
  strictQuery,
} from "./resources"
import { isServiceRef } from "./services"

/** Credits per Reach mode. Network mode needs `API_NETWORK_REACH_ENABLED`. */
export const REACH_CREDITS = { library: 5, service: 20, network: 40 } as const
/** Credits per summary operation: 1 for a profile, 5 for richer joins. */
export const SUMMARY_CREDITS = {
  "service.profile": 1,
  "place.profile": 1,
  "service.coverage": 5,
  "place.coverage": 5,
} as const
export const REACH_MINUTES = [5, 10, 15, 30] as const

export const JOB_LIMITS = {
  /** Open (pending) jobs per API account and across all accounts. */
  perAccountOpen: 5,
  globalOpen: 100,
  /** Pending jobs expire and refund before the ledger's one-hour sweep. */
  pendingMinutes: 30,
  reachResultHours: 24,
  summaryResultMinutes: 15,
  /** Polls re-check the CMS at most this often per job. */
  recheckSeconds: 3,
  /** Job rows (without results) are kept this long, then deleted. */
  retentionDays: 30,
  /** Stored result ceiling: below the 128 KiB response limit with metadata. */
  resultBytes: 120_000,
} as const

const BODY_LIMIT = 2048
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/)

export const ReachInput = z
  .object({
    mode: z.enum(["library", "service", "network"]),
    ref: z.string().max(255),
    travelMode: z.enum(["walking", "cycling"]),
    minutes: z
      .number()
      .int()
      .refine((m) => (REACH_MINUTES as readonly number[]).includes(m))
      .optional(),
    areaCode: z
      .string()
      .regex(/^[EWSN]\d{8}$/)
      .optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    if (input.mode === "library" && !isLibraryEntityRef(input.ref))
      fail("library mode takes a Library entityRef")
    if (input.mode !== "library" && !isServiceRef(input.ref))
      fail("service and network modes take a service ref")
    if (input.mode === "service" && !input.areaCode)
      fail("service mode takes one areaCode")
    if (input.mode !== "service" && input.areaCode)
      fail("areaCode is for service mode")
  })
export type ReachInput = z.infer<typeof ReachInput>

export const SummaryInput = z
  .object({
    operation: z.enum([
      "service.profile",
      "service.coverage",
      "place.profile",
      "place.coverage",
    ]),
    ref: z.string().max(64).optional(),
    place: z
      .object({
        country: slug,
        region: slug.optional(),
        area: slug.optional(),
      })
      .strict()
      .refine((p) => !p.area || p.region)
      .optional(),
    locale: z.string().max(8).default("en"),
  })
  .strict()
  .superRefine((input, ctx) => {
    const service = input.operation.startsWith("service.")
    if (
      service
        ? !isServiceRef(input.ref) || input.place
        : !input.place || input.ref !== undefined
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "service operations take ref; place operations take place",
      })
  })
export type SummaryInput = z.infer<typeof SummaryInput>

export type JobRow = {
  id: string
  team_id: string
  key_id: string
  kind: "summary" | "reach"
  operation: string
  input_hash: string
  input: Record<string, unknown>
  credits: number
  spent: number | null
  state: "pending" | "complete" | "failed" | "expired"
  charge: "reserved" | "settled" | "refunded"
  cached: boolean
  error: string | null
  result: unknown
  result_bytes: number | null
  created_at: Date
  checked_at: Date
  completed_at: Date | null
  expires_at: Date
  result_expires_at: Date | null
}
type Account = { teamId: string; keyId: string }

const newJobId = (kind: "reach" | "summary") =>
  `${kind}:${randomBytes(16).toString("base64url")}`

export const isJobId = (value: string) =>
  /^(reach|summary):[A-Za-z0-9_-]{22}$/.test(value)
const inputHash = (teamId: string, kind: string, input: unknown) =>
  createHash("sha256")
    .update(JSON.stringify([teamId, kind, input]))
    .digest("hex")

/** Canonical input: fixed key order, published refs and enums only. */
function canonicalReach(input: ReachInput) {
  return {
    mode: input.mode,
    ref: input.ref,
    travelMode: input.travelMode,
    ...(input.minutes !== undefined ? { minutes: input.minutes } : {}),
    ...(input.areaCode ? { areaCode: input.areaCode } : {}),
  }
}

async function body<T>(request: Request, schema: z.ZodType<T>) {
  strictQuery(request, [])
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? ""))
    throw new BillingError("invalid_analysis", 415)
  const parsed = await readJsonCapped(request, BODY_LIMIT)
  if (!parsed.ok)
    throw new BillingError(
      parsed.status === 413 ? "request_too_large" : "invalid_analysis",
      parsed.status
    )
  const choice = schema.safeParse(parsed.body)
  if (!choice.success) throw new BillingError("invalid_analysis", 400)

  return choice.data
}

/** The job as its owner sees it: no input text, key, account or upstream detail. */
export function jobView(job: JobRow) {
  const pending = job.state === "pending"

  return {
    id: job.id,
    kind: job.kind,
    operation: job.operation,
    state: job.state,
    cached: job.cached,
    credits: {
      reserved: job.credits,
      spent: job.charge === "settled" ? (job.spent ?? job.credits) : 0,
      charge: job.charge,
    },
    error: job.error,
    createdAt: job.created_at.toISOString(),
    completedAt: job.completed_at?.toISOString() ?? null,
    expiresAt: job.expires_at.toISOString(),
    resultExpiresAt: job.result_expires_at?.toISOString() ?? null,
    resultAvailable:
      job.state === "complete" &&
      job.result !== null &&
      !!job.result_expires_at &&
      job.result_expires_at > new Date(),
    ...(pending ? { retryAfter: JOB_LIMITS.recheckSeconds } : {}),
    links: {
      self: `/api/v1/analysis/jobs/${encodeURIComponent(job.id)}`,
      result: `/api/v1/analysis/jobs/${encodeURIComponent(job.id)}/result`,
    },
  }
}

async function inTransaction<T>(
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
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** A reusable job for identical input: open, or complete with a live result. */
async function reusable(pool: Pool, teamId: string, hash: string) {
  const found = await pool.query<JobRow>(
    "select * from api_jobs where team_id=$1 and input_hash=$2 and (state='pending' or (state='complete' and result is not null and result_expires_at>now())) order by (state='pending') desc, created_at desc limit 1",
    [teamId, hash]
  )
  const job = found.rows[0]
  if (job?.state === "pending" && job.expires_at <= new Date()) {
    await expireJob(pool, job)

    return null
  }

  return job ?? null
}

/**
 * Admit one new job row under the per-account and global queue ceilings.
 * The partial unique index makes a concurrent identical request reuse the
 * open job instead of starting a second charged one.
 */
async function insertJob(
  pool: Pool,
  account: Account,
  values: {
    kind: "reach" | "summary"
    operation: string
    hash: string
    input: unknown
    credits: number
    ceilings: boolean
  }
) {
  return inTransaction(pool, async (client) => {
    if (values.ceilings) {
      await client.query("select pg_advisory_xact_lock(76422031)")
      const open = await client.query<{ team: string; total: string }>(
        "select count(*) filter (where team_id=$1) as team,count(*) as total from api_jobs where state='pending' and expires_at>now()",
        [account.teamId]
      )
      if (Number(open.rows[0]?.team) >= JOB_LIMITS.perAccountOpen)
        throw new BillingError("analysis_queue_full", 429)
      if (Number(open.rows[0]?.total) >= JOB_LIMITS.globalOpen)
        throw new BillingError("analysis_capacity", 503)
    }
    const inserted = await client.query<JobRow>(
      `insert into api_jobs(id,team_id,key_id,kind,operation,input_hash,input,credits,expires_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '${JOB_LIMITS.pendingMinutes} minutes')
       on conflict (team_id,input_hash) where state='pending' do nothing returning *`,
      [
        newJobId(values.kind),
        account.teamId,
        account.keyId,
        values.kind,
        values.operation,
        values.hash,
        JSON.stringify(values.input),
        values.credits,
      ]
    )
    if (inserted.rows[0]) return { job: inserted.rows[0], created: true }
    const open = await client.query<JobRow>(
      "select * from api_jobs where team_id=$1 and input_hash=$2 and state='pending'",
      [account.teamId, values.hash]
    )
    if (!open.rows[0]) throw new BillingError("analysis_conflict", 409)

    return { job: open.rows[0], created: false }
  })
}

/** Reserve credits for a fresh job; a refusal removes the uncharged row. */
async function reserveFor(pool: Pool, job: JobRow) {
  try {
    await reserveAnalysis(job.team_id, job.id, job.credits)
  } catch (error) {
    await pool.query("delete from api_jobs where id=$1 and state='pending'", [
      job.id,
    ])
    throw error
  }
}

async function update(pool: Pool, id: string, set: string, values: unknown[]) {
  const updated = await pool.query<JobRow>(
    `update api_jobs set ${set} where id=$1 and state='pending' returning *`,
    [id, ...values]
  )

  return updated.rows[0] ?? null
}
const reread = async (pool: Pool, id: string) =>
  (await pool.query<JobRow>("select * from api_jobs where id=$1", [id]))
    .rows[0]!

/** Refund and close a job exactly once (failure, refusal or expiry). */
async function failJob(
  pool: Pool,
  job: JobRow,
  state: "failed" | "expired",
  error: string
) {
  const charge = await refundAnalysis(job.id)
  if (charge === "settled" && job.result !== null && job.result !== undefined)
    // Settled before a crash: the result was stored first, so deliver it.
    return (
      (await update(
        pool,
        job.id,
        "state='complete',charge='settled',spent=coalesce(spent,credits),completed_at=coalesce(completed_at,now())",
        []
      )) ?? reread(pool, job.id)
    )

  return (
    (await update(
      pool,
      job.id,
      "state=$2,charge=$3,error=$4,result=null,completed_at=now()",
      [state, charge === "settled" ? "settled" : "refunded", error]
    )) ?? reread(pool, job.id)
  )
}

export const expireJob = (pool: Pool, job: JobRow) =>
  failJob(pool, job, "expired", "job_expired")

/** Store a completed result, then settle once; a late refund wins. */
async function completeJob(
  pool: Pool,
  job: JobRow,
  result: unknown,
  { cached, resultTtl }: { cached: boolean; resultTtl: string }
) {
  const text = JSON.stringify(result)
  const bytes = Buffer.byteLength(text)
  if (bytes > JOB_LIMITS.resultBytes)
    return failJob(pool, job, "failed", "result_too_large")
  // The result is stored before settlement so a crash between the two can
  // still deliver what was paid for (see failJob).
  await pool.query(
    "update api_jobs set result=$2,result_bytes=$3 where id=$1 and state='pending'",
    [job.id, text, bytes]
  )
  const spent = cached ? 0 : job.credits
  const charge = await settleAnalysis(job.id, { credits: spent })
  if (charge !== "settled")
    return failJob(pool, { ...job, result: null }, "expired", "job_expired")

  return (
    (await update(
      pool,
      job.id,
      `state='complete',charge='settled',spent=$2,cached=$3,completed_at=now(),result_expires_at=now()+interval '${resultTtl}'`,
      [spent, cached]
    )) ?? reread(pool, job.id)
  )
}

type Admission =
  | { state: "ready"; result: unknown }
  | { state: "pending" }
  | { state: "unavailable"; reason: string }
  | { state: "refused"; code: string }

/** The CMS/native admission behind the private bridge; never a browser route. */
async function admitReach(teamId: string, input: Record<string, unknown>) {
  const result = await resourceBridge<Admission>(
    "access",
    "api/analysis/reach",
    {
      method: "POST",
      body: { account: teamId, ...input },
      maximum: 262_144,
      failure: "analysis_unavailable",
    }
  )
  if (result.status === 200 && result.body?.state) return result.body
  if (result.status === 404) throw new BillingError("record_not_found", 404)
  if (result.status === 400)
    throw new BillingError(
      bridgeErrorCode(result.body) === "area_required"
        ? "area_required"
        : "invalid_analysis",
      400
    )
  throw new BillingError("analysis_unavailable", 503)
}

/** Apply one admission outcome to an open job. */
async function applyAdmission(
  pool: Pool,
  job: JobRow,
  outcome: Admission,
  firstAdmission: boolean
) {
  if (outcome.state === "ready")
    return completeJob(pool, job, outcome.result, {
      // Ready at acceptance: identical work already existed; no credit.
      cached: firstAdmission,
      resultTtl: `${JOB_LIMITS.reachResultHours} hours`,
    })
  if (outcome.state === "unavailable")
    return failJob(pool, job, "failed", `analysis_${outcome.reason}`)
  if (outcome.state === "refused") {
    await failJob(pool, job, "failed", "analysis_capacity")
    throw new BillingError("analysis_capacity", 429)
  }

  return (await update(pool, job.id, "checked_at=now()", [])) ?? job
}

/**
 * POST /api/v1/analysis/reach. A cached or identical open job is returned
 * without a new charge; otherwise credits are reserved at acceptance and
 * the CMS admits the job. Returns `{ status, job }` with 200 or 202.
 */
export async function acceptReach(
  pool: Pool,
  request: Request,
  account: Account
) {
  const input = canonicalReach(await body(request, ReachInput))
  if (input.mode === "network" && !apiResourceEnabled("networkReach"))
    throw new BillingError("analysis_mode_unavailable", 404)
  const hash = inputHash(account.teamId, "reach", input)
  const existing = await reusable(pool, account.teamId, hash)
  if (existing) return existing
  const { job, created } = await insertJob(pool, account, {
    kind: "reach",
    operation: `reach.${input.mode}`,
    hash,
    input,
    credits: REACH_CREDITS[input.mode],
    ceilings: true,
  })
  if (!created) return job
  await reserveFor(pool, job)
  let outcome: Admission
  try {
    outcome = await admitReach(account.teamId, input)
  } catch (error) {
    await failJob(pool, job, "failed", "analysis_unavailable")
    throw error
  }
  const resolved = await applyAdmission(pool, job, outcome, true)
  if (resolved.state === "failed")
    throw new ApiDetailError(resolved.error ?? "analysis_failed", 422, {
      job: jobView(resolved),
    })

  return resolved
}

/** Re-check an open job (bounded per job) and resolve expiry. */
export async function refreshJob(pool: Pool, job: JobRow) {
  if (job.state !== "pending") return job
  if (job.expires_at <= new Date()) return expireJob(pool, job)
  if (
    job.kind !== "reach" ||
    Date.now() - job.checked_at.getTime() < JOB_LIMITS.recheckSeconds * 1000
  )
    return job
  // Claim the check so concurrent polls do not all call the CMS.
  const claimed = await pool.query<JobRow>(
    "update api_jobs set checked_at=now() where id=$1 and state='pending' and checked_at<now()-interval '1 second' returning *",
    [job.id]
  )
  if (!claimed.rows[0]) return reread(pool, job.id)
  try {
    const outcome = await admitReach(job.team_id, job.input)

    return await applyAdmission(pool, claimed.rows[0], outcome, false)
  } catch (error) {
    if (error instanceof BillingError && error.code === "record_not_found")
      return failJob(pool, job, "failed", "record_not_found")

    // A transient outage leaves the job open until it expires and refunds.
    return claimed.rows[0]
  }
}

/** One job of this account, or null (foreign and unknown ids look the same). */
export async function ownedJob(pool: Pool, teamId: string, id: string) {
  if (!isJobId(id)) return null
  const found = await pool.query<JobRow>(
    "select * from api_jobs where id=$1 and team_id=$2",
    [id, teamId]
  )

  return found.rows[0] ?? null
}

/** GET /api/v1/analysis/jobs/{id}/result: never charges a second credit. */
export function jobResult(job: JobRow) {
  if (job.state === "pending")
    throw new ApiDetailError("job_not_complete", 409, {
      retryAfter: JOB_LIMITS.recheckSeconds,
    })
  if (job.state === "failed")
    throw new ApiDetailError("job_failed", 409, { reason: job.error })
  if (
    job.state === "expired" ||
    job.result === null ||
    !job.result_expires_at ||
    job.result_expires_at <= new Date()
  )
    throw new BillingError("job_result_expired", 410)

  return {
    data: job.result,
    meta: {
      jobId: job.id,
      operation: job.operation,
      cached: job.cached,
      resultExpiresAt: job.result_expires_at.toISOString(),
      attribution:
        "Libraries Global contributors. Routing, population and boundary sources are credited in data.sources or data.reportingArea under their own licences.",
    },
  }
}

/**
 * POST /api/v1/analysis/summary: a bounded, synchronous summary of a
 * published service or place. Identical input within 15 minutes reuses the
 * result for no credit; otherwise the variant's credits are reserved,
 * settled on success and refunded on failure.
 */
export async function runSummary(
  pool: Pool,
  request: Request,
  account: Account
) {
  const parsed = await body(request, SummaryInput)
  if (!LIVE_LOCALES.includes(parsed.locale))
    throw new BillingError("locale_unavailable", 400)
  const input = {
    operation: parsed.operation,
    ...(parsed.ref !== undefined ? { ref: parsed.ref } : {}),
    ...(parsed.place
      ? {
          place: {
            country: parsed.place.country,
            ...(parsed.place.region ? { region: parsed.place.region } : {}),
            ...(parsed.place.area ? { area: parsed.place.area } : {}),
          },
        }
      : {}),
    locale: parsed.locale,
  }
  const hash = inputHash(account.teamId, "summary", input)
  const existing = await reusable(pool, account.teamId, hash)
  if (existing?.state === "complete") return existing
  if (existing) throw new BillingError("analysis_in_progress", 409)
  const { job, created } = await insertJob(pool, account, {
    kind: "summary",
    operation: `summary.${input.operation}`,
    hash,
    input,
    credits: SUMMARY_CREDITS[input.operation],
    ceilings: false,
  })
  if (!created) throw new BillingError("analysis_in_progress", 409)
  await reserveFor(pool, job)
  let result: Awaited<ReturnType<typeof resourceBridge<{ data?: unknown }>>>
  try {
    result = await resourceBridge<{ data?: unknown; meta?: unknown }>(
      "access",
      "api/analysis/summary",
      {
        method: "POST",
        body: input,
        maximum: JOB_LIMITS.resultBytes,
        timeoutMs: 15_000,
        failure: "analysis_unavailable",
      }
    )
  } catch (error) {
    await failJob(pool, job, "failed", "analysis_unavailable")
    throw error
  }
  if (result.status !== 200 || !result.body?.data) {
    await failJob(
      pool,
      job,
      "failed",
      result.status === 404 ? "record_not_found" : "analysis_unavailable"
    )
    if (result.status === 404) throw new BillingError("record_not_found", 404)
    if (result.status === 400) throw new BillingError("invalid_analysis", 400)
    throw new BillingError("analysis_unavailable", 503)
  }
  const done = await completeJob(pool, job, result.body, {
    cached: false,
    resultTtl: `${JOB_LIMITS.summaryResultMinutes} minutes`,
  })
  if (done.state !== "complete")
    throw new BillingError("analysis_unavailable", 503)

  return done
}

/**
 * Billing maintenance for jobs: expire and refund open jobs past their
 * deadline exactly once (the state guard and the ledger's idempotent refund
 * make a repeated run a no-op), drop expired results and old rows.
 */
export async function maintainApiJobs(pool: Pool) {
  const stale = await pool.query<JobRow>(
    "select * from api_jobs where state='pending' and expires_at<=now() order by expires_at limit 100"
  )
  for (const job of stale.rows) await expireJob(pool, job)
  await pool.query(
    "update api_jobs set result=null where id in (select id from api_jobs where result is not null and result_expires_at<=now() limit 1000)"
  )
  await pool.query(
    `delete from api_jobs where id in (select id from api_jobs where state<>'pending' and created_at<now()-interval '${JOB_LIMITS.retentionDays} days' limit 1000)`
  )

  return stale.rows.length
}

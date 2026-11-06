/**
 * PostgreSQL ledger races and exactly-once settlement. Runs only through
 * `pnpm --filter @repo/ui billing:db:test` in a generated local schema; never
 * against a shared development database.
 */
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { API_OFFER_LIMITS, API_OFFER_RATES } from "../config"
import {
  createApiKey,
  findApiKey,
  finishApiRequest,
  maintainApiUsage,
  refundAnalysisCredits,
  reserveAnalysisCredits,
  reserveApiRequest,
  settleAnalysisCredits,
} from "../store"
import type { ApiLimits, ApiMembership } from "../types"

const enabled = process.env.BILLING_DB_TEST === "true"
const schema = `api_ledger_test_${randomUUID().replaceAll("-", "")}`
let admin: Pool, pool: Pool
let sequence = 0

async function paidAccount(
  limits: Partial<ApiLimits> = {},
  overage?: { capPence: number }
) {
  const team = `team${String(++sequence).padStart(20, "0")}`
  const now = Date.now()
  const offer = {
    offerVersion: "test",
    priceId: "price_api",
    taxBehavior: "inclusive" as const,
    limits: { ...API_OFFER_LIMITS, ...limits },
    overageRates: API_OFFER_RATES,
    overagePrices: {
      requests: "price_r",
      bytes: "price_b",
      credits: "price_c",
    },
    consentVersion: "2.0",
  }
  const snapshot: ApiMembership = {
    mode: "sandbox",
    status: "active",
    priceId: "price_api",
    currency: "gbp",
    unitAmount: 10000,
    period: {
      start: new Date(now - 86_400_000).toISOString(),
      end: new Date(now + 86_400_000).toISOString(),
    },
    paidThrough: new Date(now + 86_400_000).toISOString(),
    startedAt: new Date(now - 86_400_000).toISOString(),
    cancelAtPeriodEnd: false,
    revoked: false,
    offer,
    overageItems: overage
      ? { requests: "si_r", bytes: "si_b", credits: "si_c" }
      : {},
    limits: offer.limits,
  }
  await pool.query(
    "insert into api_accounts(team_id,mode,create_token,customer_id,overage_enabled,overage_cap_pence) values($1,'sandbox',$2,$3,$4,$5)",
    [
      team,
      randomUUID(),
      `cus_${team}`,
      Boolean(overage),
      overage?.capPence ?? 0,
    ]
  )
  await pool.query(
    "insert into api_subscriptions(subscription_id,team_id,snapshot) values($1,$2,$3)",
    [`sub_${team}`, team, snapshot]
  )
  const created = await createApiKey(pool, team, "organiser", {
    name: "Test",
    scopes: ["search:read", "libraries:read", "analysis:run"],
    expiresAt: null,
  })

  return { team, secret: created.secret! }
}

describe.skipIf(!enabled)("API ledger in PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("Local database required")
    vi.stubEnv("BILLING_ENV", "sandbox")
    vi.stubEnv("API_OVERAGE_ENABLED", "true")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_ledger")
    admin = new Pool({ connectionString: process.env.DATABASE_URL })
    // eslint-disable-next-line sonarjs/sql-queries -- generated isolated schema
    await admin.query(`create schema ${schema}`)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 10,
    })
    for (const file of ["billing-schema.sql", "api-schema.sql"])
      await pool.query(
        await readFile(
          new URL(`../../../../scripts/${file}`, import.meta.url),
          "utf8"
        )
      )
  })
  afterAll(async () => {
    await pool?.end()
    // eslint-disable-next-line sonarjs/sql-queries -- generated isolated schema
    await admin?.query(`drop schema if exists ${schema} cascade`)
    await admin?.end()
    vi.unstubAllEnvs()
  })

  it("admits exactly the included requests under concurrent reservations", async () => {
    const { team, secret } = await paidAccount({
      requests: 3,
      concurrency: 10,
      perMinute: 100,
    })
    const key = await findApiKey(pool, secret)
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        reserveApiRequest(pool, key, secret, "search:read", "search.libraries")
      )
    )
    const admitted = results.filter((r) => r.status === "fulfilled")
    expect(admitted).toHaveLength(3)
    const refused = results.find((r) => r.status === "rejected")
    expect((refused as PromiseRejectedResult).reason.code).toBe(
      "quota_requests"
    )
    for (const r of admitted)
      await finishApiRequest(
        pool,
        (r as PromiseFulfilledResult<{ id: string; teamId: string }>).value,
        {
          status: 200,
          bytes: 100,
          duration: 1,
        }
      )
    const period = await pool.query(
      "select settled_requests,reserved_requests,reserved_bytes from api_periods where team_id=$1",
      [team]
    )
    expect(period.rows[0]).toMatchObject({
      settled_requests: "3",
      reserved_requests: "0",
      reserved_bytes: "0",
    })
    const events = await pool.query(
      "select count(*) from api_usage_events where team_id=$1",
      [team]
    )
    expect(events.rows[0].count).toBe("3")
  })

  it("settles once, refunds failures and recovers abandoned reservations", async () => {
    const { team, secret } = await paidAccount()
    const key = await findApiKey(pool, secret)
    const ok = await reserveApiRequest(pool, key, secret, "search:read", "s")
    expect(
      await finishApiRequest(pool, ok, { status: 200, bytes: 10, duration: 1 })
    ).toBe(true)
    expect(
      await finishApiRequest(pool, ok, { status: 200, bytes: 10, duration: 1 })
    ).toBe(false)
    const failed = await reserveApiRequest(
      pool,
      key,
      secret,
      "search:read",
      "s"
    )
    await finishApiRequest(pool, failed, { status: 502, bytes: 0, duration: 1 })
    const abandoned = await reserveApiRequest(
      pool,
      key,
      secret,
      "search:read",
      "s"
    )
    await pool.query(
      "update api_requests set started_at=now()-interval '10 minutes' where id=$1",
      [abandoned.id]
    )
    await maintainApiUsage(pool)
    const period = await pool.query(
      "select settled_requests,settled_bytes,reserved_requests from api_periods where team_id=$1",
      [team]
    )
    expect(period.rows[0]).toMatchObject({
      settled_requests: "1",
      settled_bytes: "10",
      reserved_requests: "0",
    })
  })

  it("reserves analysis credits exactly once per job and never double-settles", async () => {
    const { team } = await paidAccount({ analysisCredits: 10 })
    const first = await reserveAnalysisCredits(pool, team, "reach:job-1", 5)
    const again = await reserveAnalysisCredits(pool, team, "reach:job-1", 5)
    expect(again).toMatchObject({
      jobId: "reach:job-1",
      state: "reserved",
      credits: 5,
    })
    expect(first.state).toBe("reserved")
    await reserveAnalysisCredits(pool, team, "reach:job-2", 5)
    await expect(
      reserveAnalysisCredits(pool, team, "reach:job-3", 1)
    ).rejects.toMatchObject({ code: "quota_analysis", status: 429 })
    expect(await settleAnalysisCredits(pool, "reach:job-1")).toBe("settled")
    expect(await settleAnalysisCredits(pool, "reach:job-1")).toBe("settled")
    expect(await refundAnalysisCredits(pool, "reach:job-1")).toBe("settled")
    expect(await refundAnalysisCredits(pool, "reach:job-2")).toBe("refunded")
    expect(await settleAnalysisCredits(pool, "reach:job-2")).toBe("refunded")
    const period = await pool.query(
      "select settled_credits,reserved_credits from api_periods where team_id=$1",
      [team]
    )
    expect(period.rows[0]).toMatchObject({
      settled_credits: "5",
      reserved_credits: "0",
    })
  })

  it("meters only capped overage and refuses work that would cross the cap", async () => {
    // 2 included credits, 50p per extra credit, £10 cap: 20 extra credits fit.
    const { team } = await paidAccount(
      { analysisCredits: 2 },
      { capPence: 1000 }
    )
    await reserveAnalysisCredits(pool, team, "job-a", 22)
    await expect(
      reserveAnalysisCredits(pool, team, "job-b", 1)
    ).rejects.toMatchObject({
      code: "overage_cap",
    })
    await settleAnalysisCredits(pool, "job-a")
    const deliveries = await pool.query(
      "select dimension,quantity from api_meter_deliveries where team_id=$1",
      [team]
    )
    expect(deliveries.rows).toEqual([{ dimension: "credits", quantity: "20" }])
  })
})

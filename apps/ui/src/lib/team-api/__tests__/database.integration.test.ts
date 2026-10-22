import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Pool } from "pg"
import type Stripe from "stripe"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { apiCheckout, refreshApiSubscription } from "../billing"
import { apiConfig, apiMonth } from "../config"
import {
  apiMembership,
  apiUsage,
  changeApiKey,
  createApiKey,
  findApiKey,
  finishApiRequest,
  keyDigest,
  maintainApiUsage,
  reserveApiRequest,
} from "../store"

const enabled = process.env.BILLING_DB_TEST === "true"
const schema = `team_api_test_${randomUUID().replaceAll("-", "")}`
let admin: Pool, pool: Pool
let sequence = 0
const teamId = () => `team${String(++sequence).padStart(20, "0")}`
async function paidTeam(overrides: Record<string, number> = {}) {
  const team = teamId()
  const limits = { ...apiConfig().limits, ...overrides }
  await pool.query(
    "insert into team_api_accounts(team_id,mode,create_token) values($1,'sandbox',$2)",
    [team, randomUUID()]
  )
  await pool.query(
    "insert into team_api_memberships(subscription_id,team_id,snapshot) values($1,$2,$3)",
    [
      `sub_${team}`,
      team,
      {
        mode: "sandbox",
        status: "active",
        priceId: "price_api",
        currency: "gbp",
        unitAmount: 1500,
        paidThrough: "2099-01-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        revoked: false,
        limits,
      },
    ]
  )

  return team
}
const keyInput = {
  name: "Council site",
  scopes: ["search:read", "libraries:read"] as (
    | "search:read"
    | "libraries:read"
  )[],
  expiresAt: null,
}
afterEach(() => vi.unstubAllEnvs())

describe.skipIf(!enabled)("Team API database concurrency and billing", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("Local database required")
    admin = new Pool({ connectionString: process.env.DATABASE_URL })
    // eslint-disable-next-line sonarjs/sql-queries -- generated isolated schema
    await admin.query(`create schema ${schema}`)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 10,
    })
    await pool.query(
      await readFile(
        new URL("../../../../scripts/billing-schema.sql", import.meta.url),
        "utf8"
      )
    )
    await pool.query(
      await readFile(
        new URL("../../../../scripts/team-api-schema.sql", import.meta.url),
        "utf8"
      )
    )
    await pool.query(
      await readFile(
        new URL("../../../../scripts/team-billing-schema.sql", import.meta.url),
        "utf8"
      )
    )
  })
  afterAll(async () => {
    await pool?.end()
    if (admin) {
      // eslint-disable-next-line sonarjs/sql-queries -- generated isolated schema
      await admin.query(`drop schema ${schema} cascade`)
      await admin.end()
    }
  })
  it("requires paid coverage, allows concurrent credentials, and stores only digests", async () => {
    const team = await paidTeam({ keys: 1 })
    const results = await Promise.allSettled([
      createApiKey(pool, team, "organiser", keyInput),
      createApiKey(pool, team, "organiser", keyInput),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2)
    const key = results.find((r) => r.status === "fulfilled")!
    if (key.status !== "fulfilled") throw new Error("Expected key")
    const stored = (
      await pool.query("select * from team_api_keys where team_id=$1", [team])
    ).rows[0]
    expect(key.value.secret).toMatch(/^lg_api_[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(key.value.secret.slice(7), "base64url")).toHaveLength(32)
    expect(stored.digest).toBe(keyDigest(key.value.secret))
    expect(JSON.stringify(stored)).not.toContain(key.value.secret)
    await pool.query(
      "update team_api_memberships set snapshot=jsonb_set(snapshot,'{revoked}','true'::jsonb) where team_id=$1",
      [team]
    )
    await expect(
      createApiKey(pool, team, "organiser", keyInput)
    ).rejects.toThrow("api_addon_required")
  })
  it("shares quotas across keys and instances, preserves counters through regeneration", async () => {
    const team = await paidTeam({ requests: 1, concurrency: 5 })
    const first = await createApiKey(pool, team, "organiser", keyInput)
    const second = await createApiKey(pool, team, "organiser", keyInput)
    const candidates = await Promise.all([
      findApiKey(pool, first.secret),
      findApiKey(pool, second.secret),
    ])
    const attempts = await Promise.allSettled([
      reserveApiRequest(
        pool,
        candidates[0]!,
        first.secret,
        "libraries:read",
        "libraries.list"
      ),
      reserveApiRequest(
        pool,
        candidates[1]!,
        second.secret,
        "libraries:read",
        "libraries.list"
      ),
    ])
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const accepted = attempts.find((r) => r.status === "fulfilled")!
    if (accepted.status !== "fulfilled") throw new Error("Expected reservation")
    await finishApiRequest(pool, accepted.value, 200, 100, 20)
    // A replay of accounting cannot double charge.
    await finishApiRequest(pool, accepted.value, 200, 100, 20)
    const rotated = await changeApiKey(pool, team, "organiser", first.id, true)
    await expect(findApiKey(pool, first.secret)).rejects.toThrow(
      "invalid_api_key"
    )
    const replacement = await findApiKey(pool, rotated.secret!)
    await expect(
      reserveApiRequest(
        pool,
        replacement,
        rotated.secret!,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_request_allowance_exhausted")
    expect((await apiUsage(pool, team)).usage).toMatchObject({
      requests: 1,
      bytes: 100,
    })
    await changeApiKey(pool, team, "organiser", first.id, false)
    await expect(findApiKey(pool, rotated.secret!)).rejects.toThrow(
      "invalid_api_key"
    )
  })
  it("enforces byte and concurrency caps and recovers failures and abandoned reservations", async () => {
    const team = await paidTeam({
      bytes: 1000,
      responseBytes: 800,
      concurrency: 1,
    })
    const created = await createApiKey(pool, team, "organiser", keyInput),
      key = await findApiKey(pool, created.secret)
    const first = await reserveApiRequest(
      pool,
      key,
      created.secret,
      "libraries:read",
      "libraries.list"
    )
    await expect(
      reserveApiRequest(
        pool,
        key,
        created.secret,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_concurrency_limit")
    await finishApiRequest(pool, first, 502, 0, 100)
    expect((await apiUsage(pool, team)).usage).toMatchObject({
      requests: 0,
      bytes: 0,
    })
    const abandoned = await reserveApiRequest(
      pool,
      key,
      created.secret,
      "libraries:read",
      "libraries.list"
    )
    await pool.query(
      "update team_api_requests set started_at=now()-interval '3 minutes' where id=$1",
      [abandoned.id]
    )
    expect(await maintainApiUsage(pool)).toBe(1)
    expect((await apiUsage(pool, team)).usage).toMatchObject({
      requests: 0,
      bytes: 0,
    })
    const success = await reserveApiRequest(
      pool,
      key,
      created.secret,
      "libraries:read",
      "libraries.list"
    )
    await finishApiRequest(pool, success, 200, 800, 100)
    const last = await reserveApiRequest(
      pool,
      key,
      created.secret,
      "libraries:read",
      "libraries.list"
    )
    expect(last.budget).toBe(200)
    await finishApiRequest(pool, last, 200, 200, 100)
    await expect(
      reserveApiRequest(
        pool,
        key,
        created.secret,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_byte_allowance_exhausted")
    expect((await apiUsage(pool, team)).usage).toMatchObject({
      requests: 2,
      bytes: 1000,
    })
  })
  it("rejects cross-Team key changes, expired keys, revoked access and wrong scopes", async () => {
    const team = await paidTeam(),
      other = await paidTeam()
    const created = await createApiKey(pool, team, "organiser", {
      ...keyInput,
      scopes: ["search:read"],
    })
    const key = await findApiKey(pool, created.secret)
    await expect(
      changeApiKey(pool, other, "organiser", created.id, false)
    ).rejects.toThrow("api_key_not_found")
    await expect(
      reserveApiRequest(
        pool,
        key,
        created.secret,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_scope_refused")
    await pool.query(
      "update team_api_keys set expires_at=now()-interval '1 minute' where id=$1",
      [created.id]
    )
    await expect(findApiKey(pool, created.secret)).rejects.toThrow(
      "invalid_api_key"
    )
    expect((await apiUsage(pool, team)).usage.resetsAt).toBe(
      apiMonth().end.toISOString()
    )
  })
  it("enforces the Team rate across separate keys and commits rejected attempts", async () => {
    const team = await paidTeam({ perMinute: 1 })
    const a = await createApiKey(pool, team, "organiser", keyInput),
      b = await createApiKey(pool, team, "organiser", keyInput)
    const first = await reserveApiRequest(
      pool,
      await findApiKey(pool, a.secret),
      a.secret,
      "libraries:read",
      "libraries.list"
    )
    await finishApiRequest(pool, first, 200, 100, 10)
    await expect(
      reserveApiRequest(
        pool,
        await findApiKey(pool, b.secret),
        b.secret,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_rate_limit")
    expect((await apiUsage(pool, team)).endpoints[0]?.errors).toBe(1)
  })
  it("binds checkout to the Team and proves settlement before enabling its add-on", async () => {
    vi.stubEnv("TEAM_API_ENABLED", "true")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
    vi.stubEnv("BILLING_ENV", "sandbox")
    vi.stubEnv("STRIPE_MANAGED_PAYMENTS_ENABLED", "true")
    vi.stubEnv("STRIPE_PRICE_TEAM_API_MONTHLY", "price_api")
    const team = { documentId: teamId(), name: "Library service" }
    const buyer = {
      id: "organiser",
      email: "organiser@example.invalid",
      name: "Organiser",
    }
    let checkoutParams: Record<string, any> = {}
    const stripe = {
      customers: { create: async () => ({ id: `cus_${team.documentId}` }) },
      prices: {
        retrieve: async () => ({
          id: "price_api",
          active: true,
          livemode: false,
          currency: "gbp",
          tax_behavior: "inclusive",
          unit_amount: 1500,
          recurring: {
            interval: "month",
            interval_count: 1,
            usage_type: "licensed",
          },
          product: { active: true, tax_code: "txcd_fixture" },
        }),
      },
      subscriptions: {
        list: async () => ({ data: [], has_more: false }),
        retrieve: async () => ({
          id: "sub_paid_team",
          livemode: false,
          status: "active",
          customer: `cus_${team.documentId}`,
          metadata: checkoutParams.subscription_data.metadata,
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  id: "price_api",
                  currency: "gbp",
                  unit_amount: 1500,
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        }),
      },
      checkout: {
        sessions: {
          create: vi.fn(async (params) => {
            checkoutParams = params

            return { id: "cs_team", url: "https://checkout.stripe.com/fixture" }
          }),
          retrieve: async () => ({
            id: "cs_team",
            status: "complete",
            subscription: "sub_paid_team",
            customer: `cus_${team.documentId}`,
            client_reference_id: team.documentId,
            metadata: checkoutParams.metadata,
            managed_payments: { enabled: true },
          }),
        },
      },
      invoices: { list: vi.fn(async () => ({ data: [] as unknown[] })) },
    }
    await apiCheckout(pool, stripe as unknown as Stripe, team, buyer, {
      locale: "en",
      termsVersion: "1.1",
    })
    expect(checkoutParams.client_reference_id).toBe(team.documentId)
    expect(checkoutParams.subscription_data.metadata).not.toHaveProperty(
      "lg_user_id"
    )
    await refreshApiSubscription(
      pool,
      stripe as unknown as Stripe,
      "sub_paid_team"
    )
    expect((await apiMembership(pool, team.documentId))?.paidThrough).toBeNull()
    await expect(
      createApiKey(pool, team.documentId, buyer.id, keyInput)
    ).rejects.toThrow("api_addon_required")
    const invoice = {
      id: "in_team",
      status: "paid",
      parent: { subscription_details: { subscription: "sub_paid_team" } },
      lines: {
        data: [
          {
            amount: 1500,
            period: { end: 2_000_000_000 },
            pricing: { price_details: { price: "price_api" } },
            parent: {
              subscription_item_details: {
                subscription: "sub_paid_team",
                proration: false,
              },
            },
          },
        ],
      },
    }
    stripe.invoices.list.mockResolvedValue({ data: [invoice] })
    await refreshApiSubscription(
      pool,
      stripe as unknown as Stripe,
      "sub_paid_team"
    )
    expect(
      (await apiMembership(pool, team.documentId))?.paidThrough
    ).not.toBeNull()
    const created = await createApiKey(
      pool,
      team.documentId,
      buyer.id,
      keyInput
    )
    expect(created.secret).toMatch(/^lg_api_/)
    await refreshApiSubscription(
      pool,
      stripe as unknown as Stripe,
      "sub_paid_team",
      { revoke: true, reversedInvoice: "in_team" }
    )
    await expect(
      reserveApiRequest(
        pool,
        await findApiKey(pool, created.secret),
        created.secret,
        "libraries:read",
        "libraries.list"
      )
    ).rejects.toThrow("api_addon_inactive")
  })
})

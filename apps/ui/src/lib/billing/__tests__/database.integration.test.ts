import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Pool } from "pg"
import type Stripe from "stripe"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createManagedCheckout } from "../checkout"
import {
  receiveBillingEvent,
  refreshSubscription,
  syncMembership,
  runBillingWorker,
} from "../events"

const enabled = process.env.BILLING_DB_TEST === "true"
const schema = `billing_test_${randomUUID().replaceAll("-", "")}`
let admin: Pool, pool: Pool
const sessionCreate = vi.fn(
  async (_params: Record<string, unknown>, _options?: unknown) => ({
    id: "cs_test_1",
    url: "https://checkout.stripe.com/test",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  })
)
const customerCreate = vi.fn(async () => ({ id: "cus_test_1" }))
const stripe = {
  customers: { create: customerCreate },
  subscriptions: { list: async () => ({ data: [], has_more: false }) },
  prices: {
    retrieve: async () => ({
      active: true,
      livemode: false,
      recurring: { interval: "month", interval_count: 1 },
      unit_amount: 500,
      currency: "gbp",
      product: { active: true, tax_code: "txcd_fixture" },
    }),
  },
  checkout: {
    sessions: {
      create: sessionCreate,
      retrieve: async () => ({
        id: "cs_test_1",
        status: "open",
        url: "https://checkout.stripe.com/test",
      }),
    },
  },
} as unknown as Stripe
const buyer = {
  id: "fixture_owner",
  email: "fixture@example.org",
  name: "Fixture",
}
const choice = {
  plan: "pro" as const,
  interval: "month" as const,
  locale: "en" as const,
  termsVersion: "2026-10-12",
}

describe.skipIf(!enabled)("billing database isolation and concurrency", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL })
    // Schema name consists only of a fixed prefix and a generated UUID's hex digits.
    // eslint-disable-next-line sonarjs/sql-queries
    await admin.query(`create schema ${schema}`)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
    })
    await pool.query(
      await readFile(
        new URL("../../../../scripts/billing-schema.sql", import.meta.url),
        "utf8"
      )
    )
    await pool.query(
      'create table "user" (id text primary key, "emailVerified" boolean)'
    )
    await pool.query('insert into "user" values($1,true)', [buyer.id])
    vi.stubEnv("PRO_ENABLED", "true")
    vi.stubEnv("STRIPE_MANAGED_PAYMENTS_ENABLED", "true")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_fixture")
    vi.stubEnv("BILLING_ENV", "sandbox")
  })
  afterAll(async () => {
    if (pool) await pool.end()
    if (admin) {
      // eslint-disable-next-line sonarjs/sql-queries -- generated test schema, never user input
      await admin.query(`drop schema ${schema} cascade`)
      await admin.end()
    }
  })
  it("rejects a concurrent purchase and reuses the durable attempt after a retry", async () => {
    let release!: () => void
    let entered!: () => void
    const entry = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    sessionCreate.mockImplementationOnce(async () => {
      entered()
      await gate

      return {
        id: "cs_test_1",
        url: "https://checkout.stripe.com/test",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }
    })
    const first = createManagedCheckout(pool, stripe, buyer, choice)
    await entry
    await expect(
      createManagedCheckout(pool, stripe, buyer, choice)
    ).rejects.toThrow("billing_busy")
    release()
    const created = await first
    const retried = await createManagedCheckout(pool, stripe, buyer, choice)
    expect(retried.attemptId).toBe(created.attemptId)
    expect(sessionCreate).toHaveBeenCalledTimes(1)
    expect(customerCreate).toHaveBeenCalledTimes(1)
    const params = sessionCreate.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >
    expect(params).toMatchObject({
      managed_payments: { enabled: true },
      mode: "subscription",
      customer: "cus_test_1",
      client_reference_id: buyer.id,
    })
    for (const key of [
      "automatic_tax",
      "payment_method_types",
      "adaptive_pricing",
      "tax_id_collection",
    ])
      expect(params).not.toHaveProperty(key)
  })
  it("recovers settlement, retries the CMS outbox, and preserves a refund override", async () => {
    const attempt = (
      await pool.query("select id from billing_attempts where user_id=$1", [
        buyer.id,
      ])
    ).rows[0].id
    const end = Math.floor(Date.now() / 1000) + 30 * 86_400
    const invoice = {
      id: "in_fixture",
      status: "paid",
      parent: { subscription_details: { subscription: "sub_fixture" } },
      lines: {
        data: [
          {
            period: { end },
            pricing: { price_details: { price: "price_fixture" } },
            parent: {
              subscription_item_details: {
                subscription: "sub_fixture",
                proration: false,
              },
            },
          },
        ],
      },
    }
    const subscription = {
      id: "sub_fixture",
      livemode: false,
      customer: "cus_test_1",
      metadata: { lg_attempt_id: attempt, lg_user_id: buyer.id },
      status: "active",
      start_date: Math.floor(Date.now() / 1000),
      cancel_at_period_end: false,
      items: {
        data: [
          {
            quantity: 1,
            current_period_end: end,
            price: {
              id: "price_fixture",
              currency: "gbp",
              unit_amount: 500,
              recurring: { interval: "month" },
            },
          },
        ],
      },
    }
    const provider = {
      subscriptions: { retrieve: async () => subscription },
      invoices: { list: async () => ({ data: [invoice] }) },
      checkout: {
        sessions: {
          retrieve: async () => ({
            id: "cs_test_1",
            managed_payments: { enabled: true },
            subscription: "sub_fixture",
            customer: "cus_test_1",
            client_reference_id: buyer.id,
            metadata: { lg_attempt_id: attempt },
          }),
        },
      },
    } as unknown as Stripe
    const event = {
      id: "evt_fixture",
      type: "invoice.paid",
      livemode: false,
      data: { object: { id: "in_fixture" } },
    } as unknown as Stripe.Event
    await receiveBillingEvent(pool, event)
    await receiveBillingEvent(pool, event)
    expect(
      Number(
        (await pool.query("select count(*) from billing_events")).rows[0].count
      )
    ).toBe(1)
    await refreshSubscription(pool, provider, "sub_fixture")
    await refreshSubscription(pool, provider, "sub_fixture")
    const settled = (
      await pool.query(
        "select * from billing_memberships where subscription_id='sub_fixture'"
      )
    ).rows[0]
    expect(settled.snapshot).toMatchObject({
      plan: "pro",
      revoked: false,
      paidThrough: new Date(end * 1000).toISOString(),
    })
    expect(settled.revision).toBe("1")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetcher)
    try {
      await expect(syncMembership(pool, settled)).rejects.toThrow(
        "billing_sync_unavailable"
      )
      expect(
        (await pool.query("select synced_revision from billing_memberships"))
          .rows[0].synced_revision
      ).toBe("0")
      await syncMembership(pool, settled)
      expect(
        (await pool.query("select synced_revision from billing_memberships"))
          .rows[0].synced_revision
      ).toBe("1")
    } finally {
      vi.unstubAllGlobals()
    }
    await refreshSubscription(pool, provider, "sub_fixture", {
      revoke: true,
      reversedInvoice: "in_fixture",
    })
    await refreshSubscription(pool, provider, "sub_fixture")
    expect(
      (await pool.query("select snapshot from billing_memberships")).rows[0]
        .snapshot.revoked
    ).toBe(true)
    subscription.metadata.lg_user_id = "forged"
    await expect(
      refreshSubscription(pool, provider, "sub_fixture")
    ).rejects.toThrow("subscription_binding_invalid")
    const fetchFailure = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal("fetch", fetchFailure)
    try {
      const work = await runBillingWorker(pool, provider)
      expect(work.failed).toBeGreaterThan(0)
      const pending = (
        await pool.query(
          "select sync_attempts,next_sync_at>now() as deferred from billing_memberships"
        )
      ).rows[0]
      expect(pending).toMatchObject({ sync_attempts: 1, deferred: true })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

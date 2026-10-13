import type { Pool } from "pg"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createPlanChangePortal } from "../plan-change"

const query = vi.fn()
const create = vi.fn()
const retrieve = vi.fn()
const price = vi.fn()
const pool = {
  connect: async () => ({ query, release: vi.fn() }),
} as unknown as Pool
const stripe = {
  subscriptions: { retrieve },
  prices: { retrieve: price },
  billingPortal: { sessions: { create } },
} as unknown as Stripe
const choice = {
  plan: "pro" as const,
  interval: "year" as const,
  locale: "en" as const,
}
const paid = {
  mode: "sandbox",
  plan: "pro",
  interval: "month",
  status: "active",
  currency: "gbp",
  unitAmount: 500,
  memberSince: new Date().toISOString(),
  periodEnd: null,
  paidThrough: new Date(Date.now() + 86_400_000).toISOString(),
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
  vi.stubEnv("BILLING_ENV", "sandbox")
  vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "price_year")
  vi.stubEnv("STRIPE_PORTAL_CONFIGURATION", "bpc_fixture")
  vi.stubEnv("STRIPE_SUPPORTER_APPROVED", "false")
  query.mockImplementation(async (sql: string) =>
    sql.includes("pg_try_advisory_lock")
      ? { rows: [{ locked: true }] }
      : sql.includes("from billing_accounts")
        ? {
            rows: [
              {
                customer_id: "cus_owner",
                mode: "sandbox",
                deleting: false,
                erased_at: null,
              },
            ],
          }
        : sql.includes("from billing_memberships")
          ? { rows: [{ subscription_id: "sub_owned", snapshot: paid }] }
          : { rows: [] }
  )
  retrieve.mockResolvedValue({
    id: "sub_owned",
    customer: "cus_owner",
    livemode: false,
    metadata: { lg_user_id: "owner" },
    status: "active",
    pending_update: null,
    schedule: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: "si_owned",
          quantity: 1,
          price: { id: "price_month", metadata: { lg_cohort: "founding" } },
        },
      ],
    },
  })
  price.mockResolvedValue({
    id: "price_year",
    active: true,
    livemode: false,
    currency: "gbp",
    unit_amount: 5000,
    recurring: { interval: "year", interval_count: 1 },
    metadata: { lg_cohort: "founding" },
    product: { active: true, tax_code: "txcd_fixture" },
  })
  create.mockResolvedValue({ url: "https://billing.stripe.com/p/session" })
})
describe("owned plan change provider review", () => {
  it("uses owned subscription/item IDs and a server-configured price, never charging directly", async () => {
    await createPlanChangePortal(pool, stripe, "owner", choice)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_owner",
        configuration: "bpc_fixture",
        flow_data: expect.objectContaining({
          type: "subscription_update_confirm",
          subscription_update_confirm: {
            subscription: "sub_owned",
            items: [{ id: "si_owned", price: "price_year", quantity: 1 }],
          },
        }),
      })
    )
  })
  it("refuses cross-customer provider state", async () => {
    const current = await retrieve()
    retrieve.mockResolvedValue({ ...current, customer: "cus_other" })
    await expect(
      createPlanChangePortal(pool, stripe, "owner", choice)
    ).rejects.toThrow("subscription_binding_invalid")
    expect(create).not.toHaveBeenCalled()
  })
  it("does not move a founding subscriber to a standard cohort", async () => {
    const target = await price()
    price.mockResolvedValue({ ...target, metadata: { lg_cohort: "standard" } })
    await expect(
      createPlanChangePortal(pool, stripe, "owner", choice)
    ).rejects.toThrow("founding_price_requires_review")
    expect(create).not.toHaveBeenCalled()
  })
  it("refuses a second change while Stripe has one scheduled", async () => {
    const current = await retrieve()
    retrieve.mockResolvedValue({ ...current, schedule: "sub_sched_pending" })
    await expect(
      createPlanChangePortal(pool, stripe, "owner", choice)
    ).rejects.toThrow("membership_change_pending")
    expect(create).not.toHaveBeenCalled()
  })
  it("keeps unapproved Supporter out of plan changes", async () => {
    await expect(
      createPlanChangePortal(pool, stripe, "owner", {
        ...choice,
        plan: "supporter",
      })
    ).rejects.toThrow("supporter_pending_approval")
    expect(query).not.toHaveBeenCalled()
  })
})

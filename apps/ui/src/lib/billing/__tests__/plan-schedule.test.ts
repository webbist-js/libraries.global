import type { Pool, PoolClient } from "pg"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  schedulePlanChange,
  undoPlanChange,
  finishPlanChanges,
} from "../plan-schedule"

const end = Math.floor(Date.now() / 1000) + 86400
const sub = {
  id: "sub_owner",
  customer: "cus_owner",
  livemode: false,
  metadata: { lg_user_id: "owner" },
  items: {
    data: [
      {
        id: "si_owner",
        current_period_end: end,
        quantity: 1,
        price: { id: "price_pro" },
      },
    ],
  },
} as unknown as Stripe.Subscription
const target = {
  id: "price_supporter",
  unit_amount: 300,
  currency: "gbp",
} as Stripe.Price
const choice = { plan: "supporter" as const, interval: "month" as const }
const change = {
  id: "intent",
  price_id: "price_supporter",
  period_end: String(end),
  schedule_id: null,
  state: "preparing",
  created_at: new Date(),
}
const query = vi.fn()
const create = vi.fn(),
  update = vi.fn(),
  release = vi.fn(),
  retrieve = vi.fn()
const schedule = {
  id: "sub_sched_owned",
  subscription: "sub_owner",
  customer: "cus_owner",
  livemode: false,
  status: "active",
  metadata: { lg_change_id: "intent" },
  current_phase: { start_date: end - 86400, end_date: end },
  phases: [
    { start_date: end - 86400 },
    { start_date: end, items: [{ price: "price_supporter" }] },
  ],
}
const stripe = {
  subscriptionSchedules: { create, update, release, retrieve },
  subscriptions: {
    retrieve: vi.fn().mockResolvedValue({ ...sub, schedule: schedule.id }),
  },
} as unknown as Stripe
const client = { query } as unknown as PoolClient
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BILLING_ENV", "sandbox")
  query.mockImplementation(async (sql: string) =>
    sql.includes("pg_try_advisory_lock")
      ? { rows: [{ locked: true }] }
      : sql.startsWith("insert")
        ? { rows: [change] }
        : sql.includes("join billing_accounts")
          ? {
              rows: [
                {
                  ...change,
                  schedule_id: schedule.id,
                  subscription_id: sub.id,
                  customer_id: "cus_owner",
                },
              ],
            }
          : { rows: [] }
  )
  create.mockResolvedValue(schedule)
  update.mockResolvedValue(schedule)
  retrieve.mockResolvedValue(schedule)
  release.mockResolvedValue({ ...schedule, status: "released" })
})
describe("future membership changes", () => {
  it("does not resume a stale queued change after the owner undid it or erased the account", async () => {
    const candidate = {
      ...change,
      user_id: "owner",
      subscription_id: sub.id,
      customer_id: "cus_owner",
    }
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [candidate] }),
      connect: async () => ({ query, release: vi.fn() }),
    } as unknown as Pool
    query.mockImplementation(async (sql: string) => ({
      rows: sql.includes("pg_try_advisory_lock") ? [{ locked: true }] : [],
    }))
    expect(await finishPlanChanges(pool, stripe)).toBe(0)
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
  it("recovers a creation response lost before its schedule ID was persisted", async () => {
    query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("select") ? [change] : [],
    }))
    await schedulePlanChange(
      client,
      stripe,
      "owner",
      { ...sub, schedule: schedule.id },
      target,
      { ...choice, action: "confirm", effectiveAt: end }
    )
    expect(create).toHaveBeenCalledWith(
      { from_subscription: sub.id },
      { idempotencyKey: "lg-schedule-create:intent" }
    )
  })
  it("reviews a reduction without a provider or database mutation", async () => {
    expect(
      await schedulePlanChange(client, stripe, "owner", sub, target, choice)
    ).toMatchObject({
      kind: "schedule",
      scheduled: false,
      effectiveAt: end,
      unitAmount: 300,
    })
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(query.mock.calls.every(([sql]) => sql.startsWith("select"))).toBe(
      true
    )
  })
  it("persists intent before creating a schedule and preserves the currently paid phase", async () => {
    expect(
      await schedulePlanChange(client, stripe, "owner", sub, target, {
        ...choice,
        action: "confirm",
        effectiveAt: end,
      })
    ).toMatchObject({ scheduled: true })
    expect(query.mock.invocationCallOrder[1]).toBeLessThan(
      create.mock.invocationCallOrder[0]!
    )
    expect(create).toHaveBeenCalledWith(
      { from_subscription: "sub_owner" },
      { idempotencyKey: "lg-schedule-create:intent" }
    )
    expect(update).toHaveBeenCalledWith(
      schedule.id,
      expect.objectContaining({
        phases: [
          expect.objectContaining({
            end_date: end,
            items: [{ price: "price_pro", quantity: 1 }],
            proration_behavior: "none",
          }),
          expect.objectContaining({
            start_date: end,
            items: [{ price: "price_supporter", quantity: 1 }],
            proration_behavior: "none",
          }),
        ],
      }),
      { idempotencyKey: "lg-schedule-update:intent" }
    )
  })
  it("refuses a stale confirmation and a foreign provider schedule", async () => {
    await expect(
      schedulePlanChange(client, stripe, "owner", sub, target, {
        ...choice,
        action: "confirm",
        effectiveAt: end - 1,
      })
    ).rejects.toThrow("membership_quote_changed")
    await expect(
      schedulePlanChange(
        client,
        stripe,
        "owner",
        { ...sub, schedule: "foreign" },
        target,
        choice
      )
    ).rejects.toThrow("membership_change_pending")
    expect(create).not.toHaveBeenCalled()
  })
  it("resumes the persisted schedule after an interrupted update without a second creation", async () => {
    query.mockResolvedValue({ rows: [{ ...change, schedule_id: schedule.id }] })
    await schedulePlanChange(
      client,
      stripe,
      "owner",
      { ...sub, schedule: schedule.id },
      target,
      { ...choice, action: "confirm", effectiveAt: end }
    )
    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
  })
  it("undo releases only the owned future schedule and refuses a forged intent", async () => {
    const pool = {
      connect: async () => ({ query, release: vi.fn() }),
    } as unknown as Pool
    expect(await undoPlanChange(pool, stripe, "owner")).toEqual({
      undone: true,
    })
    expect(release).toHaveBeenCalledWith(
      schedule.id,
      {},
      { idempotencyKey: "lg-schedule-undo:intent" }
    )
    retrieve.mockResolvedValue({
      ...schedule,
      metadata: { lg_change_id: "other" },
    })
    await expect(undoPlanChange(pool, stripe, "owner")).rejects.toThrow(
      "schedule_binding_invalid"
    )
    expect(release).toHaveBeenCalledOnce()
  })
})

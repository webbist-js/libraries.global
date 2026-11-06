import type { Pool } from "pg"
import type Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import {
  comparePeriodInvoice,
  deliverApiMeters,
  METER_MAX_ATTEMPTS,
  retryableStripeError,
} from "../meters"

const rates = { requestPence: 1, mibPence: 10, creditPence: 50 }
const prices = { requests: "price_r", bytes: "price_b", credits: "price_c" }
const periodStart = 1_793_000_000
const line = (priceId: string, quantity: number, amount: number) => ({
  priceId,
  periodStart,
  quantity,
  amount,
})

describe("period reconciliation", () => {
  const expected = { requests: 120, bytes: 1536, credits: 3 }
  it("reconciles only when every quantity and amount matches a paid invoice", () => {
    const lines = [
      line("price_r", 120, 120),
      line("price_b", 1536, 15),
      line("price_c", 3, 150),
      line("price_api", 1, 10000),
    ]
    expect(
      comparePeriodInvoice({
        periodStart,
        expected,
        rates,
        prices,
        invoice: { status: "paid", lines },
      })
    ).toEqual({ state: "reconciled" })
    expect(
      comparePeriodInvoice({
        periodStart,
        expected,
        rates,
        prices,
        invoice: { status: "open", lines },
      })
    ).toEqual({ state: "unpaid" })
    expect(
      comparePeriodInvoice({
        periodStart,
        expected,
        rates,
        prices,
        invoice: { status: "draft", lines },
      })
    ).toEqual({ state: "wait" })
  })
  it("flags a quantity or amount mismatch, and meter lag on the wrong period", () => {
    const short = comparePeriodInvoice({
      periodStart,
      expected,
      rates,
      prices,
      invoice: {
        status: "paid",
        lines: [
          line("price_r", 119, 119),
          line("price_b", 1536, 15),
          line("price_c", 3, 150),
        ],
      },
    })
    expect(short.state).toBe("mismatch")
    const lagged = comparePeriodInvoice({
      periodStart,
      expected,
      rates,
      prices,
      invoice: {
        status: "paid",
        lines: [{ ...line("price_r", 120, 120), periodStart: periodStart + 1 }],
      },
    })
    expect(lagged.state).toBe("mismatch")
  })
  it("treats a period without overage and without an invoice as reconciled", () => {
    expect(
      comparePeriodInvoice({
        periodStart,
        expected: { requests: 0, bytes: 0, credits: 0 },
        rates,
        prices,
        invoice: null,
      })
    ).toEqual({ state: "reconciled" })
    expect(
      comparePeriodInvoice({
        periodStart,
        expected,
        rates,
        prices,
        invoice: null,
      })
    ).toEqual({ state: "wait" })
  })
})

const row = (attempts = 0) => ({
  event_id: "req:abc",
  dimension: "bytes",
  quantity: "42",
  occurred_at: new Date(),
  attempts,
  customer_id: "cus_api",
  mode: "sandbox",
})
const pool = (rows: unknown[]) => {
  const query = vi.fn(async (sql: string, _params?: unknown[]) =>
    sql.startsWith("select d.event_id") ? { rows } : { rows: [], rowCount: 1 }
  )

  return { pool: { query } as unknown as Pool, query }
}

describe("meter delivery", () => {
  it("uses the ledger event id as the meter identifier and idempotency key", async () => {
    vi.stubEnv("BILLING_ENV", "sandbox")
    const create = vi.fn().mockResolvedValue({})
    const { pool: db, query } = pool([row()])
    const result = await deliverApiMeters(
      db,
      { billing: { meterEvents: { create } } } as unknown as Stripe,
      () => true
    )
    expect(result).toEqual({ delivered: 1, failed: 0 })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "lg_api_overage_kib",
        identifier: "req:abc:bytes",
        payload: { stripe_customer_id: "cus_api", value: "42" },
      }),
      { idempotencyKey: "lg-api-meter:req:abc:bytes" }
    )
    expect(query.mock.calls.at(-1)?.[0]).toContain("state='delivered'")
    vi.unstubAllEnvs()
  })
  it("retries transient failures with backoff and dead-letters after bounded attempts", async () => {
    vi.stubEnv("BILLING_ENV", "sandbox")
    const transient = Object.assign(new Error("x"), { statusCode: 503 })
    const create = vi.fn().mockRejectedValue(transient)
    const first = pool([row(0)])
    await deliverApiMeters(
      first.pool,
      { billing: { meterEvents: { create } } } as unknown as Stripe,
      () => true
    )
    expect(first.query.mock.calls.at(-1)?.[1]?.[4]).toBe(false)
    const last = pool([row(METER_MAX_ATTEMPTS - 1)])
    await deliverApiMeters(
      last.pool,
      { billing: { meterEvents: { create } } } as unknown as Stripe,
      () => true
    )
    expect(last.query.mock.calls.at(-1)?.[1]?.[4]).toBe(true)
    expect(retryableStripeError({ statusCode: 400 })).toBe(false)
    expect(retryableStripeError({ statusCode: 429 })).toBe(true)
    vi.unstubAllEnvs()
  })
})

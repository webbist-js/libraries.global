import "server-only"

import type { Pool } from "pg"
import type Stripe from "stripe"

import { stripeId } from "@/lib/billing/provider"

import { API_METER_EVENTS, apiConfig } from "./config"
import { invoiceLines } from "./ledger"
import type { ApiDimension, ApiOverageRates } from "./types"

/** Retries stay inside Stripe's 24-hour meter identifier uniqueness window. */
export const METER_MAX_ATTEMPTS = 8
const METER_RETRY_WINDOW_MS = 20 * 3_600_000

type DeliveryRow = {
  event_id: string
  dimension: ApiDimension
  quantity: string
  occurred_at: Date
  attempts: number
  customer_id: string | null
  mode: string
}

/** Stripe errors worth retrying: network, rate limit, conflicts and 5xx. */
export function retryableStripeError(error: unknown) {
  const e = error as { type?: string; statusCode?: number }
  if (e?.type === "StripeConnectionError" || e?.type === "StripeAPIError")
    return true
  const status = e?.statusCode ?? 0

  return status === 0 || status === 409 || status === 429 || status >= 500
}

const errorLabel = (error: unknown) => {
  const e = error as { code?: unknown; type?: unknown }
  const label = typeof e?.code === "string" ? e.code : e?.type

  return typeof label === "string" ? label.slice(0, 80) : "unknown"
}

/**
 * Deliver pending overage usage to Stripe Billing Meters. The usage event id
 * plus dimension is both the meter identifier and the request idempotency
 * key, so a retry cannot double-count. Failures back off and, after bounded
 * attempts or once the identifier window would lapse, move to dead-letter
 * for reconciliation. Admission never waits on delivery.
 */
export async function deliverApiMeters(
  pool: Pool,
  stripe: Stripe,
  withinBudget: () => boolean
) {
  const config = apiConfig()
  const rows = await pool.query<DeliveryRow>(
    "select d.event_id,d.dimension,d.quantity,d.occurred_at,d.attempts,a.customer_id,a.mode from api_meter_deliveries d join api_accounts a on a.team_id=d.team_id where d.state='pending' and d.next_attempt_at<=now() order by d.next_attempt_at limit 50"
  )
  let delivered = 0,
    failed = 0
  for (const row of rows.rows) {
    if (!withinBudget()) break
    const identifier = `${row.event_id}:${row.dimension}`
    if (!row.customer_id || row.mode !== config.mode) {
      await pool.query(
        "update api_meter_deliveries set state='dead',last_error='binding_invalid' where event_id=$1 and dimension=$2",
        [row.event_id, row.dimension]
      )
      failed++
      continue
    }
    try {
      await stripe.billing.meterEvents.create(
        {
          event_name: API_METER_EVENTS[row.dimension],
          identifier,
          timestamp: Math.floor(row.occurred_at.getTime() / 1000),
          payload: {
            stripe_customer_id: row.customer_id,
            value: String(row.quantity),
          },
        },
        { idempotencyKey: `lg-api-meter:${identifier}` }
      )
      await pool.query(
        "update api_meter_deliveries set state='delivered',delivered_at=now(),attempts=attempts+1,last_error=null where event_id=$1 and dimension=$2",
        [row.event_id, row.dimension]
      )
      delivered++
    } catch (error) {
      const attempts = row.attempts + 1
      const dead =
        !retryableStripeError(error) ||
        attempts >= METER_MAX_ATTEMPTS ||
        Date.now() - row.occurred_at.getTime() > METER_RETRY_WINDOW_MS
      await pool.query(
        "update api_meter_deliveries set attempts=$3,last_error=$4,state=case when $5 then 'dead' else 'pending' end,next_attempt_at=now()+($6 * interval '1 second') where event_id=$1 and dimension=$2",
        [
          row.event_id,
          row.dimension,
          attempts,
          errorLabel(error),
          dead,
          Math.min(3600, 30 * 2 ** Math.min(attempts, 7)),
        ]
      )
      failed++
    }
  }

  return { delivered, failed }
}

type PeriodRow = {
  team_id: string
  period_start: Date
  period_end: Date
  subscription_id: string
  rates: ApiOverageRates
  reconciliation: string
}

export type PeriodQuantities = Record<ApiDimension, number>

export type InvoiceLineView = {
  priceId: string | null
  periodStart: number
  quantity: number | null
  amount: number
}

/**
 * Compare one period's ledger quantities with the metered invoice lines that
 * bill it. A period is reconciled only when every dimension's invoiced
 * quantity and pre-tax amount match and the invoice is paid.
 */
export function comparePeriodInvoice(input: {
  periodStart: number
  expected: PeriodQuantities
  rates: ApiOverageRates
  prices: Partial<Record<ApiDimension, string>>
  invoice: { status: string | null; lines: InvoiceLineView[] } | null
}):
  | { state: "wait" }
  | { state: "reconciled" | "unpaid" }
  | { state: "mismatch"; detail: Record<string, unknown> } {
  const expectedLines = invoiceLines(
    {
      requests: input.expected.requests,
      kib: input.expected.bytes,
      credits: input.expected.credits,
    },
    input.rates
  )
  const amounts: Record<ApiDimension, number> = {
    requests: expectedLines.requestsPence,
    bytes: expectedLines.bytesPence,
    credits: expectedLines.creditsPence,
  }
  const nothingBilled = Object.values(input.expected).every((q) => q === 0)
  if (!input.invoice)
    return nothingBilled ? { state: "reconciled" } : { state: "wait" }
  if (input.invoice.status === "draft") return { state: "wait" }
  const mismatches: Record<string, unknown> = {}
  for (const dimension of ["requests", "bytes", "credits"] as const) {
    const price = input.prices[dimension]
    const lines = input.invoice.lines.filter(
      (line) =>
        price &&
        line.priceId === price &&
        line.periodStart === input.periodStart
    )
    const quantity = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
    const amount = lines.reduce((sum, line) => sum + line.amount, 0)
    if (quantity !== input.expected[dimension] || amount !== amounts[dimension])
      mismatches[dimension] = {
        ledgerQuantity: input.expected[dimension],
        invoicedQuantity: quantity,
        ledgerAmount: amounts[dimension],
        invoicedAmount: amount,
      }
  }
  if (Object.keys(mismatches).length)
    return { state: "mismatch", detail: mismatches }
  if (input.invoice.status === "paid") return { state: "reconciled" }
  if (
    input.invoice.status === "open" ||
    input.invoice.status === "uncollectible"
  )
    return { state: "unpaid" }

  return { state: "mismatch", detail: { invoiceStatus: input.invoice.status } }
}

/**
 * Reconcile ended periods against Stripe's invoiced meter quantities, by
 * customer, period and dimension. Pending deliveries postpone the check;
 * dead-lettered deliveries or a mismatch need an operator.
 */
export async function reconcileApiPeriods(
  pool: Pool,
  stripe: Stripe,
  withinBudget: () => boolean
) {
  const periods = await pool.query<PeriodRow>(
    "select team_id,period_start,period_end,subscription_id,rates,reconciliation from api_periods where reconciliation in ('open','unpaid') and period_end<now()-interval '2 hours' and (reconciliation_checked_at is null or reconciliation_checked_at<now()-interval '1 hour') order by period_end limit 10"
  )
  let failed = 0
  for (const period of periods.rows) {
    if (!withinBudget()) break
    try {
      const deliveries = await pool.query<{
        dimension: ApiDimension
        quantity: string
        open: string
        dead: string
      }>(
        "select dimension,coalesce(sum(quantity),0) as quantity,count(*) filter(where state='pending') as open,count(*) filter(where state='dead') as dead from api_meter_deliveries where team_id=$1 and period_start=$2 group by dimension",
        [period.team_id, period.period_start]
      )
      const mark = (state: string, detail: unknown = null) =>
        pool.query(
          "update api_periods set reconciliation=$3,reconciliation_detail=$4,reconciliation_checked_at=now() where team_id=$1 and period_start=$2",
          [period.team_id, period.period_start, state, detail]
        )
      if (deliveries.rows.some((d) => Number(d.open) > 0)) {
        await mark(period.reconciliation)
        continue
      }
      if (deliveries.rows.some((d) => Number(d.dead) > 0)) {
        await mark("mismatch", { reason: "meter_dead_letter" })
        continue
      }
      const expected: PeriodQuantities = { requests: 0, bytes: 0, credits: 0 }
      for (const d of deliveries.rows)
        expected[d.dimension] = Number(d.quantity)
      const snapshot = await pool.query<{
        prices: Partial<Record<ApiDimension, string>> | null
      }>(
        "select snapshot->'offer'->'overagePrices' as prices from api_subscriptions where subscription_id=$1",
        [period.subscription_id]
      )
      const prices = snapshot.rows[0]?.prices ?? {}
      const periodStart = Math.floor(period.period_start.getTime() / 1000)
      const priceIds = new Set(Object.values(prices))
      let invoice: { status: string | null; lines: InvoiceLineView[] } | null =
        null
      const invoices = await stripe.invoices.list({
        subscription: period.subscription_id,
        limit: 10,
      })
      for (const candidate of invoices.data) {
        const lines: InvoiceLineView[] = []
        for await (const line of stripe.invoices.listLineItems(candidate.id!, {
          limit: 100,
        }))
          lines.push({
            priceId: stripeId(line.pricing?.price_details?.price),
            periodStart: line.period.start,
            quantity: line.quantity,
            amount: line.amount,
          })
        if (
          lines.some(
            (l) =>
              l.priceId &&
              priceIds.has(l.priceId) &&
              l.periodStart === periodStart
          )
        ) {
          invoice = { status: candidate.status, lines }
          break
        }
      }
      const result = comparePeriodInvoice({
        periodStart,
        expected,
        rates: period.rates,
        prices,
        invoice,
      })
      if (result.state === "wait") {
        const late = Date.now() - period.period_end.getTime() > 3 * 86_400_000
        await (late && !invoice
          ? mark("mismatch", { reason: "invoice_missing" })
          : mark(period.reconciliation))
      } else
        await mark(
          result.state,
          result.state === "mismatch" ? result.detail : null
        )
    } catch {
      failed++
      await pool.query(
        "update api_periods set reconciliation_checked_at=now() where team_id=$1 and period_start=$2",
        [period.team_id, period.period_start]
      )
    }
  }

  return failed
}

/**
 * Pure API ledger arithmetic. The PostgreSQL store applies these rules under
 * one account/period row lock; nothing here reads the clock or the database.
 *
 * Money uses exact integers: overage costs are "scaled pence" (pence × 2^20),
 * so a byte priced at `mibPence / 1 MiB` never needs a floating-point value.
 */
import type { ApiLimits, ApiOverageRates, ApiUsageTotals } from "./types"

export const MIB = 1_048_576
const SCALE = BigInt(MIB)
/** Rounding guard so the rounded bytes invoice line cannot exceed the cap. */
const HALF_PENNY = SCALE / 2n

export type QuotaCode =
  | "quota_requests"
  | "quota_bytes"
  | "quota_analysis"
  | "overage_cap"

export type LedgerState = {
  settled: ApiUsageTotals
  reserved: ApiUsageTotals
}

export type Demand = {
  /** 1 for a request, 0 for an analysis-only reservation. */
  requests: 0 | 1
  /** Largest response the caller may produce; 0 when no response is metered. */
  maxBytes: number
  /** Analysis credits the operation may spend. */
  credits: number
  /** Refuse when fewer bytes than this remain (a useful page size). */
  minBytes?: number
}

/** `capPence` null means overage is unavailable for this admission. */
export type OveragePolicy = { capPence: number } | null

export type Admission =
  | { ok: true; bytes: number }
  | { ok: false; code: QuotaCode }

type Included = Pick<ApiLimits, "requests" | "bytes" | "analysisCredits">

const excess = (used: number, included: number) => Math.max(0, used - included)
const big = (n: number) => BigInt(Math.max(0, Math.trunc(n)))

export const totalsOf = (state: LedgerState): ApiUsageTotals => ({
  requests: state.settled.requests + state.reserved.requests,
  bytes: state.settled.bytes + state.reserved.bytes,
  credits: state.settled.credits + state.reserved.credits,
})

/** Exact overage before tax for these totals, in scaled pence. */
export function overageScaled(
  totals: ApiUsageTotals,
  included: Included,
  rates: ApiOverageRates
): bigint {
  return (
    big(excess(totals.requests, included.requests)) *
      big(rates.requestPence) *
      SCALE +
    big(excess(totals.bytes, included.bytes)) * big(rates.mibPence) +
    big(excess(totals.credits, included.analysisCredits)) *
      big(rates.creditPence) *
      SCALE
  )
}

function includedRefusal(
  demand: Demand,
  requests: number,
  credits: number,
  limits: Included
): Admission | null {
  if (demand.requests && requests > limits.requests)
    return { ok: false, code: "quota_requests" }
  if (demand.credits && credits > limits.analysisCredits)
    return { ok: false, code: "quota_analysis" }

  return null
}

/** Bytes the remaining overage `room` (scaled pence) can still pay for. */
function affordableBytes(
  room: bigint,
  demand: Demand,
  rates: ApiOverageRates
): number {
  if (room <= 0n) return 0
  if (rates.mibPence <= 0) return demand.maxBytes

  return Number(room / big(rates.mibPence))
}

/**
 * Admit one operation against the worst case of settled usage, every
 * concurrent reservation and this demand. Without an overage policy the
 * included allowance is a hard stop; with one, aggregate overage stays
 * within the cap before tax. Returns the byte budget to reserve.
 */
export function admit(
  state: LedgerState,
  demand: Demand,
  limits: Included,
  rates: ApiOverageRates,
  overage: OveragePolicy
): Admission {
  const used = totalsOf(state)
  const requests = used.requests + demand.requests
  const credits = used.credits + demand.credits
  if (!overage) {
    const refused = includedRefusal(demand, requests, credits, limits)
    if (refused) return refused
  }
  const includedHeadroom = Math.max(0, limits.bytes - used.bytes)
  let budget = Math.min(demand.maxBytes, includedHeadroom)
  if (overage) {
    const cap = big(overage.capPence) * SCALE
    const base = overageScaled(
      { requests, bytes: used.bytes, credits },
      limits,
      rates
    )
    if (base > cap) return { ok: false, code: "overage_cap" }
    if (demand.maxBytes > includedHeadroom) {
      const affordable = affordableBytes(cap - HALF_PENNY - base, demand, rates)
      budget = Math.min(demand.maxBytes, includedHeadroom + affordable)
    }
  }
  if (demand.maxBytes > 0 && budget < (demand.minBytes ?? 1))
    return {
      ok: false,
      code:
        overage && includedHeadroom < (demand.minBytes ?? 1)
          ? "overage_cap"
          : "quota_bytes",
    }

  return { ok: true, bytes: Math.max(0, budget) }
}

/** Billable overage units. Bytes are metered in whole KiB of total excess. */
export type OverageUnits = { requests: number; kib: number; credits: number }

export function overageUnits(
  totals: ApiUsageTotals,
  included: Included
): OverageUnits {
  return {
    requests: excess(totals.requests, included.requests),
    kib: Math.floor(excess(totals.bytes, included.bytes) / 1024),
    credits: excess(totals.credits, included.analysisCredits),
  }
}

/**
 * Units one settlement adds. Cumulative settled totals are monotonic, so the
 * deltas of every settlement in a period sum to that period's overage.
 */
export function overageDeltas(
  before: ApiUsageTotals,
  after: ApiUsageTotals,
  included: Included
): OverageUnits {
  const a = overageUnits(before, included)
  const b = overageUnits(after, included)

  return {
    requests: b.requests - a.requests,
    kib: b.kib - a.kib,
    credits: b.credits - a.credits,
  }
}

/** Round half up for a non-negative rational `numerator / denominator`. */
const roundHalfUp = (numerator: bigint, denominator: bigint) =>
  Number((numerator * 2n + denominator) / (denominator * 2n))

/**
 * The period's invoice lines in pence before tax. Only each line is rounded;
 * the byte line is priced per KiB (`mibPence / 1024`).
 */
export function invoiceLines(units: OverageUnits, rates: ApiOverageRates) {
  const requestsPence = units.requests * rates.requestPence
  const bytesPence = roundHalfUp(big(units.kib) * big(rates.mibPence), 1024n)
  const creditsPence = units.credits * rates.creditPence

  return {
    requestsPence,
    bytesPence,
    creditsPence,
    totalPence: requestsPence + bytesPence + creditsPence,
  }
}

/** Stripe `unit_amount_decimal` (pence) for one KiB of byte overage. */
export function kibUnitAmountDecimal(mibPence: number) {
  // toFixed never uses exponent notation below 1e21, so this is plain digits.
  const fixed = (mibPence / 1024).toFixed(12)
  let end = fixed.length
  while (end > 0 && fixed[end - 1] === "0") end--
  if (fixed[end - 1] === ".") end--

  return fixed.slice(0, end)
}

/** Thresholds (percent) newly reached between two readings of `used / limit`. */
export function thresholdsCrossed(
  before: number,
  after: number,
  limit: number,
  thresholds: readonly number[] = [50, 80, 100]
) {
  if (limit <= 0) return []

  return thresholds.filter(
    (t) => before * 100 < t * limit && after * 100 >= t * limit
  )
}

/** Thresholds of the overage cap newly reached, comparing scaled costs. */
export function capThresholdsCrossed(
  before: bigint,
  after: bigint,
  capPence: number,
  thresholds: readonly number[] = [50, 80, 100]
) {
  if (capPence <= 0) return []
  const cap = big(capPence) * SCALE

  return thresholds.filter(
    (t) => before * 100n < BigInt(t) * cap && after * 100n >= BigInt(t) * cap
  )
}

import { describe, expect, it } from "vitest"

import {
  admit,
  capThresholdsCrossed,
  invoiceLines,
  kibUnitAmountDecimal,
  MIB,
  overageDeltas,
  overageScaled,
  overageUnits,
  thresholdsCrossed,
  type LedgerState,
} from "../ledger"

const limits = { requests: 10_000, bytes: 262_144_000, analysisCredits: 100 }
const rates = { requestPence: 1, mibPence: 10, creditPence: 50 }
const RESPONSE = 131_072
const zero = { requests: 0, bytes: 0, credits: 0 }
const state = (
  settled: Partial<typeof zero> = {},
  reserved: Partial<typeof zero> = {}
): LedgerState => ({
  settled: { ...zero, ...settled },
  reserved: { ...zero, ...reserved },
})
const request = {
  requests: 1 as const,
  maxBytes: RESPONSE,
  credits: 0,
  minBytes: 128,
}

describe("reservation admission without overage", () => {
  it("reserves one request and the full response cap while allowance remains", () => {
    expect(admit(state(), request, limits, rates, null)).toEqual({
      ok: true,
      bytes: RESPONSE,
    })
  })
  it("counts concurrent reservations toward the request allowance", () => {
    expect(
      admit(state({ requests: 9999 }), request, limits, rates, null).ok
    ).toBe(true)
    expect(
      admit(
        state({ requests: 9999 }, { requests: 1 }),
        request,
        limits,
        rates,
        null
      )
    ).toEqual({ ok: false, code: "quota_requests" })
  })
  it("shrinks the byte budget to what is left and refuses below a useful minimum", () => {
    const nearlyFull = state({ bytes: limits.bytes - 1000 })
    expect(admit(nearlyFull, request, limits, rates, null)).toEqual({
      ok: true,
      bytes: 1000,
    })
    expect(
      admit(state({ bytes: limits.bytes - 100 }), request, limits, rates, null)
    ).toEqual({ ok: false, code: "quota_bytes" })
    expect(
      admit(state({}, { bytes: limits.bytes }), request, limits, rates, null)
    ).toEqual({ ok: false, code: "quota_bytes" })
  })
  it("refuses analysis that cannot fit before any work starts", () => {
    const job = { requests: 0 as const, maxBytes: 0, credits: 5 }
    expect(admit(state({ credits: 95 }), job, limits, rates, null).ok).toBe(
      true
    )
    expect(
      admit(state({ credits: 95 }, { credits: 1 }), job, limits, rates, null)
    ).toEqual({ ok: false, code: "quota_analysis" })
  })
})

describe("capped overage admission", () => {
  const cap = { capPence: 1000 }
  it("allows requests past the allowance until the cap, counting reservations", () => {
    // 10,000 included + 1,000 at 1p reaches £10 exactly.
    const atCap = state({ requests: 10_999 })
    expect(
      admit(atCap, { ...request, maxBytes: 0 }, limits, rates, cap).ok
    ).toBe(true)
    expect(
      admit(
        state({ requests: 10_999 }, { requests: 1 }),
        { ...request, maxBytes: 0 },
        limits,
        rates,
        cap
      )
    ).toEqual({ ok: false, code: "overage_cap" })
  })
  it("prices bytes from total excess bytes and limits the budget to the cap", () => {
    // Bytes fully used; requests within the allowance. £1 cap buys < 10 MiB.
    const full = state({ bytes: limits.bytes })
    const result = admit(full, request, limits, rates, { capPence: 100 })
    expect(result).toEqual({ ok: true, bytes: RESPONSE })
    // 9.9 MiB of excess already accrued: only the rest of the cap is left.
    const almost = state({ bytes: limits.bytes + Math.floor(9.9 * MIB) })
    const tight = admit(almost, request, limits, rates, { capPence: 100 })
    expect(tight.ok).toBe(true)
    if (tight.ok) {
      expect(tight.bytes).toBeLessThan(RESPONSE)
      const cost = overageScaled(
        {
          requests: 1,
          bytes: limits.bytes + Math.floor(9.9 * MIB) + tight.bytes,
          credits: 0,
        },
        limits,
        rates
      )
      // Never beyond the cap, with a half-penny margin for line rounding.
      expect(cost).toBeLessThanOrEqual(100n * BigInt(MIB) - BigInt(MIB / 2))
    }
  })
  it("refuses early when the worst-case analysis reservation would cross the cap", () => {
    const job = { requests: 0 as const, maxBytes: 0, credits: 20 }
    // 100 included; 20 extra credits at 50p = £10 fits a £10 cap exactly.
    expect(admit(state({ credits: 100 }), job, limits, rates, cap).ok).toBe(
      true
    )
    expect(
      admit(state({ credits: 100 }, { credits: 1 }), job, limits, rates, cap)
    ).toEqual({ ok: false, code: "overage_cap" })
  })
  it("stops all paid usage when accrued charges already exceed a lowered cap", () => {
    const accrued = state({ requests: 12_000 }) // £20 accrued
    expect(admit(accrued, request, limits, rates, { capPence: 1000 })).toEqual({
      ok: false,
      code: "overage_cap",
    })
    // Turning overage off falls back to the included allowance only.
    expect(admit(accrued, request, limits, rates, null)).toEqual({
      ok: false,
      code: "quota_requests",
    })
  })
})

describe("settlement deltas and invoice lines", () => {
  it("sums per-settlement deltas to the period's total overage", () => {
    let settled = { requests: 9998, bytes: limits.bytes - 600, credits: 99 }
    const total = { requests: 0, kib: 0, credits: 0 }
    for (const step of [
      { requests: 1, bytes: 500, credits: 0 },
      { requests: 1, bytes: 700, credits: 2 },
      { requests: 1, bytes: 1500, credits: 0 },
      { requests: 1, bytes: 300, credits: 1 },
    ]) {
      const after = {
        requests: settled.requests + step.requests,
        bytes: settled.bytes + step.bytes,
        credits: settled.credits + step.credits,
      }
      const d = overageDeltas(settled, after, limits)
      total.requests += d.requests
      total.kib += d.kib
      total.credits += d.credits
      settled = after
    }
    expect(total).toEqual(overageUnits(settled, limits))
    expect(total).toEqual({ requests: 2, kib: 2, credits: 2 })
  })
  it("rounds only each period line to the penny, not each request to a MiB", () => {
    // 1.5 MiB excess = 1536 KiB → 15p; 1 KiB excess → 0.0098p rounds to 0.
    expect(
      invoiceLines({ requests: 0, kib: 1536, credits: 0 }, rates).bytesPence
    ).toBe(15)
    expect(
      invoiceLines({ requests: 0, kib: 1, credits: 0 }, rates).bytesPence
    ).toBe(0)
    // 0.55 MiB = 563.2 KiB → floor 563 KiB → 5.498p → 5p.
    expect(
      invoiceLines({ requests: 0, kib: 563, credits: 0 }, rates).bytesPence
    ).toBe(5)
    expect(invoiceLines({ requests: 7, kib: 0, credits: 3 }, rates)).toEqual({
      requestsPence: 7,
      bytesPence: 0,
      creditsPence: 150,
      totalPence: 157,
    })
  })
  it("prices one KiB exactly in Stripe's decimal format", () => {
    expect(kibUnitAmountDecimal(10)).toBe("0.009765625")
  })
})

describe("warning thresholds", () => {
  it("reports each 50/80/100% threshold once, when first reached", () => {
    expect(thresholdsCrossed(4999, 5000, 10_000)).toEqual([50])
    expect(thresholdsCrossed(5000, 7999, 10_000)).toEqual([])
    expect(thresholdsCrossed(4000, 10_000, 10_000)).toEqual([50, 80, 100])
  })
  it("measures cap thresholds on exact scaled cost", () => {
    const scaled = (pence: number) => BigInt(pence) * BigInt(MIB)
    expect(capThresholdsCrossed(scaled(499), scaled(500), 1000)).toEqual([50])
    expect(capThresholdsCrossed(scaled(0), scaled(0), 0)).toEqual([])
  })
})

import { describe, expect, it } from "vitest"

import { currentPeriod, membershipCovered, overagePermitted } from "../period"
import type { ApiMembership } from "../types"

const membership = (over: Partial<ApiMembership> = {}): ApiMembership =>
  ({
    mode: "sandbox",
    status: "active",
    priceId: "price_api",
    currency: "gbp",
    unitAmount: 10000,
    period: {
      start: "2026-11-03T09:30:00.000Z",
      end: "2026-12-03T09:30:00.000Z",
    },
    paidThrough: "2026-12-03T09:30:00.000Z",
    startedAt: "2026-11-03T09:31:00.000Z",
    cancelAtPeriodEnd: false,
    revoked: false,
    offer: {
      overagePrices: {
        requests: "price_r",
        bytes: "price_b",
        credits: "price_c",
      },
    },
    overageItems: { requests: "si_r", bytes: "si_b", credits: "si_c" },
    ...over,
  }) as ApiMembership

describe("billing period resolution", () => {
  it("uses the settled subscription item period [start, end), not the calendar month", () => {
    const m = membership()
    expect(currentPeriod(m, new Date("2026-11-30T23:59:59Z"))).toEqual(m.period)
    expect(currentPeriod(m, new Date("2026-12-01T00:00:00Z"))).toEqual(m.period)
    expect(currentPeriod(m, new Date("2026-11-03T09:30:00Z"))).toEqual(m.period)
    expect(currentPeriod(m, new Date("2026-12-03T09:30:00Z"))).toBeNull()
  })
  it("opens no new allowance until the renewal is paid", () => {
    // The renewal invoice failed: the projection still holds the ended period.
    const unpaid = membership({ status: "past_due" })
    const after = new Date("2026-12-05T00:00:00Z")
    expect(currentPeriod(unpaid, after)).toBeNull()
    expect(membershipCovered(unpaid, "sandbox", after)).toBe(false)
  })
  it("never authorises overage during past-due grace inside a paid period", () => {
    const now = new Date("2026-11-20T00:00:00Z")
    const pastDue = membership({ status: "past_due" })
    expect(membershipCovered(pastDue, "sandbox", now)).toBe(true)
    expect(overagePermitted(pastDue, "sandbox", now)).toBe(false)
    expect(overagePermitted(membership(), "sandbox", now)).toBe(true)
  })
  it("refuses overage without every metered item, other modes and reversals", () => {
    const now = new Date("2026-11-20T00:00:00Z")
    expect(
      overagePermitted(
        membership({ overageItems: { requests: "si_r" } }),
        "sandbox",
        now
      )
    ).toBe(false)
    expect(membershipCovered(membership(), "live", now)).toBe(false)
    expect(
      membershipCovered(membership({ revoked: true }), "sandbox", now)
    ).toBe(false)
  })
})

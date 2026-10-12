import type { PaidMembership } from "@repo/access"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { billingNotice } from "../src/utils/billing-notice"

const paid: PaidMembership = {
  mode: "sandbox",
  plan: "pro",
  status: "active",
  interval: "month",
  currency: "gbp",
  unitAmount: 500,
  memberSince: "2026-10-12T12:00:00Z",
  periodEnd: "2026-11-12T12:00:00Z",
  paidThrough: "2026-11-12T12:00:00Z",
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
})
afterEach(() => vi.useRealTimers())
describe("membership access notice ownership", () => {
  it("welcomes only settled access and does not repeat for an ordinary renewal", () => {
    expect(billingNotice({ ...paid, paidThrough: null }, null)).toBeNull()
    expect(billingNotice(paid, null)).toMatchObject({
      sendEmail: true,
      title: "Your Pro membership is ready",
    })
    expect(
      billingNotice({ ...paid, paidThrough: "2026-12-12T12:00:00Z" }, paid)
    ).toBeNull()
  })
  it("leaves failure emails to Stripe but sends the end-of-grace access notice", () => {
    const failed = { ...paid, status: "past_due" }
    expect(billingNotice(failed, paid)).toMatchObject({ sendEmail: false })
    expect(
      billingNotice({ ...failed, graceExpired: true }, failed)
    ).toMatchObject({
      sendEmail: true,
      title: "Your paid membership access has ended",
    })
  })
  it("notifies an interval change and keeps complimentary access in cancellation wording", () => {
    expect(billingNotice({ ...paid, interval: "year" }, paid)?.sendEmail).toBe(
      true
    )
    expect(
      billingNotice({ ...paid, cancelAtPeriodEnd: true }, paid)?.body
    ).toContain("complimentary access remain")
  })
  it("confirms scheduled choices and undo without calling the future plan active", () => {
    const scheduled = {
      ...paid,
      pendingChange: {
        plan: "supporter" as const,
        interval: "month" as const,
        effectiveAt: paid.paidThrough!,
      },
    }
    expect(billingNotice(scheduled, paid)).toMatchObject({
      title: "Your membership change is scheduled",
      sendEmail: true,
    })
    expect(billingNotice(scheduled, scheduled)).toBeNull()
    expect(billingNotice(paid, scheduled)).toMatchObject({
      title: "Your scheduled membership change was undone",
      sendEmail: true,
    })
  })
})

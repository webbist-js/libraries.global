import { describe, expect, it } from "vitest"

import {
  isPaidMembership,
  paidMembershipInput,
  resolveCapabilities,
  resolveEntitlements,
  selectPaidMembership,
  type PaidMembership,
} from "../src"

const now = new Date("2026-10-12T12:00:00Z")
const membership: PaidMembership = {
  mode: "sandbox",
  plan: "pro",
  interval: "month",
  currency: "gbp",
  unitAmount: 500,
  status: "active",
  memberSince: "2026-10-01T12:00:00Z",
  periodEnd: "2026-11-01T12:00:00Z",
  paidThrough: "2026-11-01T12:00:00Z",
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
}
const access = (over: Partial<PaidMembership>) =>
  resolveEntitlements({
    signedIn: true,
    now,
    subscription: paidMembershipInput({ ...membership, ...over }),
  })

describe("verified paid access", () => {
  it("needs settlement evidence and an unexpired paid period", () => {
    expect(access({}).plan).toBe("pro")
    expect(access({ paidThrough: null }).plan).toBe("free")
    expect(access({ paidThrough: now.toISOString() }).plan).toBe("free")
    expect(access({ revoked: true }).plan).toBe("free")
    expect(access({ status: "incomplete" }).plan).toBe("free")
  })
  it("retains canceled access only through the proven paid period", () => {
    expect(access({ status: "canceled" }).plan).toBe("pro")
    expect(
      access({ status: "canceled", paidThrough: "2026-10-01T12:00:00Z" }).plan
    ).toBe("free")
  })
  it("never gives renewal grace to an unpaid first purchase", () => {
    expect(
      access({
        status: "past_due",
        pastDueSince: now.toISOString(),
        paidThrough: null,
      }).plan
    ).toBe("free")
    expect(
      access({ status: "past_due", pastDueSince: "2026-10-06T12:00:00Z" }).plan
    ).toBe("pro")
    expect(
      access({ status: "past_due", pastDueSince: "2026-10-04T12:00:00Z" }).plan
    ).toBe("free")
  })
  it("a late ended membership cannot mask an active membership", () => {
    expect(
      selectPaidMembership(
        [{ ...membership, status: "unpaid" }, membership],
        now
      )
    ).toEqual(membership)
    expect(
      selectPaidMembership(
        [{ ...membership, plan: "supporter" }, membership],
        now
      )?.plan
    ).toBe("pro")
  })
  it("keeps complimentary Pro after paid cancellation and does not grant roles", () => {
    expect(
      resolveEntitlements({
        signedIn: true,
        now,
        rewardsTier: "Archivist",
        rewardsPoints: 5000,
        earnedProUntil: "2099-01-01T00:00:00Z",
        subscription: paidMembershipInput({ ...membership, revoked: true }),
      })
    ).toMatchObject({ plan: "pro", source: "earned" })
    const caps = resolveCapabilities({ signedIn: true, grants: [], claims: [] })
    expect(caps.set.has("docs.directEdit")).toBe(false)
  })
  it("refuses malformed bridge projections", () => {
    expect(isPaidMembership(membership)).toBe(true)
    for (const patch of [
      { plan: "team" },
      { paidThrough: "invalid" },
      { unitAmount: -1 },
      { revoked: "false" },
      { interval: "week" },
    ])
      expect(isPaidMembership({ ...membership, ...patch })).toBe(false)
  })
})

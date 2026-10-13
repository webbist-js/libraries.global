import type { PaidMembership } from "@repo/access"
import { describe, expect, it } from "vitest"

import { membershipStatusKey } from "./types"

const member = {
  status: "active",
  paidThrough: "2026-11-12T00:00:00Z",
  revoked: false,
  graceExpired: false,
  cancelAtPeriodEnd: false,
} as PaidMembership
const now = Date.parse("2026-10-12T00:00:00Z")
describe("honest billing status", () => {
  it("does not label an unpaid first purchase active or renewal stopped", () => {
    expect(membershipStatusKey({ ...member, paidThrough: null }, now)).toBe(
      "membershipConfirming"
    )
    expect(
      membershipStatusKey(
        { ...member, status: "incomplete", paidThrough: null },
        now
      )
    ).toBe("membershipConfirming")
  })
  it("distinguishes settled coverage, scheduled cancellation and ended access", () => {
    expect(membershipStatusKey(member, now)).toBe("active")
    expect(
      membershipStatusKey({ ...member, cancelAtPeriodEnd: true }, now)
    ).toBe("renewalStopped")
    expect(
      membershipStatusKey(
        { ...member, paidThrough: "2026-10-01T00:00:00Z" },
        now
      )
    ).toBe("membershipEnded")
  })
  it("shows failure and suspension even when a paid date remains", () => {
    expect(membershipStatusKey({ ...member, status: "past_due" }, now)).toBe(
      "paymentAttention"
    )
    expect(membershipStatusKey({ ...member, revoked: true }, now)).toBe(
      "suspended"
    )
  })
})

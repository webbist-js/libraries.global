import { describe, expect, it } from "vitest"

import { isPaidTeamMembership } from "../src/team-billing"

const membership = {
  mode: "sandbox",
  status: "active",
  priceId: "price_team",
  unitAmount: 12000,
  currency: "gbp",
  seats: 5,
  paidSeats: 5,
  paidThrough: "2027-01-01T00:00:00.000Z",
  accessUntil: "2027-01-01T00:00:00.000Z",
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
  pendingSeats: null,
  pendingAt: null,
}
describe("private Team billing bridge contract", () => {
  it("accepts paid access and a bounded renewal grace period", () => {
    expect(isPaidTeamMembership(membership)).toBe(true)
    expect(
      isPaidTeamMembership({
        ...membership,
        status: "past_due",
        pastDueSince: "2027-01-01T00:00:00.000Z",
        accessUntil: "2027-01-08T00:00:00.000Z",
      })
    ).toBe(true)
  })
  it.each([
    { paidSeats: 6 },
    { paidSeats: 1 },
    { seats: 501 },
    { seats: 4 },
    { revoked: true },
    { paidThrough: null },
    { accessUntil: "2028-01-01T00:00:00.000Z" },
    { pendingSeats: 4 },
    { pendingSeats: 5 },
    { currency: "usd" },
    { status: "unpaid" },
    { pastDueSince: "not a date" },
  ])("refuses malformed or excessive access: %j", (change) => {
    expect(isPaidTeamMembership({ ...membership, ...change })).toBe(false)
  })
})

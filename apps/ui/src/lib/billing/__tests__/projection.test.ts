import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { projectMembership } from "../projection"

const subscription = () =>
  ({
    id: "sub_1",
    status: "active",
    start_date: 1_792_368_000,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: 1_795_046_400,
          price: {
            id: "price_pro",
            currency: "gbp",
            unit_amount: 500,
            recurring: { interval: "month" },
          },
        },
      ],
    },
  }) as unknown as Stripe.Subscription
const invoice = (id = "sub_1", status = "paid") =>
  ({
    status,
    parent: { subscription_details: { subscription: id } },
    lines: {
      data: [
        {
          period: { end: 1_795_046_400 },
          pricing: { price_details: { price: "price_pro" } },
          parent: {
            subscription_item_details: { subscription: id, proration: false },
          },
        },
      ],
    },
  }) as unknown as Stripe.Invoice
const now = new Date("2026-10-12T12:00:00Z")
beforeEach(() => {
  vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro")
})

describe("provider projection", () => {
  it("does not infer settlement from an active status or a different invoice", () => {
    expect(
      projectMembership(subscription(), [], null, now).paidThrough
    ).toBeNull()
    expect(
      projectMembership(
        subscription(),
        [invoice("sub_other"), invoice("sub_1", "open")],
        null,
        now
      ).paidThrough
    ).toBeNull()
    expect(
      projectMembership(subscription(), [invoice()], null, now).paidThrough
    ).toBe(new Date(1_795_046_400_000).toISOString())
  })
  it("preserves the first failure timestamp on retries", () => {
    const sub = subscription()
    sub.status = "past_due"
    const first = projectMembership(sub, [invoice()], null, now)
    const retry = projectMembership(
      sub,
      [],
      first,
      new Date("2026-10-20T12:00:00Z")
    )
    expect(retry.pastDueSince).toBe(first.pastDueSince)
    expect(retry.paidThrough).toBe(first.paidThrough)
  })
  it("rejects unknown prices and added items instead of granting another plan", () => {
    const sub = subscription()
    sub.items.data[0]!.price.id = "price_untrusted"
    expect(() => projectMembership(sub, [], null, now)).toThrow(
      "subscription_catalogue_mismatch"
    )
    const multi = subscription()
    multi.items.data.push(multi.items.data[0]!)
    expect(() => projectMembership(multi, [], null, now)).toThrow(
      "subscription_catalogue_mismatch"
    )
  })
  it("replayed updates cannot remove a refund override", () => {
    const previous = projectMembership(subscription(), [invoice()], null, now)
    expect(
      projectMembership(
        subscription(),
        [invoice()],
        { ...previous, revoked: true },
        now
      ).revoked
    ).toBe(true)
  })
  it("does not grant an unpaid upgraded plan using an older paid invoice", () => {
    const previous = {
      ...projectMembership(subscription(), [invoice()], null, now),
      plan: "supporter" as const,
      settledPriceId: "price_supporter",
    }
    const oldInvoice = invoice()
    oldInvoice.lines.data[0]!.pricing!.price_details!.price = "price_supporter"
    const sub = subscription()
    sub.status = "past_due"
    expect(projectMembership(sub, [oldInvoice], previous, now).plan).toBe(
      "supporter"
    )
  })
  it("retains the paid founding cohort after public price IDs change", () => {
    const previous = projectMembership(subscription(), [invoice()], null, now)
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_standard")
    expect(
      projectMembership(subscription(), [invoice()], previous, now).unitAmount
    ).toBe(500)
  })
  it("keeps settled Supporter coverage after an unpaid upgrade's grace expires", () => {
    const previous = {
      ...projectMembership(subscription(), [invoice()], null, now),
      plan: "supporter" as const,
      settledPriceId: "price_supporter",
      paidThrough: "2026-12-01T00:00:00Z",
      pastDueSince: "2026-10-01T00:00:00Z",
    }
    const sub = subscription()
    sub.status = "past_due"
    const result = projectMembership(sub, [], previous, now)
    expect(result).toMatchObject({
      plan: "supporter",
      status: "active",
      graceExpired: false,
      paidThrough: previous.paidThrough,
    })
    const expired = projectMembership(
      sub,
      [],
      previous,
      new Date("2026-12-10T00:00:00Z")
    )
    expect(expired.graceExpired).toBe(true)
  })
  it("grants a settled upgrade proration but ignores a negative credit line", () => {
    const previous = {
      ...projectMembership(subscription(), [invoice()], null, now),
      plan: "supporter" as const,
      settledPriceId: "price_supporter",
    }
    const settled = invoice()
    settled.lines.data[0]!.parent!.subscription_item_details!.proration = true
    settled.lines.data[0]!.amount = 200
    expect(
      projectMembership(subscription(), [settled], previous, now).plan
    ).toBe("pro")
    settled.lines.data[0]!.amount = -200
    expect(
      projectMembership(subscription(), [settled], previous, now).plan
    ).toBe("supporter")
  })
})

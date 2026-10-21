import type Stripe from "stripe"
import { describe, expect, it } from "vitest"

import { validateTeamPortal } from "../billing"
import { projectTeamMembership } from "../projection"

const now = new Date("2026-06-01T00:00:00Z")
const end = Date.parse("2027-01-01T00:00:00Z") / 1000
function subscription(over: Record<string, unknown> = {}) {
  return {
    id: "sub_team",
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    latest_invoice: null,
    items: {
      data: [
        {
          id: "si_team",
          quantity: 5,
          price: {
            id: "price_team",
            currency: "gbp",
            tax_behavior: "exclusive",
            unit_amount: 12000,
            recurring: {
              interval: "year",
              interval_count: 1,
              usage_type: "licensed",
            },
          },
        },
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription
}
function invoice(quantity = 5, over: Record<string, unknown> = {}) {
  return {
    id: "in_team",
    created: 1,
    status: "paid",
    parent: { subscription_details: { subscription: "sub_team" } },
    lines: {
      data: [
        {
          amount: quantity * 12000,
          quantity,
          period: { start: 1, end },
          parent: {
            subscription_item_details: {
              subscription: "sub_team",
              subscription_item: "si_team",
              proration: false,
            },
          },
          pricing: { price_details: { price: "price_team" } },
        },
      ],
    },
    ...over,
  } as unknown as Stripe.Invoice
}
describe("Team paid-seat projection", () => {
  it("requires settled invoice lines with the subscription, item, price and quantity", () => {
    const unpaid = projectTeamMembership(
      subscription(),
      [],
      null,
      "price_team",
      now
    )
    expect(unpaid).toMatchObject({
      paidSeats: 0,
      paidThrough: null,
      accessUntil: null,
    })
    const paid = projectTeamMembership(
      subscription(),
      [invoice()],
      null,
      "price_team",
      now
    )
    expect(paid.paidSeats).toBe(5)
    expect(paid.accessUntil).toBe("2027-01-01T00:00:00.000Z")
    const wrong = invoice()
    wrong.lines.data[0]!.parent!.subscription_item_details!.subscription_item =
      "si_foreign"
    expect(
      projectTeamMembership(subscription(), [wrong], null, "price_team", now)
        .paidSeats
    ).toBe(0)
    expect(
      projectTeamMembership(
        subscription(),
        [invoice(5, { status: "open" })],
        null,
        "price_team",
        now
      ).paidSeats
    ).toBe(0)
    expect(
      projectTeamMembership(
        subscription(),
        [invoice(5, { lines: { has_more: true, data: invoice().lines.data } })],
        null,
        "price_team",
        now
      ).paidSeats
    ).toBe(0)
  })
  it("preserves paid seats through an unpaid increase and grants the increase only after settlement", () => {
    const paid = projectTeamMembership(
      subscription(),
      [invoice()],
      null,
      "price_team",
      now
    )
    const increased = subscription()
    increased.items.data[0]!.quantity = 9
    expect(
      projectTeamMembership(increased, [], paid, "price_team", now).paidSeats
    ).toBe(5)
    const proration = invoice(9, { created: 2 })
    proration.lines.data[0]!.parent!.subscription_item_details!.proration = true
    expect(
      projectTeamMembership(
        increased,
        [invoice(), proration],
        paid,
        "price_team",
        now
      ).paidSeats
    ).toBe(9)
    proration.lines.data[0]!.amount = -100
    expect(
      projectTeamMembership(
        increased,
        [invoice(), proration],
        paid,
        "price_team",
        now
      ).paidSeats
    ).toBe(5)
  })
  it("bounds renewal grace from the original failure and retains a reversal hold", () => {
    const paid = projectTeamMembership(
      subscription(),
      [invoice()],
      null,
      "price_team",
      now
    )
    const failure = subscription({
      status: "past_due",
      latest_invoice: {
        created: end,
        status_transitions: { finalized_at: end },
      },
    })
    const overdue = projectTeamMembership(
      failure,
      [],
      paid,
      "price_team",
      new Date((end + 86400) * 1000)
    )
    expect(overdue.accessUntil).toBe("2027-01-08T00:00:00.000Z")
    expect(
      projectTeamMembership(
        failure,
        [],
        overdue,
        "price_team",
        new Date((end + 20 * 86400) * 1000)
      ).accessUntil
    ).toBe(overdue.accessUntil)
    const held = projectTeamMembership(
      subscription(),
      [invoice()],
      { ...paid, revoked: true },
      "price_team",
      now
    )
    expect(held).toMatchObject({ revoked: true, accessUntil: null })
    expect(
      projectTeamMembership(
        subscription({ status: "unpaid" }),
        [],
        paid,
        "price_team",
        now
      ).accessUntil
    ).toBeNull()
  })
  it("records future reductions without reducing the current paid period", () => {
    const sub = subscription({
      schedule: {
        status: "active",
        phases: [
          { start_date: end, items: [{ price: "price_team", quantity: 5 }] },
        ],
      },
    })
    sub.items.data[0]!.quantity = 8
    const paid = projectTeamMembership(
      sub,
      [invoice(8)],
      null,
      "price_team",
      now
    )
    expect(paid).toMatchObject({
      paidSeats: 8,
      pendingSeats: 5,
      pendingAt: "2027-01-01T00:00:00.000Z",
    })
    const renewed = subscription()
    const renewal = invoice(5, { created: end })
    renewal.lines.data[0]!.period.end = end + 365 * 86400
    expect(
      projectTeamMembership(renewed, [renewal], paid, "price_team", now)
        .paidSeats
    ).toBe(5)
  })
  it("rejects unknown prices and quantities outside the purchased offer", () => {
    expect(() =>
      projectTeamMembership(subscription(), [], null, "price_wrong", now)
    ).toThrow("catalogue_mismatch")
    const sub = subscription()
    sub.items.data[0]!.quantity = 4
    expect(() =>
      projectTeamMembership(sub, [], null, "price_team", now)
    ).toThrow("catalogue_mismatch")
  })
})
const portal = () =>
  ({
    active: true,
    livemode: false,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["quantity"],
        proration_behavior: "always_invoice",
        schedule_at_period_end: {
          conditions: [{ type: "decreasing_item_amount" }],
        },
        products: [
          {
            prices: ["price_team"],
            adjustable_quantity: { enabled: true, minimum: 5, maximum: 500 },
          },
        ],
      },
    },
  }) as unknown as Stripe.BillingPortal.Configuration
describe("Team Portal configuration", () => {
  it("allows quantity changes only at the original price and schedules reductions", () => {
    expect(() =>
      validateTeamPortal(portal(), "price_team", "sandbox")
    ).not.toThrow()
    expect(() =>
      validateTeamPortal(portal(), "price_discount", "sandbox")
    ).toThrow()
    const bad = portal()
    bad.features.subscription_update.default_allowed_updates.push("price")
    expect(() => validateTeamPortal(bad, "price_team", "sandbox")).toThrow()
    const immediate = portal()
    immediate.features.subscription_update.schedule_at_period_end.conditions =
      []
    expect(() =>
      validateTeamPortal(immediate, "price_team", "sandbox")
    ).toThrow()
  })
})

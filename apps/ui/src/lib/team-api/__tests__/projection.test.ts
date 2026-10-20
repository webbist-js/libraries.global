import type Stripe from "stripe"
import { describe, expect, it, vi, afterEach } from "vitest"

import { apiConfig, apiAccessActive, apiMonth } from "../config"
import { projectApiMembership } from "../projection"

const subscription = () =>
  ({
    id: "sub_api",
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          quantity: 1,
          price: {
            id: "price_api",
            unit_amount: 1500,
            currency: "gbp",
            recurring: { interval: "month", interval_count: 1 },
          },
        },
      ],
    },
  }) as unknown as Stripe.Subscription
const invoice = () =>
  ({
    status: "paid",
    parent: { subscription_details: { subscription: "sub_api" } },
    lines: {
      data: [
        {
          amount: 1500,
          period: { end: 2_000_000_000 },
          pricing: { price_details: { price: "price_api" } },
          parent: {
            subscription_item_details: {
              subscription: "sub_api",
              proration: false,
            },
          },
        },
      ],
    },
  }) as unknown as Stripe.Invoice
afterEach(() => vi.unstubAllEnvs())

describe("Team API paid coverage", () => {
  it("starts history at settlement and preserves that first date across renewals", () => {
    const firstInvoice = invoice()
    firstInvoice.status_transitions = {
      paid_at: 1_790_000_000,
    } as Stripe.Invoice.StatusTransitions
    const first = projectApiMembership(
      subscription(),
      [firstInvoice],
      null,
      "price_api",
      apiConfig().limits
    )
    expect(first.startedAt).toBe(new Date(1_790_000_000_000).toISOString())
    const renewal = invoice()
    renewal.status_transitions = {
      paid_at: 1_800_000_000,
    } as Stripe.Invoice.StatusTransitions
    const renewed = projectApiMembership(
      subscription(),
      [renewal],
      first,
      "price_api",
      first.limits
    )
    expect(renewed.startedAt).toBe(first.startedAt)
    expect(
      projectApiMembership(subscription(), [], null, "price_api", first.limits)
        .startedAt
    ).toBeNull()
  })
  it("requires settled matching invoice lines and pins the purchased limits", () => {
    const limits = apiConfig().limits
    expect(
      projectApiMembership(subscription(), [], null, "price_api", limits)
        .paidThrough
    ).toBeNull()
    const other = invoice()
    other.parent!.subscription_details!.subscription = "sub_other"
    expect(
      projectApiMembership(subscription(), [other], null, "price_api", limits)
        .paidThrough
    ).toBeNull()
    const settled = projectApiMembership(
      subscription(),
      [invoice()],
      null,
      "price_api",
      limits
    )
    expect(settled.paidThrough).toBe(new Date(2_000_000_000_000).toISOString())
    expect(settled.limits).toEqual(limits)
    expect(apiAccessActive(settled)).toBe(true)
    expect(apiAccessActive({ ...settled, revoked: true })).toBe(false)
    expect(apiAccessActive({ ...settled, mode: "live" })).toBe(false)
    expect(apiAccessActive({ ...settled, status: "paused" })).toBe(false)
  })
  it("rejects unrelated prices and extra items", () => {
    const sub = subscription()
    sub.items.data[0]!.price.id = "price_other"
    expect(() =>
      projectApiMembership(sub, [], null, "price_api", apiConfig().limits)
    ).toThrow("api_subscription_catalogue_mismatch")
    sub.items.data.push(sub.items.data[0]!)
    expect(() =>
      projectApiMembership(sub, [], null, "price_other", apiConfig().limits)
    ).toThrow()
  })
  it("preserves reversal holds on replay and never grants an unpaid first purchase", () => {
    const first = projectApiMembership(
      subscription(),
      [],
      null,
      "price_api",
      apiConfig().limits
    )
    expect(apiAccessActive(first)).toBe(false)
    const paid = projectApiMembership(
      subscription(),
      [invoice()],
      null,
      "price_api",
      apiConfig().limits
    )
    expect(
      projectApiMembership(
        subscription(),
        [invoice()],
        { ...paid, revoked: true },
        "price_api",
        paid.limits
      ).revoked
    ).toBe(true)
  })
  it("uses calendar months in UTC and refuses malformed limits", () => {
    expect(apiMonth(new Date("2026-12-31T23:59:59Z")).end.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z"
    )
    vi.stubEnv("TEAM_API_MONTHLY_BYTES", "Infinity")
    expect(() => apiConfig()).toThrow("api_configuration_invalid")
  })
})

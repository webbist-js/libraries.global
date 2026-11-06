import type Stripe from "stripe"
import { describe, expect, it } from "vitest"

import { API_OFFER_LIMITS, API_OFFER_RATES } from "../config"
import { currentPeriod, membershipCovered } from "../period"
import { projectApiMembership } from "../projection"
import type { ApiOffer } from "../types"

const START = 1_793_000_000 // 2026-10-27
const END = START + 30 * 86_400
const offer: ApiOffer = {
  offerVersion: "2026-11-06",
  priceId: "price_api",
  taxBehavior: "inclusive",
  limits: API_OFFER_LIMITS,
  overageRates: API_OFFER_RATES,
  overagePrices: { requests: "price_r", bytes: "price_b", credits: "price_c" },
  consentVersion: "2.0",
}
const item = (id: string, price: string, usage: "licensed" | "metered") => ({
  id,
  quantity: usage === "licensed" ? 1 : undefined,
  price: {
    id: price,
    unit_amount: usage === "licensed" ? 10000 : null,
    currency: "gbp",
    recurring: { interval: "month", interval_count: 1, usage_type: usage },
  },
})
const subscription = (extra: ReturnType<typeof item>[] = []) =>
  ({
    id: "sub_api",
    customer: "cus_api",
    livemode: false,
    status: "active",
    cancel_at_period_end: false,
    items: { data: [item("si_base", "price_api", "licensed"), ...extra] },
  }) as unknown as Stripe.Subscription
const invoice = (
  over: {
    start?: number
    end?: number
    price?: string
    subscription?: string
    customer?: string
    status?: string
    paidAt?: number
    proration?: boolean
  } = {}
) =>
  ({
    id: "in_api",
    status: over.status ?? "paid",
    customer: over.customer ?? "cus_api",
    status_transitions: { paid_at: over.paidAt ?? (over.start ?? START) + 60 },
    parent: {
      subscription_details: { subscription: over.subscription ?? "sub_api" },
    },
    lines: {
      data: [
        {
          amount: 10000,
          period: { start: over.start ?? START, end: over.end ?? END },
          pricing: { price_details: { price: over.price ?? "price_api" } },
          parent: {
            subscription_item_details: {
              subscription: over.subscription ?? "sub_api",
              proration: over.proration ?? false,
            },
          },
        },
      ],
    },
  }) as unknown as Stripe.Invoice
const iso = (s: number) => new Date(s * 1000).toISOString()

describe("API paid projection and webhook binding", () => {
  it("stores the settled item period [start, end) and the purchase snapshot", () => {
    const m = projectApiMembership(subscription(), [invoice()], null, offer)
    expect(m.period).toEqual({ start: iso(START), end: iso(END) })
    expect(m.paidThrough).toBe(iso(END))
    expect(m.offer).toEqual(offer)
    expect(m.limits).toEqual(API_OFFER_LIMITS)
    expect(m.startedAt).toBe(iso(START + 60))
  })
  it("grants nothing from status or checkout alone, unpaid or foreign invoices", () => {
    expect(
      projectApiMembership(subscription(), [], null, offer).period
    ).toBeNull()
    for (const foreign of [
      invoice({ status: "open" }),
      invoice({ subscription: "sub_other" }),
      invoice({ customer: "cus_other" }),
      invoice({ price: "price_other" }),
      invoice({ proration: true }),
    ])
      expect(
        projectApiMembership(subscription(), [foreign], null, offer).paidThrough
      ).toBeNull()
  })
  it("is order-independent and opens the next allowance only when it is paid", () => {
    const first = invoice()
    const renewal = invoice({ start: END, end: END + 31 * 86_400 })
    const a = projectApiMembership(
      subscription(),
      [renewal, first],
      null,
      offer
    )
    const b = projectApiMembership(
      subscription(),
      [first, renewal],
      null,
      offer
    )
    expect(a).toEqual(b)
    expect(a.period?.start).toBe(iso(END))
    // A replayed older event cannot move the period back.
    const replay = projectApiMembership(subscription(), [first], a, offer)
    expect(replay.period).toEqual(a.period)
    // Renewal unpaid: the ended period remains and covers nothing after it.
    const unpaid = projectApiMembership(subscription(), [first], null, offer)
    expect(currentPeriod(unpaid, new Date((END + 60) * 1000))).toBeNull()
    expect(
      membershipCovered(unpaid, "sandbox", new Date((END + 60) * 1000))
    ).toBe(false)
  })
  it("gives a partial first period its full allowance", () => {
    const partial = invoice({ start: START, end: START + 3 * 86_400 })
    const m = projectApiMembership(subscription(), [partial], null, offer)
    expect(m.limits.requests).toBe(10_000)
    expect(currentPeriod(m, new Date((START + 86_400) * 1000))).toEqual(
      m.period
    )
  })
  it("binds metered overage items only to the snapshot's Prices", () => {
    const m = projectApiMembership(
      subscription([
        item("si_r", "price_r", "metered"),
        item("si_b", "price_b", "metered"),
        item("si_c", "price_c", "metered"),
      ]),
      [invoice()],
      null,
      offer
    )
    expect(m.overageItems).toEqual({
      requests: "si_r",
      bytes: "si_b",
      credits: "si_c",
    })
    expect(() =>
      projectApiMembership(
        subscription([item("si_x", "price_unknown", "metered")]),
        [],
        null,
        offer
      )
    ).toThrow("api_subscription_catalogue_mismatch")
    const wrongBase = subscription()
    wrongBase.items.data[0]!.price.id = "price_other"
    expect(() => projectApiMembership(wrongBase, [], null, offer)).toThrow(
      "api_subscription_catalogue_mismatch"
    )
  })
  it("keeps a refund or dispute hold across replays", () => {
    const paid = projectApiMembership(subscription(), [invoice()], null, offer)
    const held = projectApiMembership(
      subscription(),
      [invoice()],
      { ...paid, revoked: true },
      offer
    )
    expect(held.revoked).toBe(true)
    expect(
      membershipCovered(held, "sandbox", new Date((START + 100) * 1000))
    ).toBe(false)
  })
})

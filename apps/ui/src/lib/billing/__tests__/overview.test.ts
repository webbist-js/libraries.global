import type Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import { providerOverview } from "../overview"

const provider = (customer = "cus_owner", live = false) =>
  ({
    subscriptions: {
      retrieve: async () => ({
        customer,
        livemode: live,
        default_payment_method: {
          card: {
            brand: "visa",
            last4: "4242",
            exp_month: 12,
            exp_year: 2034,
            wallet: { type: "apple_pay" },
          },
        },
        items: { data: [{ price: { metadata: { lg_cohort: "founding" } } }] },
        latest_invoice: null,
      }),
    },
    customers: {
      retrieve: async () => ({
        id: "cus_owner",
        name: "Fixture",
        email: "fixture@example.invalid",
        address: { postal_code: "SW1A 1AA", line1: "Private street" },
        invoice_settings: {},
      }),
    },
  }) as unknown as Stripe
describe("owned billing display data", () => {
  it("returns masked card information without copying the whole provider object", async () => {
    const result = await providerOverview(
      provider(),
      "sub_owned",
      "cus_owner",
      "sandbox"
    )
    expect(result).toMatchObject({
      foundingPrice: true,
      paymentMethod: { brand: "visa", last4: "4242", wallet: "apple_pay" },
    })
    expect(JSON.stringify(result)).not.toContain("Private street")
    expect(result.paymentMethod).not.toHaveProperty("number")
  })
  it("refuses a mismatched customer or environment", async () => {
    await expect(
      providerOverview(
        provider("cus_other"),
        "sub_owned",
        "cus_owner",
        "sandbox"
      )
    ).rejects.toThrow("billing_provider_binding_invalid")
    await expect(
      providerOverview(
        provider("cus_owner", true),
        "sub_owned",
        "cus_owner",
        "sandbox"
      )
    ).rejects.toThrow("billing_provider_binding_invalid")
  })
  it("shows the provider's future phase without replacing current paid access", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_month")
    const stripe = provider()
    const current = await stripe.subscriptions.retrieve("sub_owned")
    stripe.subscriptions.retrieve = vi.fn().mockResolvedValue({
      ...current,
      schedule: {
        status: "active",
        current_phase: { start_date: 100, end_date: 200 },
        phases: [
          { start_date: 100, items: [{ price: { id: "price_year" } }] },
          {
            start_date: 200,
            items: [
              {
                price: { id: "price_month", unit_amount: 500, currency: "gbp" },
              },
            ],
          },
        ],
      },
    })
    const result = await providerOverview(
      stripe,
      "sub_owned",
      "cus_owner",
      "sandbox"
    )
    expect(result.scheduledChange).toEqual({
      plan: "pro",
      interval: "month",
      date: 200,
      unitAmount: 500,
      currency: "gbp",
      canUndo: false,
    })
    expect(result.foundingPrice).toBe(true)
    vi.unstubAllEnvs()
  })
  it("flags an unpaid upgrade invoice without claiming a new paid plan", async () => {
    const stripe = provider()
    const current = await stripe.subscriptions.retrieve("sub_owned")
    stripe.subscriptions.retrieve = vi.fn().mockResolvedValue({
      ...current,
      latest_invoice: {
        status: "open",
        amount_due: 200,
        next_payment_attempt: null,
      },
    })
    expect(
      (await providerOverview(stripe, "sub_owned", "cus_owner", "sandbox"))
        .paymentAttention
    ).toBe(true)
  })
})

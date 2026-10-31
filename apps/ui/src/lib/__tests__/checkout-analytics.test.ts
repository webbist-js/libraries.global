import { expect, it } from "vitest"

import { sanitizeCheckoutEvent } from "../checkout-analytics"

it("only accepts fixed product, interval, mode and journey labels", () => {
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "team",
      billing_interval: "year",
      api_addon: "selected",
      billing_mode: "sandbox",
      email: "private@example.test",
      teamId: "private-team",
      url: "https://checkout.stripe.com/private",
      value: 600,
    })
  ).toEqual({
    product: "team",
    billing_interval: "year",
    api_addon: "selected",
    billing_mode: "sandbox",
    interaction_source: "checkout",
  })
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "team",
      billing_interval: "month",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "private-team-name",
      billing_interval: "year",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("purchase", {
      product: "team",
      billing_interval: "year",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("pricing_action", {
      product: "team",
      billing_interval: "year",
      action_type: "person@example.test",
    })
  ).toBeUndefined()
})

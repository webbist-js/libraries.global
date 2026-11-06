import { expect, it } from "vitest"

import { sanitizeCheckoutEvent } from "../checkout-analytics"

it("only accepts the fixed API Access product, interval, mode and events", () => {
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "team_api",
      billing_interval: "month",
      billing_mode: "sandbox",
      email: "private@example.test",
      teamId: "private-team",
      url: "https://checkout.stripe.com/private",
      value: 100,
    })
  ).toEqual({
    product: "team_api",
    billing_interval: "month",
    billing_mode: "sandbox",
    interaction_source: "checkout",
  })
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "team_api",
      billing_interval: "year",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "private-team-name",
      billing_interval: "month",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("begin_checkout", {
      product: "team_api",
      billing_interval: "month",
      billing_mode: "person@example.test",
    })
  ).toBeUndefined()
  expect(
    sanitizeCheckoutEvent("purchase", {
      product: "team_api",
      billing_interval: "month",
    })
  ).toBeUndefined()
})

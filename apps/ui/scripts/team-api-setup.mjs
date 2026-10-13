import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import Stripe from "stripe"

import pricing from "../src/lib/membership-pricing.json" with { type: "json" }

createRequire(import.meta.resolve("next/package.json"))(
  "@next/env"
).loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)))
const apply = process.argv.includes("--apply")
const live = process.env.BILLING_ENV === "live"
if (apply && live && !process.argv.includes("--live"))
  throw new Error("Live catalogue changes require --apply --live")
const secret = process.env.STRIPE_SECRET_KEY
if (
  !secret ||
  !(
    secret.startsWith(live ? "sk_live_" : "sk_test_") ||
    secret.startsWith(live ? "rk_live_" : "rk_test_")
  )
)
  throw new Error("A matching Stripe runtime key is required")
const stripe = new Stripe(secret, {
  apiVersion: "2026-03-25.dahlia",
  maxNetworkRetries: 2,
})
const amount = Number(process.env.TEAM_API_PRICE_PENCE ?? pricing.teamApi.month)
if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000)
  throw new Error("Invalid monthly price")
const taxCode = process.env.TEAM_API_STRIPE_TAX_CODE
if (apply && !taxCode)
  throw new Error(
    "Set TEAM_API_STRIPE_TAX_CODE to the confirmed classification before creating the product"
  )

let product
for await (const candidate of stripe.products.list({
  active: true,
  limit: 100,
})) {
  if (candidate.metadata.lg_feature === "team_api") {
    product = candidate
    break
  }
}
if (!product && apply)
  product = await stripe.products.create(
    {
      name: "Libraries Global Team API",
      description:
        "Team API access to published public Library search and records, with shared monthly request and response-data limits.",
      tax_code: taxCode,
      metadata: { lg_feature: "team_api" },
    },
    { idempotencyKey: `lg-team-api-product:${live ? "live" : "sandbox"}:1` }
  )
if (product && (!product.tax_code || (taxCode && product.tax_code !== taxCode)))
  throw new Error(
    "Existing Team API tax classification differs; review it before changing"
  )
let price
if (product)
  for await (const candidate of stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  })) {
    if (
      candidate.currency === "gbp" &&
      candidate.unit_amount === amount &&
      candidate.tax_behavior === "inclusive" &&
      candidate.recurring?.interval === "month" &&
      candidate.recurring.interval_count === 1 &&
      candidate.recurring.usage_type === "licensed"
    ) {
      price = candidate
      break
    }
  }
if (!price && product && apply)
  price = await stripe.prices.create(
    {
      product: product.id,
      currency: "gbp",
      unit_amount: amount,
      tax_behavior: "inclusive",
      recurring: { interval: "month" },
      metadata: { lg_feature: "team_api" },
    },
    { idempotencyKey: `lg-team-api-price:${product.id}:${amount}:1` }
  )
let portal
for await (const candidate of stripe.billingPortal.configurations.list({
  active: true,
  limit: 100,
})) {
  if (
    candidate.metadata.lg_feature === "team_api" &&
    !candidate.features.subscription_update.enabled &&
    candidate.features.subscription_cancel.enabled &&
    candidate.features.subscription_cancel.mode === "at_period_end"
  ) {
    portal = candidate
    break
  }
}
if (!portal && apply)
  portal = await stripe.billingPortal.configurations.create(
    {
      business_profile: {
        headline: "Manage your Libraries Global Team API add-on",
      },
      metadata: { lg_feature: "team_api" },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "address", "name"],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: { enabled: false },
      },
    },
    { idempotencyKey: `lg-team-api-portal:${live ? "live" : "sandbox"}:1` }
  )
console.log(
  JSON.stringify(
    {
      mode: live ? "live" : "sandbox",
      readOnly: !apply,
      monthlyPricePence: amount,
      STRIPE_PRICE_TEAM_API_MONTHLY: price?.id ?? null,
      STRIPE_PORTAL_CONFIGURATION_TEAM_API: portal?.id ?? null,
      purchasesEnabled: process.env.TEAM_API_ENABLED === "true",
      configured: Boolean(price && portal),
    },
    null,
    2
  )
)
if (!price || !portal) process.exitCode = 1

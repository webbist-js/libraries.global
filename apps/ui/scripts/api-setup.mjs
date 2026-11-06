/**
 * API catalogue setup: the £100 monthly Price, three Billing Meters and their
 * metered overage Prices, and a restricted billing Portal. Read-only unless
 * `--apply`; live writes additionally need BILLING_ENV=live and `--live`.
 * It never enables purchases, creates customers, subscriptions, invoices or
 * payments, and never stores credentials. Matching immutable objects are
 * reused; conflicting ones are reported instead of overwritten.
 *
 *   pnpm --filter @repo/ui api:check            # inspect (sandbox)
 *   pnpm --filter @repo/ui api:setup            # create missing (sandbox)
 *   BILLING_ENV=live node scripts/api-setup.mjs --apply --live
 *
 * Meter constraints (Stripe API 2026-03-25.dahlia): event names are unique
 * per account; events carry `stripe_customer_id` and a whole-number `value`;
 * timestamps must be within the past 35 days; identifiers are unique for at
 * least 24 hours. Bytes are metered in KiB so 10p/MiB is exact per KiB.
 */
import { writeFileSync, chmodSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import Stripe from "stripe"

import pricing from "../src/lib/membership-pricing.json" with { type: "json" }

createRequire(import.meta.resolve("next/package.json"))(
  "@next/env"
).loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)))

const apply = process.argv.includes("--apply")
const live = process.env.BILLING_ENV === "live"
const mode = live ? "live" : "sandbox"
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
const taxCode = process.env.API_STRIPE_TAX_CODE
if (apply && !taxCode)
  throw new Error(
    "Set API_STRIPE_TAX_CODE to the confirmed classification before creating products"
  )
const offer = pricing.version
const amount = pricing.api.month
if (amount !== 10000) throw new Error("The API offer is £100/month")
const kibDecimal = (pricing.api.overage.mibPence / 1024)
  .toFixed(12)
  .replace(/0+$/, "")
  .replace(/\.$/, "")
const DIMENSIONS = [
  {
    key: "requests",
    env: "STRIPE_PRICE_API_OVERAGE_REQUESTS",
    event: "lg_api_overage_requests",
    name: "API overage: successful requests",
    unit: String(pricing.api.overage.requestPence),
  },
  {
    key: "bytes",
    env: "STRIPE_PRICE_API_OVERAGE_BYTES",
    event: "lg_api_overage_kib",
    name: "API overage: response data (per KiB)",
    unit: kibDecimal,
  },
  {
    key: "credits",
    env: "STRIPE_PRICE_API_OVERAGE_CREDITS",
    event: "lg_api_overage_credits",
    name: "API overage: analysis credits",
    unit: String(pricing.api.overage.creditPence),
  },
]
const idem = (name) => ({ idempotencyKey: `lg-api-${name}:${mode}:${offer}` })

async function findProduct(feature) {
  for await (const candidate of stripe.products.list({
    active: true,
    limit: 100,
  }))
    if (candidate.metadata.lg_feature === feature) return candidate

  return null
}
async function product(feature, name, description) {
  let found = await findProduct(feature)
  if (!found && apply)
    found = await stripe.products.create(
      {
        name,
        description,
        tax_code: taxCode,
        metadata: { lg_feature: feature },
      },
      idem(`product-${feature}`)
    )
  if (found && (!found.tax_code || (taxCode && found.tax_code !== taxCode)))
    throw new Error(`${feature} tax classification differs; review it first`)

  return found
}

const base = await product(
  "api_access",
  "Libraries Global API",
  "API access to published public Library data, with monthly request, response-data and analysis allowances."
)
let price = null
if (base)
  for await (const candidate of stripe.prices.list({
    product: base.id,
    active: true,
    limit: 100,
  }))
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
if (!price && base && apply)
  price = await stripe.prices.create(
    {
      product: base.id,
      currency: "gbp",
      unit_amount: amount,
      tax_behavior: "inclusive",
      recurring: { interval: "month" },
      metadata: { lg_feature: "api_access", lg_offer: offer },
    },
    idem("price")
  )

const meters = new Map()
for await (const meter of stripe.billing.meters.list({
  status: "active",
  limit: 100,
}))
  meters.set(meter.event_name, meter)
const overage = {}
for (const d of DIMENSIONS) {
  let meter = meters.get(d.event) ?? null
  if (
    meter &&
    (meter.default_aggregation.formula !== "sum" ||
      meter.customer_mapping.event_payload_key !== "stripe_customer_id" ||
      meter.value_settings.event_payload_key !== "value")
  )
    throw new Error(`Meter ${d.event} differs; inspect instead of overwriting`)
  if (!meter && apply)
    meter = await stripe.billing.meters.create(
      {
        display_name: d.name,
        event_name: d.event,
        default_aggregation: { formula: "sum" },
        customer_mapping: {
          type: "by_id",
          event_payload_key: "stripe_customer_id",
        },
        value_settings: { event_payload_key: "value" },
      },
      idem(`meter-${d.key}`)
    )
  const owner = await product(
    `api_overage_${d.key}`,
    `Libraries Global ${d.name}`,
    "Opt-in usage beyond the API allowance, within the customer's monthly cap."
  )
  let metered = null
  if (owner && meter)
    for await (const candidate of stripe.prices.list({
      product: owner.id,
      active: true,
      limit: 100,
    }))
      if (
        candidate.currency === "gbp" &&
        candidate.tax_behavior === "exclusive" &&
        candidate.recurring?.usage_type === "metered" &&
        candidate.recurring.interval === "month" &&
        candidate.recurring.meter === meter.id &&
        Number(candidate.unit_amount_decimal) === Number(d.unit)
      ) {
        metered = candidate
        break
      }
  if (!metered && owner && meter && apply)
    metered = await stripe.prices.create(
      {
        product: owner.id,
        currency: "gbp",
        unit_amount_decimal: d.unit,
        // The cap applies before tax; Stripe adds any tax due.
        tax_behavior: "exclusive",
        recurring: {
          interval: "month",
          usage_type: "metered",
          meter: meter.id,
        },
        metadata: {
          lg_feature: "api_overage",
          lg_dimension: d.key,
          lg_offer: offer,
        },
      },
      idem(`overage-price-${d.key}`)
    )
  overage[d.env] = metered?.id ?? null
}

let portal = null
for await (const candidate of stripe.billingPortal.configurations.list({
  active: true,
  limit: 100,
}))
  if (
    candidate.metadata.lg_feature === "api_access" &&
    !candidate.features.subscription_update.enabled &&
    candidate.features.subscription_cancel.enabled &&
    candidate.features.subscription_cancel.mode === "at_period_end"
  ) {
    portal = candidate
    break
  }
if (!portal && apply)
  portal = await stripe.billingPortal.configurations.create(
    {
      business_profile: { headline: "Manage your Libraries Global API access" },
      metadata: { lg_feature: "api_access" },
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
    idem("portal")
  )

const env = {
  STRIPE_PRICE_API_MONTHLY: price?.id ?? null,
  ...overage,
  STRIPE_PORTAL_CONFIGURATION_API: portal?.id ?? null,
}
const configured = Object.values(env).every(Boolean)
const manifest = { mode, offer, configured, env }
if (apply) {
  const file = new URL(`./api-${mode}-catalogue.json`, import.meta.url)
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 })
  chmodSync(file, 0o600)
}
console.log(
  JSON.stringify(
    {
      ...manifest,
      readOnly: !apply,
      purchasesEnabled: process.env.API_ENABLED === "true",
      overageEnabled: process.env.API_OVERAGE_ENABLED === "true",
    },
    null,
    2
  )
)
if (!configured) process.exitCode = 1

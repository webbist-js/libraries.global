/** Read-only by default. --apply prepares catalogue only; never starts a subscription. */
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import Stripe from "stripe"

import pricing from "../src/lib/membership-pricing.json" with { type: "json" }

createRequire(import.meta.resolve("next/package.json"))(
  "@next/env"
).loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)))
const apply = process.argv.includes("--apply")
const live = process.argv.includes("--live")
if ((process.env.BILLING_ENV === "live") !== live)
  throw new Error(
    "Select the configured billing mode explicitly; live preparation requires --live"
  )
const key = process.env.STRIPE_SECRET_KEY
if (
  !key?.startsWith(live ? "sk_live_" : "sk_test_") &&
  !key?.startsWith(live ? "rk_live_" : "rk_test_")
)
  throw new Error("A matching-mode Stripe key is required")
const stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" })
const origin = process.env.APP_PUBLIC_URL ?? "http://localhost:3000"
if (
  live &&
  (new URL(origin).protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
)
  throw new Error("Live Team setup requires the confirmed HTTPS public origin")
const manifest = {
  environment: live ? "live" : "sandbox",
  enablesPurchases: false,
  checkedAt: new Date().toISOString(),
  prices: {},
  portals: {},
}
const products = await stripe.products.list({ active: true, limit: 100 })
if (products.has_more)
  throw new Error("Review catalogue pagination before preparation")
const matching = products.data.filter(
  (p) => p.metadata.lg_feature === "team_seats"
)
if (matching.length > 1) throw new Error("Ambiguous Team seat product")
let product = matching[0]
if (!product && apply)
  product = await stripe.products.create(
    {
      name: "Libraries Global Team seats",
      description:
        "Annual Team membership per seat, with a five-seat minimum. Payment does not verify Library authority.",
      tax_code: "txcd_10103001",
      metadata: {
        lg_feature: "team_seats",
        lg_environment: manifest.environment,
      },
    },
    { idempotencyKey: `lg-team-seats-product-v1:${manifest.environment}` }
  )
if (
  product &&
  (product.livemode !== live ||
    (typeof product.tax_code === "string"
      ? product.tax_code
      : product.tax_code?.id) !== "txcd_10103001")
)
  throw new Error("Team seat product mode/classification mismatch")
const portals = await stripe.billingPortal.configurations.list({
  active: true,
  limit: 100,
})
if (portals.has_more)
  throw new Error("Review Portal pagination before preparation")
for (const discounted of [false, true]) {
  const name = discounted ? "public" : "standard"
  const lookup = `lg_team_seats_${name}_year_gbp_v1`
  const amount =
    pricing.team.extraSeatYear *
    (discounted ? (100 - pricing.team.publicServiceDiscountPercent) / 100 : 1)
  let price = (await stripe.prices.list({ lookup_keys: [lookup], limit: 2 }))
    .data[0]
  if (!price && product && apply)
    price = await stripe.prices.create(
      {
        product: product.id,
        currency: pricing.currency,
        unit_amount: amount,
        tax_behavior: "exclusive",
        recurring: {
          interval: "year",
          interval_count: 1,
          usage_type: "licensed",
        },
        lookup_key: lookup,
        metadata: {
          lg_feature: "team_seats",
          lg_environment: manifest.environment,
          lg_discount: name,
        },
      },
      {
        idempotencyKey: `lg-team-seat-price-v1:${manifest.environment}:${name}`,
      }
    )
  if (
    price &&
    (!price.active ||
      price.livemode !== live ||
      price.product !== product?.id ||
      price.unit_amount !== amount ||
      price.currency !== "gbp" ||
      price.tax_behavior !== "exclusive" ||
      price.recurring?.interval !== "year" ||
      price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== "licensed")
  )
    throw new Error("Immutable Team seat price mismatch")
  manifest.prices[name] = price?.id ?? null
  const features = {
    customer_update: {
      enabled: true,
      allowed_updates: ["name", "email", "address", "tax_id"],
    },
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
      products:
        product && price
          ? [
              {
                product: product.id,
                prices: [price.id],
                adjustable_quantity: {
                  enabled: true,
                  minimum: 5,
                  maximum: 500,
                },
              },
            ]
          : [],
    },
  }
  const matches = portals.data.filter(
    (p) => p.metadata?.lg_team_portal === `v1_${name}`
  )
  if (matches.length > 1) throw new Error("Ambiguous Team Portal configuration")
  let portal = matches[0]
  if (!portal && product && price && apply)
    portal = await stripe.billingPortal.configurations.create(
      {
        business_profile: {
          headline: "Manage your Libraries Global Team",
          privacy_policy_url: `${origin}/legal/privacy`,
          terms_of_service_url: `${origin}/legal/membership`,
        },
        features,
        metadata: {
          lg_team_portal: `v1_${name}`,
          lg_environment: manifest.environment,
        },
      },
      { idempotencyKey: `lg-team-portal-v1:${manifest.environment}:${name}` }
    )
  if (portal) {
    portal = await stripe.billingPortal.configurations.retrieve(portal.id, {
      expand: ["features.subscription_update.products"],
    })
    const actual = portal.features.subscription_update
    if (
      portal.livemode !== live ||
      !portal.active ||
      !actual.enabled ||
      actual.proration_behavior !== "always_invoice" ||
      actual.default_allowed_updates.length !== 1 ||
      actual.default_allowed_updates[0] !== "quantity" ||
      actual.products?.length !== 1 ||
      actual.products[0].prices.length !== 1 ||
      actual.products[0].prices[0] !== price?.id ||
      actual.products[0].adjustable_quantity?.minimum !== 5 ||
      actual.products[0].adjustable_quantity.maximum !== 500 ||
      !actual.products[0].adjustable_quantity.enabled ||
      !actual.schedule_at_period_end.conditions.some(
        (c) => c.type === "decreasing_item_amount"
      ) ||
      !portal.features.subscription_cancel.enabled ||
      portal.features.subscription_cancel.mode !== "at_period_end" ||
      !portal.features.payment_method_update.enabled ||
      !portal.features.invoice_history.enabled
    )
      throw new Error("Team Portal controls mismatch")
  }
  manifest.portals[name] = portal?.id ?? null
}
const path = new URL(
  `./team-billing-${manifest.environment}-catalogue.json`,
  import.meta.url
)
if (apply) {
  // Ignore manifests containing account-specific catalogue identifiers.
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 })
} else {
  // No credential or customer data is included in the diagnostic output.
  console.log(
    JSON.stringify(
      {
        ...manifest,
        existingManifest: (() => {
          try {
            return Boolean(readFileSync(path, "utf8"))
          } catch {
            return false
          }
        })(),
      },
      null,
      2
    )
  )
}
console.log(
  apply
    ? "Team catalogue prepared; purchases remain unchanged."
    : "Team catalogue checked read-only."
)

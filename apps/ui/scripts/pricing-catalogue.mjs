/** Prepare immutable invoice/checkout prices. Never creates payments or enables purchases. */
import { readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

import Stripe from "stripe"

import { StripeMcpClient } from "./stripe-mcp.mjs"

import pricing from "../src/lib/membership-pricing.json" with { type: "json" }

const args = new Set(process.argv.slice(2))
const mode = args.has("--live") ? "live" : "sandbox"
const apply = args.has("--apply")
const client = new StripeMcpClient(mode)
await client.initialize()
const source = parseEnv(
  readFileSync(new URL("../../strapi/.env", import.meta.url), "utf8")
)
const verificationKey =
  mode === "live" ? source.STRIPE_SUBSCRIPTIONS_LIVE : source.STRIPE_SANDBOX
if (
  !verificationKey?.startsWith(mode === "live" ? "sk_live_" : "sk_test_") &&
  !verificationKey?.startsWith(mode === "live" ? "rk_live_" : "rk_test_")
)
  throw new Error("Matching read-verification key is required")
const verifier = new Stripe(verificationKey, {
  apiVersion: "2026-03-25.dahlia",
})
const account = await client.call("get_stripe_account_info")
if ((await verifier.accounts.retrieve()).id !== account.account_id)
  throw new Error(
    "MCP and verification credentials belong to different Stripe accounts"
  )
const read = (operation, parameters = {}) =>
  client.call("stripe_api_read", {
    stripe_api_operation_id: operation,
    parameters,
  })
const write = async (operation, parameters) => {
  let result
  try {
    result = await client.call("stripe_api_write", {
      stripe_api_operation_id: operation,
      parameters,
    })
  } catch (error) {
    if (error.privateResult)
      writeFileSync(
        new URL(
          `../../../.scratch/pricing-rollout/stripe-${mode}-error.json`,
          import.meta.url
        ),
        JSON.stringify({ operation, result: error.privateResult }, null, 2),
        { mode: 0o600 }
      )
    throw error
  }
  if (!result.id) throw new Error("Stripe did not confirm the catalogue write")

  return result
}
const list = async (operation) => {
  const rows = []
  let startingAfter
  for (let page = 0; page < 20; page++) {
    const result = await read(operation, {
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(result.data))
      throw new Error("Stripe list was incomplete")
    rows.push(...result.data)
    if (!result.has_more) return rows
    startingAfter = result.data.at(-1).id
  }
  throw new Error("Catalogue exceeds the bounded inspection limit")
}
const products = await list("GetProducts")
const prices = await list("GetPrices")
const coupons = await list("GetCoupons")
const portals = await list("GetBillingPortalConfigurations")
const choices = [
  {
    key: "supporter",
    id: "prod_lg_supporter_20261012",
    name: "Libraries Global Supporter",
    description:
      "Detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries per download, with optional profile recognition. Membership never grants community authority.",
    taxCode: "txcd_10103000",
    taxBehavior: "inclusive",
    amounts: pricing.supporter,
  },
  {
    key: "pro",
    id: "prod_lg_pro_20261012",
    name: "Libraries Global Pro",
    description:
      "Supporter digital tools, Atlas exports of up to 10,000 libraries and delivered population comparisons. Unfinished tools remain coming soon. Membership never grants community authority.",
    taxCode: "txcd_10103000",
    taxBehavior: "inclusive",
    amounts: pricing.pro.founding,
  },
  {
    key: "team",
    id: "prod_lg_team_20261013",
    name: "Libraries Global Team — five seats",
    description:
      "Annual Team membership for one library service or organisation, including five Pro seats and organiser controls for covered libraries. Team verification and library staff authority are assessed separately from payment.",
    taxCode: "txcd_10103001",
    taxBehavior: "exclusive",
    amounts: { year: pricing.team.year },
  },
  {
    key: "team_extra_seat",
    id: "prod_lg_team_seat_20261013",
    name: "Libraries Global Team — additional seat",
    description:
      "One additional annual Pro seat on an existing Team. Invoice quantity is the number of seats beyond the five included in the Team base membership.",
    taxCode: "txcd_10103001",
    taxBehavior: "exclusive",
    amounts: { year: pricing.team.extraSeatYear },
  },
  {
    key: "team_api",
    id: "prod_lg_team_api_20261013",
    name: "Libraries Global Team API",
    description:
      "Team API access to published public Library search and records, with shared monthly request and response-data limits.",
    taxCode: "txcd_10103001",
    taxBehavior: "inclusive",
    amounts: pricing.teamApi,
  },
]
const manifest = {
  environment: mode,
  pricingVersion: pricing.version,
  checkedAt: new Date().toISOString(),
  readOnly: !apply,
  enablesPurchases: false,
  teamFulfilment:
    "Reviewed annual invoice; admin creates/renews seats separately. No automatic Team activation.",
  proStandardAvailable: pricing.pro.standardAvailable,
  catalogue: [],
}
for (const choice of choices) {
  const matches = products.filter(
    (p) =>
      p.active &&
      (p.id === choice.id ||
        p.name === choice.name ||
        (choice.key === "team_api" && p.metadata?.lg_feature === "team_api"))
  )
  if (matches.length > 1) throw new Error(`Ambiguous ${choice.key} product`)
  let product = matches[0]
  if (!product && apply) {
    product = await write("PostProducts", {
      id: choice.id,
      name: choice.name,
      description: choice.description,
      active: true,
      tax_code: choice.taxCode,
      metadata: {
        lg_plan: choice.key,
        lg_environment: mode,
        lg_catalogue:
          choice.key === "pro" || choice.key === "supporter"
            ? "membership_v2"
            : "team_v1",
        ...(choice.key === "team_api" ? { lg_feature: "team_api" } : {}),
      },
    })
    products.push(product)
  }
  if (product) {
    const taxCode =
      typeof product.tax_code === "string"
        ? product.tax_code
        : product.tax_code?.id
    if (product.livemode !== (mode === "live") || taxCode !== choice.taxCode)
      throw new Error(`Review ${choice.key} product mode/tax classification`)
  }
  for (const [interval, amount] of Object.entries(choice.amounts)) {
    const lookup =
      choice.key === "pro" || choice.key === "supporter"
        ? `lg_${choice.key}${choice.key === "pro" ? "_founding" : ""}_${interval}_gbp_v2`
        : `lg_${choice.key}_${interval}_gbp_20261013`
    let price =
      product &&
      prices.find(
        (p) =>
          p.active &&
          p.product === product.id &&
          p.currency === pricing.currency &&
          p.unit_amount === amount &&
          p.tax_behavior === choice.taxBehavior &&
          p.recurring?.interval === interval &&
          p.recurring.interval_count === 1 &&
          p.recurring.usage_type === "licensed"
      )
    if (!price && product && apply) {
      if (prices.some((p) => p.lookup_key === lookup))
        throw new Error("Lookup key belongs to a different immutable price")
      price = await write("PostPrices", {
        product: product.id,
        active: true,
        currency: pricing.currency,
        unit_amount: amount,
        tax_behavior: choice.taxBehavior,
        recurring: { interval, interval_count: 1, usage_type: "licensed" },
        lookup_key: lookup,
        nickname: `${choice.key === "pro" ? "Founding Pro" : choice.name} · ${interval === "year" ? "yearly" : "monthly"}`,
        metadata: {
          lg_plan: choice.key,
          lg_environment: mode,
          lg_cohort: choice.key === "pro" ? "founding" : "standard",
          ...(choice.key === "team_api" ? { lg_feature: "team_api" } : {}),
        },
      })
      prices.push(price)
    }
    if (price && price.livemode !== (mode === "live"))
      throw new Error("Price mode mismatch")
    manifest.catalogue.push({
      plan: choice.key,
      interval,
      productId: product?.id ?? null,
      priceId: price?.id ?? null,
      amount,
      currency: pricing.currency,
      taxBehavior: choice.taxBehavior,
    })
  }
}
const teamProducts = manifest.catalogue
  .filter((p) => ["team", "team_extra_seat"].includes(p.plan))
  .map((p) => p.productId)
const couponId = "lg_public_library_service_20_v1"
let coupon = coupons.find((c) => c.id === couponId)
if (!coupon && apply && teamProducts.every(Boolean))
  coupon = await write("PostCoupons", {
    id: couponId,
    name: "Public library service — 20% Team",
    percent_off: pricing.team.publicServiceDiscountPercent,
    duration: "forever",
    applies_to: { products: teamProducts },
    metadata: { lg_discount: "public_library_service", lg_environment: mode },
  })
// Stripe omits the product restrictions unless they are explicitly expanded.
if (coupon)
  coupon = await verifier.coupons.retrieve(coupon.id, {
    expand: ["applies_to"],
  })
if (
  coupon &&
  (coupon.percent_off !== pricing.team.publicServiceDiscountPercent ||
    coupon.duration !== "forever" ||
    JSON.stringify([...(coupon.applies_to?.products ?? [])].sort()) !==
      JSON.stringify([...teamProducts].sort()))
)
  throw new Error(
    "Public-service discount has a different amount or product scope"
  )
manifest.publicServiceCoupon = coupon?.id ?? null
let portal = portals.find(
  (p) =>
    p.active &&
    (p.metadata?.lg_feature === "team_api" ||
      p.business_profile?.headline ===
        "Manage your Libraries Global Team API add-on") &&
    !p.features.subscription_update.enabled &&
    p.features.subscription_cancel.enabled &&
    p.features.subscription_cancel.mode === "at_period_end"
)
if (!portal && apply)
  portal = await write("PostBillingPortalConfigurations", {
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
  })
manifest.STRIPE_PORTAL_CONFIGURATION_TEAM_API = portal?.id ?? null
manifest.STRIPE_PRICE_TEAM_API_MONTHLY = manifest.catalogue.find(
  (p) => p.plan === "team_api"
).priceId
if (apply)
  writeFileSync(
    new URL(`./pricing-${mode}-catalogue.json`, import.meta.url),
    JSON.stringify(manifest, null, 2) + "\n"
  )
console.log(JSON.stringify(manifest, null, 2))
if (manifest.catalogue.some((p) => !p.priceId) || !coupon || !portal)
  process.exitCode = 1

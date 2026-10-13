/** Official Stripe MCP setup; read-only by default. Never enables live checkout. */
import { randomBytes } from "node:crypto"
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "node:fs"
import { parseEnv } from "node:util"

import Stripe from "stripe"

import { StripeMcpClient } from "./stripe-mcp.mjs"

import pricing from "../src/lib/membership-pricing.json" with { type: "json" }

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const value = (flag) => args[args.indexOf(flag) + 1]
const originArg = args.includes("--origin")
  ? value("--origin")
  : "https://libraries.global"
const url = new URL(originArg)
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw new Error("Supply the HTTPS production origin")
const origin = url.origin
if (apply && !args.includes("--sandbox-accepted"))
  throw new Error(
    "Complete both owned sandbox purchases before applying live setup"
  )
const manifestFile = new URL("./billing-live-catalogue.json", import.meta.url)
const secretFile = new URL(
  "../../../.scratch/billing-live.env",
  import.meta.url
)
const source = parseEnv(
  readFileSync(new URL("../../strapi/.env", import.meta.url), "utf8")
)
const runtimeKey = source.STRIPE_SUBSCRIPTIONS_LIVE
const previous = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : null
const privatePrevious = existsSync(secretFile)
  ? parseEnv(readFileSync(secretFile, "utf8"))
  : {}
const client = new StripeMcpClient("live")
await client.initialize()
const read = (op, parameters = {}) =>
  client.call("stripe_api_read", { stripe_api_operation_id: op, parameters })
const write = (op, parameters) =>
  client.call("stripe_api_write", { stripe_api_operation_id: op, parameters })
const listAll = async (op) => {
  const rows = []
  let starting_after
  for (let page = 0; page < 20; page++) {
    const result = await read(op, {
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    })
    if (!Array.isArray(result.data))
      throw new Error("Provider list response missing")
    rows.push(...result.data)
    if (!result.has_more) return rows
    starting_after = result.data.at(-1)?.id
  }
  throw new Error("Catalogue too large for this setup; inspect explicitly")
}
const productChoices = [
  {
    plan: "supporter",
    id: "prod_lg_supporter_20261012",
    name: "Libraries Global Supporter",
    description:
      "Detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries per download, with optional profile recognition. Membership never grants community authority.",
    amounts: pricing.supporter,
  },
  {
    plan: "pro",
    id: "prod_lg_pro_20261012",
    name: "Libraries Global Pro",
    description:
      "Supporter digital tools, Atlas exports of up to 10,000 libraries and delivered population comparisons. Unfinished tools remain coming soon. Membership never grants community authority.",
    amounts: pricing.pro.founding,
  },
]
const products = await listAll("GetProducts")
const prices = await listAll("GetPrices")
const portals = await listAll("GetBillingPortalConfigurations")
const endpoints = await listAll("GetWebhookEndpoints")
const info = await client.call("get_stripe_account_info")
const account = await read("GetAccountsAccount", { id: info.account_id })
const readiness = {
  chargesEnabled: account.charges_enabled === true,
  payoutsEnabled: account.payouts_enabled === true,
  detailsSubmitted: account.details_submitted === true,
}
console.log(
  JSON.stringify({
    mode: "live",
    apply,
    origin,
    existingProducts: products.length,
    existingWebhooks: endpoints.length,
    ...readiness,
  })
)
if (!apply) {
  console.log(
    "Read-only inspection complete. Planned: two digital products, four tax-inclusive recurring prices, three restricted portals and one deployed webhook."
  )
  process.exit(0)
}
if (!runtimeKey?.startsWith("sk_live_") && !runtimeKey?.startsWith("rk_live_"))
  throw new Error("Live runtime key missing")
const manifest = {
  environment: "live",
  apiVersion: "2026-03-25.dahlia",
  origin,
  preparedAt: new Date().toISOString(),
  readiness,
  catalogue: [],
  livePurchasesEnabled: false,
}
const saveManifest = () =>
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n")
for (const choice of productChoices) {
  let product = products.find((p) => p.id === choice.id)
  if (!product)
    product = await write("PostProducts", {
      id: choice.id,
      name: choice.name,
      description: choice.description,
      active: true,
      tax_code: "txcd_10103000",
      url: `${origin}/contribute/membership`,
      metadata: {
        lg_catalogue: "membership_v2",
        lg_environment: "live",
        lg_plan: choice.plan,
        lg_tools_version: "2026-10-12",
      },
    })
  if (
    !product.livemode ||
    product.name !== choice.name ||
    product.active !== true ||
    (typeof product.tax_code === "string"
      ? product.tax_code
      : product.tax_code?.id) !== "txcd_10103000"
  )
    throw new Error(
      "Existing product differs from the agreed catalogue; do not overwrite it"
    )
  for (const interval of ["month", "year"]) {
    const lookupKey = `lg_${choice.plan}${choice.plan === "pro" ? "_founding" : ""}_${interval}_gbp_v2`
    let price = prices.find((p) => p.lookup_key === lookupKey)
    if (!price)
      price = await write("PostPrices", {
        product: product.id,
        active: true,
        currency: "gbp",
        unit_amount: choice.amounts[interval],
        recurring: { interval, interval_count: 1 },
        tax_behavior: "inclusive",
        lookup_key: lookupKey,
        nickname: `${choice.plan === "pro" ? "Founding Pro" : "Supporter"} · ${interval === "year" ? "yearly" : "monthly"}`,
        metadata: {
          lg_catalogue: "membership_v2",
          lg_environment: "live",
          lg_plan: choice.plan,
          lg_interval: interval,
          lg_cohort: choice.plan === "pro" ? "founding" : "standard",
        },
      })
    if (
      !price.livemode ||
      !price.active ||
      price.product !== product.id ||
      price.unit_amount !== choice.amounts[interval] ||
      price.currency !== "gbp" ||
      price.tax_behavior !== "inclusive" ||
      price.recurring?.interval !== interval ||
      price.recurring?.interval_count !== 1
    )
      throw new Error("Existing price differs from the agreed immutable price")
    manifest.catalogue.push({
      plan: choice.plan,
      interval,
      productId: product.id,
      priceId: price.id,
      lookupKey,
      unitAmount: price.unit_amount,
      currency: "gbp",
      taxBehavior: "inclusive",
      taxCode: "txcd_10103000",
    })
    saveManifest()
  }
}
const portalProducts = (plan) => ({
  product: manifest.catalogue.find((p) => p.plan === plan).productId,
  prices: manifest.catalogue
    .filter((p) => p.plan === plan)
    .map((p) => p.priceId),
})
for (const kind of ["pro", "supporter", "recovery"]) {
  const headline =
    kind === "recovery"
      ? "Recover your Libraries Global membership"
      : `Manage your Libraries Global ${kind === "pro" ? "Pro" : "Supporter"} membership`
  const data = {
    name: `Libraries Global membership_v2 ${kind}`,
    business_profile: {
      headline,
      privacy_policy_url: `${origin}/legal/privacy`,
      terms_of_service_url: `${origin}/legal/membership`,
    },
    default_return_url: `${origin}/profile/settings#membership`,
    metadata: {
      lg_catalogue: "membership_v2",
      lg_environment: "live",
      lg_portal: kind,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["name", "email", "address"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
      },
      subscription_update:
        kind === "recovery"
          ? { enabled: false }
          : {
              enabled: true,
              default_allowed_updates: ["price"],
              products:
                kind === "pro"
                  ? [portalProducts("pro")]
                  : [portalProducts("supporter"), portalProducts("pro")],
              proration_behavior: "always_invoice",
              schedule_at_period_end: {
                conditions: [
                  { type: "decreasing_item_amount" },
                  { type: "shortening_interval" },
                ],
              },
            },
    },
  }
  let portal = portals.find(
    (p) =>
      p.id === previous?.[`${kind}PortalConfigurationId`] ||
      p.name === data.name
  )
  if (!portal) portal = await write("PostBillingPortalConfigurations", data)
  const verified = await read("GetBillingPortalConfigurationsConfiguration", {
    id: portal.id,
    expand: ["features.subscription_update.products"],
  })
  if (
    !verified.livemode ||
    !verified.active ||
    verified.features?.subscription_cancel?.mode !== "at_period_end" ||
    verified.features?.subscription_update?.enabled !== (kind !== "recovery")
  )
    throw new Error("Portal policy differs; inspect instead of overwriting")
  const actualPrices = (
    verified.features.subscription_update.products ?? []
  ).flatMap((p) => p.prices)
  const expectedPrices =
    kind === "recovery"
      ? []
      : manifest.catalogue
          .filter((p) => kind === "supporter" || p.plan === "pro")
          .map((p) => p.priceId)
  if (
    actualPrices.length !== expectedPrices.length ||
    expectedPrices.some((id) => !actualPrices.includes(id))
  )
    throw new Error("Portal price allowlist differs")
  manifest[`${kind}PortalConfigurationId`] = portal.id
  saveManifest()
}
const events = readFileSync(
  new URL("../src/lib/billing/events.ts", import.meta.url),
  "utf8"
)
  .match(/BILLING_EVENTS = new Set\(\[([\s\S]*?)\]\)/)?.[1]
  .match(/"([^"]+)"/g)
  ?.map((x) => x.slice(1, -1))
if (!events?.length) throw new Error("Billing event catalogue missing")
// Do not point a new enabled endpoint at an absent/beta-blocked deployment.
let deployed = false
let receiverConfigured = false
try {
  const legal = await fetch(`${origin}/legal/membership`, {
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  })
  const webhook = await fetch(`${origin}/api/billing/webhook`, {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  })
  const response = await webhook.json()
  receiverConfigured =
    webhook.status === 400 && response.error === "invalid_signature"
  deployed =
    legal.status === 200 &&
    (receiverConfigured ||
      (webhook.status === 503 && response.error === "webhook_unconfigured"))
} catch {
  /* Deployment readiness remains explicit. */
}
manifest.receiverHandlerReachable = deployed
manifest.deployedReceiverVerified = false
let signingSecret =
  previous?.origin === origin
    ? privatePrevious.STRIPE_WEBHOOK_SECRET
    : undefined
if (deployed) {
  let endpoint = endpoints.find(
    (e) => e.url === `${origin}/api/billing/webhook`
  )
  if (endpoint && previous?.webhookEndpointId !== endpoint.id)
    signingSecret = undefined
  if (!endpoint) {
    endpoint = await write("PostWebhookEndpoints", {
      url: `${origin}/api/billing/webhook`,
      api_version: manifest.apiVersion,
      enabled_events: events,
      description: "Libraries Global membership_v2 billing",
      metadata: { lg_catalogue: "membership_v2", lg_environment: "live" },
    })
    signingSecret = endpoint.secret?.startsWith("whsec_")
      ? endpoint.secret
      : undefined
  }
  if (
    !endpoint.livemode ||
    endpoint.api_version !== manifest.apiVersion ||
    endpoint.status !== "enabled" ||
    events.some((e) => !endpoint.enabled_events.includes(e))
  )
    throw new Error("Webhook policy differs; inspect instead of overwriting")
  manifest.webhookEndpointId = endpoint.id
  manifest.webhookSigningSecretStored = Boolean(signingSecret)
}
mkdirSync(new URL("../../../.scratch/", import.meta.url), { recursive: true })
const values = {
  BILLING_ENV: "live",
  PRO_ENABLED: "false",
  STRIPE_MANAGED_PAYMENTS_ENABLED: "false",
  STRIPE_SUPPORTER_APPROVED: "false",
  APP_PUBLIC_URL: origin,
  STRIPE_SECRET_KEY: runtimeKey,
  STRIPE_PORTAL_CONFIGURATION: manifest.proPortalConfigurationId,
  STRIPE_PORTAL_CONFIGURATION_SUPPORTER:
    manifest.supporterPortalConfigurationId,
  STRIPE_PORTAL_CONFIGURATION_RECOVERY: manifest.recoveryPortalConfigurationId,
  CRON_SECRET: privatePrevious.CRON_SECRET || randomBytes(32).toString("hex"),
  ...(signingSecret ? { STRIPE_WEBHOOK_SECRET: signingSecret } : {}),
}
for (const p of manifest.catalogue)
  values[
    `STRIPE_PRICE_${p.plan.toUpperCase()}_${p.interval === "month" ? "MONTHLY" : "ANNUAL"}`
  ] = p.priceId
writeFileSync(
  secretFile,
  Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
  { mode: 0o600 }
)
chmodSync(secretFile, 0o600)
if (args.includes("--verify-receiver") && deployed && signingSecret) {
  const payload = JSON.stringify({
    id: "evt_lg_configuration_probe",
    type: "billing.configuration_probe",
    livemode: true,
    data: { object: { id: "lg_configuration_probe" } },
  })
  const signature = new Stripe(runtimeKey, {
    apiVersion: manifest.apiVersion,
  }).webhooks.generateTestHeaderString({ payload, secret: signingSecret })
  const result = await fetch(`${origin}/api/billing/webhook`, {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    signal: AbortSignal.timeout(10000),
  })
  manifest.deployedReceiverVerified =
    result.status === 200 && (await result.json()).received === true
}
saveManifest()
console.log(
  JSON.stringify({
    productsPrepared: 2,
    pricesPrepared: 4,
    portalsPrepared: 3,
    receiverHandlerReachable: deployed,
    deployedReceiverVerified: manifest.deployedReceiverVerified,
    webhookPrepared: Boolean(manifest.webhookEndpointId),
    signingSecretStored: manifest.webhookSigningSecretStored === true,
    purchasesEnabled: false,
  })
)

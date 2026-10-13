import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import pg from "pg"
import Stripe from "stripe"

const nextRequire = createRequire(import.meta.resolve("next/package.json"))
nextRequire("@next/env").loadEnvConfig(
  fileURLToPath(new URL("..", import.meta.url))
)
const migrate = process.argv.includes("--migrate")
if (migrate) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  let client
  try {
    client = await pool.connect()
    await client.query("BEGIN")
    await client.query("select pg_advisory_xact_lock(76422012)")
    await client.query(
      await readFile(new URL("./billing-schema.sql", import.meta.url), "utf8")
    )
    await client.query(
      await readFile(new URL("./team-api-schema.sql", import.meta.url), "utf8")
    )
    await client.query("COMMIT")
    console.log("Billing schema is ready.")
  } catch {
    await client?.query("ROLLBACK").catch(() => {})
    throw new Error("Billing migration failed; no changes were committed.")
  } finally {
    client?.release()
    await pool.end()
  }
} else {
  const mode = process.env.BILLING_ENV === "live" ? "live" : "sandbox"
  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_ANNUAL",
    "STRAPI_BRIDGE_SECRET",
    "CRON_SECRET",
    "STRIPE_PORTAL_CONFIGURATION",
    "STRIPE_PORTAL_CONFIGURATION_SUPPORTER",
    "STRIPE_PORTAL_CONFIGURATION_RECOVERY",
    "STRIPE_PRICE_SUPPORTER_MONTHLY",
    "STRIPE_PRICE_SUPPORTER_ANNUAL",
  ]
  console.log(
    JSON.stringify(
      {
        mode,
        newPurchasesEnabled: process.env.PRO_ENABLED === "true",
        managedPaymentsConfirmed:
          process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === "true",
        supporterApproved: process.env.STRIPE_SUPPORTER_APPROVED === "true",
        variables: Object.fromEntries(
          required.map((key) => [key, process.env[key] ? "set" : "missing"])
        ),
      },
      null,
      2
    )
  )
  const key = process.env.STRIPE_SECRET_KEY
  if (required.some((name) => !process.env[name])) process.exitCode = 1
  const suffix = mode === "live" ? "live" : "test"
  if (key?.startsWith(`sk_${suffix}_`) || key?.startsWith(`rk_${suffix}_`)) {
    const stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" })
    for (const name of [
      "STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PRO_ANNUAL",
      "STRIPE_PRICE_SUPPORTER_MONTHLY",
      "STRIPE_PRICE_SUPPORTER_ANNUAL",
    ]) {
      const id = process.env[name]
      if (!id) continue
      try {
        const price = await stripe.prices.retrieve(id, { expand: ["product"] })
        const expectedAmount = name.includes("SUPPORTER")
          ? name.endsWith("ANNUAL")
            ? 3000
            : 300
          : name.endsWith("ANNUAL")
            ? 5000
            : 500
        if (
          !price.active ||
          price.livemode !== (mode === "live") ||
          price.currency !== "gbp" ||
          price.unit_amount !== expectedAmount ||
          price.recurring?.interval !==
            (name.endsWith("ANNUAL") ? "year" : "month") ||
          price.recurring.interval_count !== 1 ||
          price.tax_behavior !== "inclusive" ||
          typeof price.product === "string" ||
          price.product.deleted ||
          !price.product.active ||
          !price.product.tax_code
        )
          process.exitCode = 1
        console.log(
          name,
          JSON.stringify({
            active: price.active,
            modeMatches: price.livemode === (mode === "live"),
            interval: price.recurring?.interval,
            currency: price.currency,
            unitAmount: price.unit_amount,
            taxCodeSet:
              typeof price.product !== "string" &&
              !price.product.deleted &&
              Boolean(price.product.tax_code),
          })
        )
      } catch {
        console.log(name, "provider_check_failed")
        process.exitCode = 1
      }
    }
    console.log(
      "Catalogue read only. Dashboard eligibility and an actual Managed Payments sandbox purchase must still be verified."
    )
    for (const name of [
      "STRIPE_PORTAL_CONFIGURATION",
      "STRIPE_PORTAL_CONFIGURATION_SUPPORTER",
      "STRIPE_PORTAL_CONFIGURATION_RECOVERY",
    ]) {
      const id = process.env[name]
      if (!id) continue
      try {
        const config = await stripe.billingPortal.configurations.retrieve(id, {
          expand: ["features.subscription_update.products"],
        })
        const recovery = name.endsWith("RECOVERY")
        const products = config.features.subscription_update.products ?? []
        const expectedNames = name.endsWith("SUPPORTER")
          ? [
              "STRIPE_PRICE_PRO_MONTHLY",
              "STRIPE_PRICE_PRO_ANNUAL",
              "STRIPE_PRICE_SUPPORTER_MONTHLY",
              "STRIPE_PRICE_SUPPORTER_ANNUAL",
            ]
          : recovery
            ? []
            : ["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_ANNUAL"]
        const actual = products.flatMap((product) => product.prices)
        const valid =
          config.livemode === (mode === "live") &&
          config.active &&
          config.features.subscription_cancel.enabled &&
          config.features.subscription_cancel.mode === "at_period_end" &&
          config.features.payment_method_update.enabled &&
          config.features.invoice_history.enabled &&
          config.features.subscription_update.enabled === !recovery &&
          actual.length === expectedNames.length &&
          expectedNames.every((n) => actual.includes(process.env[n]))
        if (!valid) process.exitCode = 1
        console.log(
          name,
          JSON.stringify({
            modeMatches: config.livemode === (mode === "live"),
            catalogueAndControlsMatch: valid,
          })
        )
      } catch {
        process.exitCode = 1
        console.log(name, "provider_check_failed")
      }
    }
  } else process.exitCode = 1
}

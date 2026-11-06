/**
 * billing:migrate installs the shared billing and API ledger tables (fresh
 * install semantics; no row conversion). billing:check inspects the configured
 * API catalogue read-only. Neither command writes to Stripe.
 *
 *   node scripts/billing-setup.mjs --migrate [--drop-retired]
 *   node scripts/billing-setup.mjs
 *
 * `--drop-retired` additionally removes the tables of the billing flows
 * withdrawn in the November 2026 beta reset. Their sandbox rows are
 * disposable; nothing is converted.
 */
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import pg from "pg"
import Stripe from "stripe"

const nextRequire = createRequire(import.meta.resolve("next/package.json"))
nextRequire("@next/env").loadEnvConfig(
  fileURLToPath(new URL("..", import.meta.url))
)

const RETIRED_TABLES = [
  "billing_plan_changes",
  "billing_memberships",
  "billing_attempts",
  "billing_accounts",
  "team_billing_memberships",
  "team_billing_attempts",
  "team_billing_accounts",
  "team_billing_erasing_users",
  "team_api_requests",
  "team_api_usage",
  "team_api_keys",
  "team_api_memberships",
  "team_api_attempts",
  "team_api_audit",
  "team_api_accounts",
]

if (process.argv.includes("--migrate")) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  let client
  try {
    client = await pool.connect()
    await client.query("BEGIN")
    await client.query("select pg_advisory_xact_lock(76422012)")
    if (process.argv.includes("--drop-retired"))
      for (const table of RETIRED_TABLES)
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
    for (const file of ["./billing-schema.sql", "./api-schema.sql"])
      await client.query(await readFile(new URL(file, import.meta.url), "utf8"))
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
    "STRAPI_BRIDGE_SECRET",
    "CRON_SECRET",
    "STRIPE_PRICE_API_MONTHLY",
    "STRIPE_PORTAL_CONFIGURATION_API",
  ]
  const overage = [
    "STRIPE_PRICE_API_OVERAGE_REQUESTS",
    "STRIPE_PRICE_API_OVERAGE_BYTES",
    "STRIPE_PRICE_API_OVERAGE_CREDITS",
  ]
  console.log(
    JSON.stringify(
      {
        mode,
        newApiCheckoutEnabled: process.env.API_ENABLED === "true",
        overageOptInEnabled: process.env.API_OVERAGE_ENABLED === "true",
        managedPaymentsConfirmed:
          process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === "true",
        variables: Object.fromEntries(
          [...required, ...overage].map((key) => [
            key,
            process.env[key] ? "set" : "missing",
          ])
        ),
      },
      null,
      2
    )
  )
  if (required.some((name) => !process.env[name])) process.exitCode = 1
  const key = process.env.STRIPE_SECRET_KEY
  const suffix = mode === "live" ? "live" : "test"
  if (key?.startsWith(`sk_${suffix}_`) || key?.startsWith(`rk_${suffix}_`)) {
    const stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" })
    for (const name of ["STRIPE_PRICE_API_MONTHLY", ...overage]) {
      const id = process.env[name]
      if (!id) continue
      try {
        const price = await stripe.prices.retrieve(id, { expand: ["product"] })
        const base = name === "STRIPE_PRICE_API_MONTHLY"
        const valid =
          price.active &&
          price.livemode === (mode === "live") &&
          price.currency === "gbp" &&
          price.recurring?.interval === "month" &&
          price.recurring.interval_count === 1 &&
          price.recurring.usage_type === (base ? "licensed" : "metered") &&
          (base
            ? price.tax_behavior === "inclusive" && price.unit_amount === 10000
            : Boolean(price.recurring.meter)) &&
          typeof price.product !== "string" &&
          !price.product.deleted &&
          price.product.active &&
          Boolean(price.product.tax_code)
        if (!valid) process.exitCode = 1
        console.log(name, JSON.stringify({ valid }))
      } catch {
        console.log(name, "provider_check_failed")
        process.exitCode = 1
      }
    }
    console.log(
      "Catalogue read only. An owned Managed Payments sandbox purchase, overage invoice and reconciliation must still be verified."
    )
  } else process.exitCode = 1
}

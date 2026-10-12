import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { setTimeout } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const uiFile = new URL("../.env.local", import.meta.url)
const ui = parseEnv(readFileSync(uiFile, "utf8"))
const source = parseEnv(
  readFileSync(new URL("../../strapi/.env", import.meta.url), "utf8")
)
const catalogue = JSON.parse(
  readFileSync(
    new URL("./billing-sandbox-catalogue.json", import.meta.url),
    "utf8"
  )
)
const key = source.STRIPE_SANDBOX
if (
  catalogue.environment !== "sandbox" ||
  (!key?.startsWith("sk_test_") && !key?.startsWith("rk_test_"))
)
  throw new Error("Only a sandbox key and catalogue are accepted")
if (!catalogue.managedPaymentsProbe?.managedPaymentsAccepted)
  throw new Error("Verify sandbox Managed Payments support first")

function save(values) {
  let content = readFileSync(uiFile, "utf8")
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, "m")
    content = pattern.test(content)
      ? content.replace(pattern, `${name}=${value}`)
      : `${content.trimEnd()}\n${name}=${value}\n`
  }
  writeFileSync(uiFile, content, { mode: 0o600 })
  chmodSync(uiFile, 0o600)
}
if (process.argv.includes("--configure-local")) {
  const prices = Object.fromEntries(
    catalogue.catalogue.map((p) => [
      `STRIPE_PRICE_${p.plan.toUpperCase()}_${p.interval === "month" ? "MONTHLY" : "ANNUAL"}`,
      p.priceId,
    ])
  )
  save({
    ...prices,
    STRIPE_SECRET_KEY: key,
    BILLING_ENV: "sandbox",
    PRO_ENABLED: "true",
    STRIPE_MANAGED_PAYMENTS_ENABLED: "true",
    STRIPE_SUPPORTER_APPROVED: String(
      catalogue.supporterDigitalToolsConfigured === true
    ),
    STRIPE_PORTAL_CONFIGURATION: catalogue.portalConfigurationId,
    STRIPE_PORTAL_CONFIGURATION_SUPPORTER:
      catalogue.supporterPortalConfigurationId,
    STRIPE_PORTAL_CONFIGURATION_RECOVERY:
      catalogue.recoveryPortalConfigurationId,
    CRON_SECRET: ui.CRON_SECRET || randomBytes(32).toString("hex"),
  })
  console.log("Local sandbox catalogue and credentials configured privately.")
}
if (process.argv.includes("--work") || process.argv.includes("--watch")) {
  const watch = process.argv.includes("--watch")
  const origin =
    process.env.BILLING_LOCAL_ORIGIN ??
    ui.APP_PUBLIC_URL ??
    "http://localhost:3000"
  const url = new URL("/api/cron/billing", origin)
  if (
    ui.BILLING_ENV !== "sandbox" ||
    !ui.CRON_SECRET ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error(
      "Sandbox worker requires local configuration and a localhost origin"
    )
  const stop = new AbortController()
  if (watch) {
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => stop.abort())
    console.log(
      "Local sandbox worker running every 5 seconds. Ctrl-C stops it."
    )
  }
  let lastResult
  do {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${ui.CRON_SECRET}` },
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(60_000)]),
      })
      if (!response.ok)
        throw new Error(`Sandbox worker returned HTTP ${response.status}`)
      const data = await response.json()
      const result = JSON.stringify(
        Object.fromEntries(
          [
            "processed",
            "synced",
            "failed",
            "pendingEvents",
            "pendingProjections",
          ].map((name) => [name, data[name]])
        )
      )
      if (result !== lastResult) console.log(result)
      lastResult = result
    } catch (error) {
      if (stop.signal.aborted) break
      if (!watch) throw error
      console.error(
        "Local sandbox worker failed; retrying. Check the UI server and billing configuration."
      )
      lastResult = undefined
    }
    if (!watch) break
    await setTimeout(5000, undefined, { signal: stop.signal }).catch(() => {})
  } while (!stop.signal.aborted)
}
if (process.argv.includes("--listen")) {
  const runner = process.env.npm_execpath
  if (!runner || !path.isAbsolute(runner))
    throw new Error("Run through pnpm billing:sandbox:listen")
  const target =
    process.env.BILLING_FORWARD_URL ??
    new URL(
      "/api/billing/webhook",
      ui.APP_PUBLIC_URL ?? "http://localhost:3000"
    ).href
  const url = new URL(target)
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/api/billing/webhook"
  )
    throw new Error("Sandbox forwarding must use the local billing webhook")
  const events = readFileSync(
    new URL("../src/lib/billing/events.ts", import.meta.url),
    "utf8"
  )
    .match(/BILLING_EVENTS = new Set\(\[([\s\S]*?)\]\)/)?.[1]
    .match(/"([\w.]+)"/g)
    ?.map((v) => v.slice(1, -1))
  if (!events?.length) throw new Error("Billing event list unavailable")
  const listener = spawn(
    process.execPath,
    [
      runner,
      "dlx",
      "@stripe/cli",
      "listen",
      "--skip-update",
      "--events",
      events.join(","),
      "--forward-to",
      target,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, STRIPE_API_KEY: key },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  let ready = false
  const output = (chunk) => {
    const value = String(chunk)
    const secret = value.match(/whsec_[\da-z]+/i)?.[0]
    if (secret && !ready) {
      save({ STRIPE_WEBHOOK_SECRET: secret })
      ready = true
      console.log(
        `Sandbox listener ready at ${url.origin}${url.pathname}. Local signing secret saved privately; restart the UI server if it has not reloaded the updated environment.`
      )
    }
    const status = value.match(/\[(\d{3})\].*POST/)?.[1]
    if (status) console.log(`Sandbox webhook delivery HTTP ${status}`)
  }
  listener.stdout.on("data", output)
  listener.stderr.on("data", output)
  listener.on("error", () => {
    console.error("Sandbox listener could not start")
    process.exitCode = 1
  })
  listener.on("exit", (code) => {
    if (!ready) console.error("Sandbox listener stopped before readiness")
    process.exitCode = code ?? 1
  })
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => listener.kill(signal))
}
if (
  !process.argv.includes("--configure-local") &&
  !process.argv.includes("--work") &&
  !process.argv.includes("--watch") &&
  !process.argv.includes("--listen")
)
  throw new Error("Choose --configure-local, --listen, --work or --watch")

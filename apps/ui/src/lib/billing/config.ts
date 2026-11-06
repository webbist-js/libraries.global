import "server-only"

export const STRIPE_API_VERSION = "2026-03-25.dahlia" as const

export class BillingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 503
  ) {
    super(code)
  }
}

/**
 * Shared Stripe binding. The API subscription is the only product. Webhook
 * signature checks, the billing worker and maintenance jobs use this
 * configuration.
 */
export function billingConfig() {
  const mode: "live" | "sandbox" =
    process.env.BILLING_ENV === "live" ? "live" : "sandbox"
  const key = process.env.STRIPE_SECRET_KEY
  const suffix = mode === "live" ? "live" : "test"
  const keyMatches = Boolean(
    key?.startsWith(`sk_${suffix}_`) || key?.startsWith(`rk_${suffix}_`)
  )

  return {
    mode,
    key,
    configured: keyMatches,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    origin: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  }
}

import "server-only"

export { MEMBERSHIP_TERMS_VERSION } from "./constants"
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
 * Shared Stripe binding. Personal Supporter/Pro and Team seat purchases were
 * retired in the November 2026 beta reset; the API subscription is the only
 * product. Webhook signature checks, the billing worker and maintenance jobs
 * use this configuration.
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
    /**
     * @deprecated Personal membership purchases are retired; always false.
     * TODO(marketing): remove with the membership page rewrite.
     */
    enabled: false,
    /** @deprecated Retired with personal Supporter purchases; always false. */
    supporterApproved: false,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    origin: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
  }
}

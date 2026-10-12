import "server-only"

export { MEMBERSHIP_TERMS_VERSION } from "./constants"
export const STRIPE_API_VERSION = "2026-03-25.dahlia" as const
export type PurchasePlan = "supporter" | "pro"
export type PurchaseInterval = "month" | "year"

export class BillingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 503
  ) {
    super(code)
  }
}

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
    enabled:
      process.env.PRO_ENABLED === "true" &&
      process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === "true" &&
      keyMatches,
    supporterApproved: process.env.STRIPE_SUPPORTER_APPROVED === "true",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    portalConfiguration: process.env.STRIPE_PORTAL_CONFIGURATION,
    origin: process.env.APP_PUBLIC_URL ?? "http://localhost:3000",
    prices: {
      pro: {
        month: process.env.STRIPE_PRICE_PRO_MONTHLY,
        year: process.env.STRIPE_PRICE_PRO_ANNUAL,
      },
      supporter: {
        month: process.env.STRIPE_PRICE_SUPPORTER_MONTHLY,
        year: process.env.STRIPE_PRICE_SUPPORTER_ANNUAL,
      },
    },
  }
}

export function configuredPrice(
  plan: PurchasePlan,
  interval: PurchaseInterval
) {
  const config = billingConfig()
  if (!config.enabled) throw new BillingError("billing_unavailable")
  if (plan === "supporter" && !config.supporterApproved)
    throw new BillingError("supporter_pending_approval", 409)
  const id = config.prices[plan][interval]
  if (!id?.startsWith("price_")) throw new BillingError("price_unavailable")

  return id
}

/** Current purchase catalogue. Settled snapshots preserve retired founding prices. */
export function planForPrice(id: string) {
  const prices = billingConfig().prices
  for (const plan of ["pro", "supporter"] as const)
    for (const interval of ["month", "year"] as const)
      if (prices[plan][interval] === id) return { plan, interval }

  return null
}

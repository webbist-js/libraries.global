import "server-only"

import Stripe from "stripe"

import { billingConfig, BillingError, STRIPE_API_VERSION } from "./config"

export function billingStripe(
  options: { timeout?: number; maxNetworkRetries?: number } = {}
) {
  const config = billingConfig()
  if (!config.configured || !config.key)
    throw new BillingError("billing_unavailable")

  return new Stripe(config.key, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: options.maxNetworkRetries ?? 2,
    timeout: options.timeout ?? 10_000,
  })
}

/** Managed Payments is documented by Stripe but omitted from SDK 22's types. */
export type ManagedCheckoutParams = NonNullable<
  Parameters<Stripe["checkout"]["sessions"]["create"]>[0]
> & {
  managed_payments: { enabled: true }
}

export function isManagedCheckout(session: Stripe.Checkout.Session): boolean {
  const managed = (
    session as Stripe.Checkout.Session & {
      managed_payments?: { enabled?: boolean }
    }
  ).managed_payments

  return managed?.enabled === true
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null)
}

export function providerUrl(value: string | null, hosts: readonly string[]) {
  if (!value) throw new BillingError("provider_url_missing")
  const url = new URL(value)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !hosts.includes(url.hostname)
  )
    throw new BillingError("provider_url_invalid")

  return value
}

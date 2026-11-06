import "server-only"

import { billingConfig } from "@/lib/billing/config"

import {
  API_INCLUDED,
  API_OFFER_VERSION,
  API_RATES,
  API_TERMS_VERSION,
} from "./constants"
import { membershipCovered } from "./period"
import type {
  ApiDimension,
  ApiLimits,
  ApiMembership,
  ApiOffer,
  ApiOverageRates,
} from "./types"

export { API_TERMS_VERSION, API_OVERAGE_TERMS_VERSION } from "./constants"

/** The £100 offer's limits. Saved with each purchase; never read back from env. */
export const API_OFFER_LIMITS: ApiLimits = {
  requests: API_INCLUDED.requests,
  bytes: API_INCLUDED.bytes,
  analysisCredits: API_INCLUDED.analysisCredits,
  perMinute: 30,
  concurrency: 2,
  responseBytes: 131_072,
  pageSize: 50,
  keys: null,
}
export const API_OFFER_RATES: ApiOverageRates = { ...API_RATES }

/** Stripe Billing Meter event names, created by `api:setup`. */
export const API_METER_EVENTS: Record<ApiDimension, string> = {
  requests: "lg_api_overage_requests",
  bytes: "lg_api_overage_kib",
  credits: "lg_api_overage_credits",
}

const flag = (name: string) => process.env[name] === "true"

export function apiConfig() {
  const billing = billingConfig()
  const overagePrices: Partial<Record<ApiDimension, string>> = {}
  for (const [dimension, name] of [
    ["requests", "STRIPE_PRICE_API_OVERAGE_REQUESTS"],
    ["bytes", "STRIPE_PRICE_API_OVERAGE_BYTES"],
    ["credits", "STRIPE_PRICE_API_OVERAGE_CREDITS"],
  ] as const) {
    const id = process.env[name]
    if (id?.startsWith("price_")) overagePrices[dimension] = id
  }
  const priceId = process.env.STRIPE_PRICE_API_MONTHLY

  return {
    limits: API_OFFER_LIMITS,
    rates: API_OFFER_RATES,
    priceId,
    overagePrices,
    portalId: process.env.STRIPE_PORTAL_CONFIGURATION_API,
    /** `API_ENABLED` gates new checkout only; renewals and recovery continue. */
    purchasing:
      flag("API_ENABLED") &&
      billing.configured &&
      flag("STRIPE_MANAGED_PAYMENTS_ENABLED") &&
      Boolean(priceId?.startsWith("price_")),
    /** `API_OVERAGE_ENABLED` gates new opt-ins; never bypasses the cap. */
    overage: flag("API_OVERAGE_ENABLED") && billing.configured,
    mode: billing.mode,
    origin: billing.origin,
  }
}

/** The snapshot recorded with a new checkout attempt. */
export function apiOffer(priceId: string): ApiOffer {
  const config = apiConfig()

  return {
    offerVersion: API_OFFER_VERSION,
    priceId,
    taxBehavior: "inclusive",
    limits: { ...config.limits },
    overageRates: { ...config.rates },
    overagePrices: { ...config.overagePrices },
    consentVersion: API_TERMS_VERSION,
  }
}

export function apiAccessActive(
  membership: ApiMembership | null,
  now = new Date()
): membership is ApiMembership {
  return membershipCovered(membership, apiConfig().mode, now)
}

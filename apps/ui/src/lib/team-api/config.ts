import "server-only"

import { BillingError, billingConfig } from "@/lib/billing/config"

import type { ApiLimits, ApiMembership } from "./types"

export const API_TERMS_VERSION = "1.1"

function integer(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1 || n > maximum)
    throw new BillingError("api_configuration_invalid")

  return n
}

export function apiConfig() {
  const billing = billingConfig()
  const limits: ApiLimits = {
    requests: integer(
      process.env.TEAM_API_MONTHLY_REQUESTS,
      100_000,
      10_000_000
    ),
    bytes: integer(
      process.env.TEAM_API_MONTHLY_BYTES,
      10 * 1024 ** 3,
      1024 ** 4
    ),
    perMinute: integer(process.env.TEAM_API_REQUESTS_PER_MINUTE, 60, 10_000),
    concurrency: integer(process.env.TEAM_API_CONCURRENCY, 5, 100),
    keys: integer(process.env.TEAM_API_MAX_KEYS, 5, 50),
    responseBytes: integer(
      process.env.TEAM_API_RESPONSE_BYTES,
      256 * 1024,
      1024 * 1024
    ),
  }

  return {
    limits,
    priceId: process.env.STRIPE_PRICE_TEAM_API_MONTHLY,
    portalId: process.env.STRIPE_PORTAL_CONFIGURATION_TEAM_API,
    purchasing:
      process.env.TEAM_API_ENABLED === "true" &&
      billing.configured &&
      process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === "true" &&
      Boolean(process.env.STRIPE_PRICE_TEAM_API_MONTHLY),
    mode: billing.mode,
    origin: billing.origin,
  }
}

export function apiAccessActive(
  membership: ApiMembership | null,
  now = new Date()
) {
  return Boolean(
    membership &&
    membership.mode === apiConfig().mode &&
    !membership.revoked &&
    membership.paidThrough &&
    Date.parse(membership.paidThrough) > now.getTime() &&
    ["active", "past_due", "canceled"].includes(membership.status)
  )
}

export function apiMonth(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

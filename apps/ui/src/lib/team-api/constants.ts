/**
 * The API offer, shared by the checkout form and the server. Safe to import in
 * client components. A purchase snapshots these values (see `ApiOffer`); later
 * changes here or in the environment never alter a settled subscription.
 */
import pricing from "@/lib/membership-pricing.json"

/** Consent version for the £100 API purchase terms. */
export const API_TERMS_VERSION = "2.0"
/** Consent version for opting into capped overage. */
export const API_OVERAGE_TERMS_VERSION = "2.0"
/** Offer identifier recorded in every new purchase snapshot. */
export const API_OFFER_VERSION = pricing.version

export const API_SCOPES = [
  "search:read",
  "libraries:read",
  "services:read",
  "analysis:run",
  "submissions:write",
] as const
/** New keys get these unless write/analysis scopes are explicitly confirmed. */
export const API_READ_SCOPES = [
  "search:read",
  "libraries:read",
  "services:read",
] as const
/** Scopes that spend analysis credits or create proposals. */
export const API_CONFIRMED_SCOPES = [
  "analysis:run",
  "submissions:write",
] as const

export type ApiDimension = "requests" | "bytes" | "credits"
export const API_DIMENSIONS: readonly ApiDimension[] = [
  "requests",
  "bytes",
  "credits",
]

export const API_INCLUDED = {
  requests: pricing.api.included.requests,
  bytes: pricing.api.included.bytes,
  analysisCredits: pricing.api.included.analysisCredits,
} as const
export const API_RATES = {
  requestPence: pricing.api.overage.requestPence,
  mibPence: pricing.api.overage.mibPence,
  creditPence: pricing.api.overage.creditPence,
} as const
export const API_MONTHLY_PENCE = pricing.api.month

/** Organiser-selected monthly overage cap, in pence before tax. */
export const OVERAGE_CAP_MIN_PENCE = pricing.api.overage.capMinPence
export const OVERAGE_CAP_MAX_PENCE = pricing.api.overage.capMaxPence
export const OVERAGE_CAP_STEP_PENCE = pricing.api.overage.capStepPence
/** Preselected in the UI; never enabled without an affirmative action. */
export const OVERAGE_CAP_DEFAULT_PENCE = pricing.api.overage.capDefaultPence

export function validOverageCap(pence: unknown): pence is number {
  return (
    typeof pence === "number" &&
    Number.isSafeInteger(pence) &&
    pence >= OVERAGE_CAP_MIN_PENCE &&
    pence <= OVERAGE_CAP_MAX_PENCE &&
    pence % OVERAGE_CAP_STEP_PENCE === 0
  )
}

/** Warning thresholds for each allowance and for the overage cap. */
export const API_WARNING_THRESHOLDS = [50, 80, 100] as const

import type { API_SCOPES, ApiDimension } from "./constants"

export {
  API_SCOPES,
  API_READ_SCOPES,
  API_CONFIRMED_SCOPES,
  type ApiDimension,
} from "./constants"

export type ApiScope = (typeof API_SCOPES)[number]

/** Per billing period, pooled across every key of one API account. */
export type ApiLimits = {
  requests: number
  /** Uncompressed UTF-8 JSON response bytes. */
  bytes: number
  analysisCredits: number
  /** Attempts per minute, across the account and per key. */
  perMinute: number
  concurrency: number
  /** Largest single response body. */
  responseBytes: number
  /** Most records in one list page. */
  pageSize: number
  /** null means unlimited credentials. */
  keys: number | null
}

/** Overage prices before tax, in pence. */
export type ApiOverageRates = {
  requestPence: number
  mibPence: number
  creditPence: number
}

/** Immutable purchase terms, saved with the checkout attempt and subscription. */
export type ApiOffer = {
  offerVersion: string
  priceId: string
  taxBehavior: "inclusive"
  limits: ApiLimits
  overageRates: ApiOverageRates
  /** Metered overage Prices configured at checkout, by dimension. */
  overagePrices: Partial<Record<ApiDimension, string>>
  consentVersion: string
}

/** `[start, end)` of the settled Stripe subscription item period, UTC ISO. */
export type ApiPeriod = { start: string; end: string }

export type ApiMembership = {
  mode: "sandbox" | "live"
  status: string
  priceId: string
  currency: string
  unitAmount: number
  /** End of the latest settled period. Read by the session `apiAccounts`. */
  paidThrough: string | null
  /** Latest settled period; quotas reset only when a new period is paid. */
  period: ApiPeriod | null
  /** First settled API access, retained across renewals. */
  startedAt: string | null
  cancelAtPeriodEnd: boolean
  /** Refund or dispute hold. Read by the session `apiAccounts`. */
  revoked: boolean
  offer: ApiOffer
  /** Subscription items for the offer's metered overage Prices. */
  overageItems: Partial<Record<ApiDimension, string>>
  /** Compatibility alias for `offer.limits`. */
  limits: ApiLimits
}

export type ApiOverageSettings = {
  enabled: boolean
  capPence: number
  revision: number
  updatedAt: string | null
}

export type ApiKeyView = {
  id: string
  name: string
  prefix: string
  scopes: ApiScope[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  requests: number
  bytes: number
}

export type ApiWarning = {
  dimension: ApiDimension | "cap"
  threshold: 50 | 80 | 100
}

export type ApiUsageTotals = {
  requests: number
  bytes: number
  credits: number
}

export type ApiDashboard = {
  teamId: string
  teamName: string
  organiser: boolean
  teamActive: boolean
  membership: ApiMembership | null
  active: boolean
  purchasing: boolean
  overageAvailable: boolean
  price: { unitAmount: number; currency: string } | null
  limits: ApiLimits
  rates: ApiOverageRates
  overage: ApiOverageSettings
  /** Settled plus in-flight usage in the current paid period. */
  usage: ApiUsageTotals & {
    resetsAt: string | null
    periodStart: string | null
  }
  /** Overage accrued this period, pence before tax, each line rounded. */
  accrued: {
    requestsPence: number
    bytesPence: number
    creditsPence: number
    totalPence: number
  }
  /** Next invoice estimate: renewal (tax-inclusive) plus accrued overage. */
  projectedInvoicePence: number | null
  keyPage?: { offset: number; hasMore: boolean; activeCount: number }
  keys: ApiKeyView[]
  days: { day: string; requests: number; bytes: number; errors: number }[]
  endpoints: {
    endpoint: string
    requests: number
    bytes: number
    errors: number
  }[]
  warnings: ApiWarning[]
  pendingPayment: boolean
}

/** Shown to a signed-in account without an organisation. */
export type ApiProspect = {
  purchasing: boolean
  price: { unitAmount: number; currency: string } | null
  limits: ApiLimits
  rates: ApiOverageRates
  verified: boolean
}

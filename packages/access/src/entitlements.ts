import { type Recognition, recognitionOf } from "./recognition"

/**
 * Entitlements: the tools and limits an account may use. They come from
 * independent facts, never a ranked plan:
 *
 * - `explorer`: any signed-in account (free).
 * - `contributor` / `supporter`: earned recognition from accepted contributions.
 * - `apiCustomer`: organiser of an API account with settled paid coverage.
 *
 * Verified staff tools are capabilities (`canStaff`), not entitlements:
 * authority comes from roles and library affiliations, and payment,
 * sponsorship or recognition never grants it.
 */
export type AccessFact =
  | "explorer"
  | "contributor"
  | "supporter"
  | "apiCustomer"

/** Display label for the account's free standing. */
export type AccessStanding = "public" | "explorer" | Recognition

export type Feature =
  | "atlas.contextLayers"
  | "atlas.analysis"
  | "atlas.export"
  | "atlas.compare"
  /** One-library Reach (Contributor allowance or API customer bonus). */
  | "atlas.reach"
  /** Service and network Reach (API customer bonus only). */
  | "atlas.serviceReach"
  | "index.export"
  | "index.alerts"
  | "index.compare"
  | "library.watch"
  | "library.notes"
  | "library.history"
  | "data.benchmark"
  | "data.explorerExport"
  | "events.personalFeed"
  /** Create and manage machine API keys for an API account. */
  | "api.key"

export type Limit =
  | "savedViews"
  | "savedSearches"
  | "exportRows"
  | "exportsPerDay"
  /** New one-library Reach calculations per rolling seven days. */
  | "reachRunsPerWeek"
  /** New Reach calculations per hour (API customer bonus). */
  | "analysisRunsPerHour"
  /** Pooled new browser Reach calculations per API customer per day. */
  | "analysisRunsPerDay"
  /** 0 = no Reach; 1 = the standard geographic envelopes. */
  | "analysisAreaMultiplier"
  /** Most eligible libraries in a service Reach calculation. */
  | "analysisServiceLibraries"

export interface Entitlements {
  signedIn: boolean
  standing: AccessStanding
  facts: ReadonlySet<AccessFact>
  features: ReadonlySet<Feature>
  limits: Readonly<Record<Limit, number>>
}

/** An API account the user belongs to, as the session bridge sends it. */
export interface ApiAccountInput {
  /** Organisers manage billing and keys and receive the browser Reach bonus. */
  role: "organiser" | "member"
  /** End of settled paid coverage; null or past means no coverage. */
  paidThrough: string | null
  revoked?: boolean
}

export interface EntitlementInput {
  signedIn: boolean
  now: Date
  /** Distinct accepted, substantive contributions. */
  acceptedContributions?: number | null
  recognitionRevoked?: boolean | null
  /** API accounts the user belongs to. */
  apiAccounts?: ApiAccountInput[]
}

export const EXPLORER_FEATURES: readonly Feature[] = [
  "atlas.contextLayers",
  "atlas.analysis",
  "atlas.export",
  "atlas.compare",
  "index.export",
  "index.alerts",
  "index.compare",
  "library.watch",
  "library.notes",
  "library.history",
  "data.benchmark",
  "data.explorerExport",
  "events.personalFeed",
]
export const CONTRIBUTOR_FEATURES: readonly Feature[] = ["atlas.reach"]
export const API_CUSTOMER_FEATURES: readonly Feature[] = [
  "api.key",
  "atlas.reach",
  "atlas.serviceReach",
]
export const FEATURES: readonly Feature[] = [
  ...EXPLORER_FEATURES,
  "atlas.reach",
  "atlas.serviceReach",
  "api.key",
]

const NO_LIMITS: Record<Limit, number> = {
  savedViews: 0,
  savedSearches: 0,
  exportRows: 0,
  exportsPerDay: 0,
  reachRunsPerWeek: 0,
  analysisRunsPerHour: 0,
  analysisRunsPerDay: 0,
  analysisAreaMultiplier: 0,
  analysisServiceLibraries: 0,
}

/** Fair-use limits for every signed-in account. */
export const EXPLORER_LIMITS: Readonly<Record<Limit, number>> = {
  ...NO_LIMITS,
  savedViews: 1000,
  savedSearches: 1000,
  exportRows: 10_000,
  exportsPerDay: 20,
}

/** Contributor Reach: two new one-library calculations per rolling week. */
export const CONTRIBUTOR_REACH_PER_WEEK = 2
/** API customer browser Reach bonus. */
export const API_REACH_PER_HOUR = 20
export const API_REACH_PER_DAY = 100
export const API_REACH_SERVICE_LIBRARIES = 50

const notExpired = (iso: string | null | undefined, now: Date) =>
  typeof iso === "string" && Date.parse(iso) > now.getTime()

export function hasApiCoverage(
  accounts: ApiAccountInput[] | undefined,
  now: Date,
  role?: ApiAccountInput["role"]
): boolean {
  return (accounts ?? []).some(
    (a) =>
      !a.revoked &&
      (role === undefined || a.role === role) &&
      notExpired(a.paidThrough, now)
  )
}

export function resolveEntitlements(i: EntitlementInput): Entitlements {
  if (!i.signedIn)
    return {
      signedIn: false,
      standing: "public",
      facts: new Set(),
      features: new Set(),
      limits: { ...NO_LIMITS },
    }

  const facts = new Set<AccessFact>(["explorer"])
  const features = new Set<Feature>(EXPLORER_FEATURES)
  const limits: Record<Limit, number> = { ...EXPLORER_LIMITS }
  const recognition = recognitionOf(i)
  if (recognition !== "none") {
    facts.add("contributor")
    if (recognition === "supporter") facts.add("supporter")
    for (const f of CONTRIBUTOR_FEATURES) features.add(f)
    limits.reachRunsPerWeek = CONTRIBUTOR_REACH_PER_WEEK
    limits.analysisAreaMultiplier = 1
  }
  // The browser bonus is personal to organisers of a covered API account;
  // other members of the customer's organisation do not inherit it.
  if (hasApiCoverage(i.apiAccounts, i.now, "organiser")) {
    facts.add("apiCustomer")
    for (const f of API_CUSTOMER_FEATURES) features.add(f)
    limits.analysisRunsPerHour = API_REACH_PER_HOUR
    limits.analysisRunsPerDay = API_REACH_PER_DAY
    limits.analysisAreaMultiplier = 1
    limits.analysisServiceLibraries = API_REACH_SERVICE_LIBRARIES
  }

  return {
    signedIn: true,
    standing: recognition === "none" ? "explorer" : recognition,
    facts,
    features,
    limits,
  }
}

export const can = (e: Entitlements, f: Feature): boolean => e.features.has(f)
export const has = (e: Entitlements, f: AccessFact): boolean => e.facts.has(f)
export const limitOf = (e: Entitlements, l: Limit): number => e.limits[l]

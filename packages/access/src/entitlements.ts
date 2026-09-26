import { TIER_NAMES } from "./limits"

export type PlanKey = "public" | "free" | "pro" | "team"
export type PlanSource = "none" | "paid" | "grant" | "verified" | "earned"
export type Feature =
  | "atlas.contextLayers"
  | "atlas.analysis"
  | "atlas.export"
  | "atlas.compare"
  | "index.export"
  | "index.alerts"
  | "index.compare"
  | "library.watch"
  | "library.notes"
  | "catalogue.editions"
  | "data.benchmark"
  | "data.explorerExport"
  | "events.personalFeed"
  | "team.workspace"
  | "team.bulkUpload"
  | "team.embed"
  | "api.key"
export type Limit =
  | "savedViews"
  | "savedSearches"
  | "catalogueChecksPerHour"
  | "exportRows"

export interface Entitlements {
  plan: PlanKey
  source: PlanSource
  features: ReadonlySet<Feature>
  limits: Readonly<Record<Limit, number>>
}

export interface EntitlementInput {
  signedIn: boolean
  now: Date
  /** Better Auth `subscription` row (P-D). */
  subscription?: {
    plan: string
    status: string
    periodEnd?: string | null
    pastDueSince?: string | null
  } | null
  /** Strapi `entitlement-grant` rows (P-D). */
  grants?: { plan: "pro" | "team"; expiresAt: string | null }[]
  /** Free-Pro verifications (C5, P-D). */
  verifications?: { expiresAt: string | null }[]
  rewardsTier?: string | null
  /** End of the 90-day hold after dropping below Archivist. */
  earnedProUntil?: string | null
}

const PRO_FEATURES: readonly Feature[] = [
  "atlas.contextLayers",
  "atlas.analysis",
  "atlas.export",
  "atlas.compare",
  "index.export",
  "index.alerts",
  "index.compare",
  "library.watch",
  "library.notes",
  "catalogue.editions",
  "data.benchmark",
  "data.explorerExport",
  "events.personalFeed",
]
const TEAM_FEATURES: readonly Feature[] = [
  ...PRO_FEATURES,
  "team.workspace",
  "team.bulkUpload",
  "team.embed",
  "api.key",
]

export const FEATURES: readonly Feature[] = TEAM_FEATURES

const PLAN_FEATURES: Record<PlanKey, readonly Feature[]> = {
  public: [],
  free: [],
  pro: PRO_FEATURES,
  team: TEAM_FEATURES,
}

const PLAN_LIMITS: Record<PlanKey, Record<Limit, number>> = {
  public: {
    savedViews: 0,
    savedSearches: 0,
    catalogueChecksPerHour: 10,
    exportRows: 0,
  },
  free: {
    savedViews: 3,
    savedSearches: 3,
    catalogueChecksPerHour: 30,
    exportRows: 0,
  },
  pro: {
    savedViews: 1000,
    savedSearches: 1000,
    catalogueChecksPerHour: 300,
    exportRows: 10_000,
  },
  team: {
    savedViews: 1000,
    savedSearches: 1000,
    catalogueChecksPerHour: 600,
    exportRows: 50_000,
  },
}

const PAST_DUE_GRACE_MS = 7 * 86_400_000
const EARNED_PRO_TIERS: ReadonlySet<string> = new Set(
  TIER_NAMES.slice(TIER_NAMES.indexOf("Archivist"))
)
const PLAN_RANK: Record<PlanKey, number> = {
  public: 0,
  free: 1,
  pro: 2,
  team: 3,
}
// At equal plan, the earlier source wins.
const SOURCE_ORDER: readonly PlanSource[] = [
  "paid",
  "grant",
  "verified",
  "earned",
]

const notExpired = (iso: string | null | undefined, now: Date) =>
  iso === null || (iso !== undefined && Date.parse(iso) > now.getTime())

function paidPlan(
  s: EntitlementInput["subscription"],
  now: Date
): PlanKey | null {
  if (!s || (s.plan !== "pro" && s.plan !== "team")) return null
  const plan = s.plan
  switch (s.status) {
    case "active":
    case "trialing":
      return plan
    case "past_due":
      return s.pastDueSince &&
        now.getTime() - Date.parse(s.pastDueSince) <= PAST_DUE_GRACE_MS
        ? plan
        : null
    case "canceled":
      return s.periodEnd && Date.parse(s.periodEnd) > now.getTime()
        ? plan
        : null

    default:
      return null
  }
}

function build(plan: PlanKey, source: PlanSource): Entitlements {
  return {
    plan,
    source,
    features: new Set(PLAN_FEATURES[plan]),
    limits: { ...PLAN_LIMITS[plan] },
  }
}

export function resolveEntitlements(i: EntitlementInput): Entitlements {
  if (!i.signedIn) return build("public", "none")

  const candidates: { plan: PlanKey; source: PlanSource }[] = []
  const paid = paidPlan(i.subscription, i.now)
  if (paid) candidates.push({ plan: paid, source: "paid" })
  for (const g of i.grants ?? [])
    if (notExpired(g.expiresAt, i.now))
      candidates.push({ plan: g.plan, source: "grant" })
  if ((i.verifications ?? []).some((v) => notExpired(v.expiresAt, i.now)))
    candidates.push({ plan: "pro", source: "verified" })
  if (
    EARNED_PRO_TIERS.has(i.rewardsTier ?? "") ||
    (i.earnedProUntil != null && notExpired(i.earnedProUntil, i.now))
  )
    candidates.push({ plan: "pro", source: "earned" })

  if (candidates.length === 0) return build("free", "none")

  const best = candidates.reduce(
    (a, b) =>
      PLAN_RANK[b.plan] > PLAN_RANK[a.plan] ||
      (PLAN_RANK[b.plan] === PLAN_RANK[a.plan] &&
        SOURCE_ORDER.indexOf(b.source) < SOURCE_ORDER.indexOf(a.source))
        ? b
        : a,
    candidates[0]
  )

  return build(best.plan, best.source)
}

export const can = (e: Entitlements, f: Feature): boolean => e.features.has(f)
export const limitOf = (e: Entitlements, l: Limit): number => e.limits[l]

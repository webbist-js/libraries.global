import { TIER_NAMES } from "./limits"

export type PlanKey = "public" | "free" | "supporter" | "pro" | "team"
export type PlanSource =
  | "none"
  | "paid"
  | "team"
  | "grant"
  | "verified"
  | "earned"
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
  | "library.history"
  | "data.benchmark"
  | "data.explorerExport"
  | "events.personalFeed"
  | "team.workspace"
  | "team.bulkUpload"
  | "team.embed"
  | "api.key"
  | "library.team"
  | "library.traffic"
export type Limit = "savedViews" | "savedSearches" | "exportRows"

export interface Entitlements {
  plan: PlanKey
  source: PlanSource
  features: ReadonlySet<Feature>
  limits: Readonly<Record<Limit, number>>
  /** Libraries of the user's active, unexpired Teams (`canForLibrary`). */
  teamLibraryIds: ReadonlySet<string>
}

/** A Team the user is an active member of, as the session bridge sends it. */
export interface TeamInput {
  libraryDocumentIds: string[]
  expiresAt: string | null
  status: "active" | "lapsed"
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
    /** Verified paid period; supplied by billing, never inferred from status. */
    paidThrough?: string | null
  } | null
  /** Strapi `entitlement-grant` rows (P-D). Unknown plans are ignored. */
  grants?: { plan: string; expiresAt: string | null }[]
  /** Free-Pro verifications (C5, P-D). */
  verifications?: { expiresAt: string | null }[]
  rewardsTier?: string | null
  /** End of the 90-day hold after dropping below Archivist. */
  earnedProUntil?: string | null
  /**
   * Teams the user is an active member of (R2-B). An active, unexpired Team
   * gives Pro personally and Team features on its libraries only.
   */
  teams?: TeamInput[]
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
  "library.history",
  "data.benchmark",
  "data.explorerExport",
  "events.personalFeed",
]

export const TEAM_ONLY_FEATURES: readonly Feature[] = [
  "team.workspace",
  "team.bulkUpload",
  "team.embed",
  "api.key",
  "library.team",
  "library.traffic",
]
export const TEAM_FEATURES: readonly Feature[] = [
  ...PRO_FEATURES,
  ...TEAM_ONLY_FEATURES,
]

export const FEATURES: readonly Feature[] = TEAM_FEATURES

/**
 * Features that belong to a library, not a person: unlocked only on the
 * libraries of an active Team (`canForLibrary`). A personal `team` plan
 * grant alone never unlocks them.
 */
export const LIBRARY_SCOPED_FEATURES: readonly Feature[] = [
  "library.team",
  "library.traffic",
]

const PLAN_FEATURES: Record<PlanKey, readonly Feature[]> = {
  public: [],
  free: [],
  supporter: [],
  pro: PRO_FEATURES,
  team: TEAM_FEATURES,
}

const PLAN_LIMITS: Record<PlanKey, Record<Limit, number>> = {
  public: {
    savedViews: 0,
    savedSearches: 0,
    exportRows: 0,
  },
  free: {
    savedViews: 3,
    savedSearches: 3,
    exportRows: 0,
  },
  supporter: {
    savedViews: 3,
    savedSearches: 3,
    exportRows: 0,
  },
  pro: {
    savedViews: 1000,
    savedSearches: 1000,
    exportRows: 10_000,
  },
  team: {
    savedViews: 1000,
    savedSearches: 1000,
    exportRows: 50_000,
  },
}

const PAST_DUE_GRACE_MS = 7 * 86_400_000

/** End of the 90-day hold after dropping below Archivist (D-P4). */
export const EARNED_PRO_HOLD_DAYS = 90
const EARNED_PRO_TIERS: ReadonlySet<string> = new Set(
  TIER_NAMES.slice(TIER_NAMES.indexOf("Archivist"))
)

export function isEarnedProTier(tier: string | null | undefined): boolean {
  return EARNED_PRO_TIERS.has(tier ?? "")
}
const PLAN_RANK: Record<PlanKey, number> = {
  public: 0,
  free: 1,
  supporter: 2,
  pro: 3,
  team: 4,
}

// At equal plan, the earlier source wins.
export const SOURCE_ORDER: readonly PlanSource[] = [
  "paid",
  "team",
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
  if (!s || !isSupporterPlan(s.plan)) return null
  const plan = s.plan
  switch (s.status) {
    case "active":
    case "trialing":
      return s.paidThrough !== undefined && !notExpired(s.paidThrough, now)
        ? null
        : plan
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

function build(
  plan: PlanKey,
  source: PlanSource,
  teamLibraryIds: ReadonlySet<string> = new Set()
): Entitlements {
  return {
    plan,
    source,
    features: new Set(PLAN_FEATURES[plan]),
    limits: { ...PLAN_LIMITS[plan] },
    teamLibraryIds,
  }
}

/** The libraries of every active, unexpired Team in the input. */
function activeTeamLibraries(
  teams: TeamInput[] | undefined,
  now: Date
): Set<string> {
  const ids = new Set<string>()
  for (const t of teams ?? []) {
    if (t.status !== "active" || !notExpired(t.expiresAt, now)) continue
    for (const id of t.libraryDocumentIds) ids.add(id)
  }

  return ids
}

export function resolveEntitlements(i: EntitlementInput): Entitlements {
  if (!i.signedIn) return build("public", "none")

  const candidates: { plan: PlanKey; source: PlanSource }[] = []
  const paid = paidPlan(i.subscription, i.now)
  if (paid) candidates.push({ plan: paid, source: "paid" })
  const teamLibraryIds = activeTeamLibraries(i.teams, i.now)
  const activeTeam = (i.teams ?? []).some(
    (t) => t.status === "active" && notExpired(t.expiresAt, i.now)
  )
  if (activeTeam) candidates.push({ plan: "pro", source: "team" })
  for (const g of i.grants ?? [])
    if (isSupporterPlan(g.plan) && notExpired(g.expiresAt, i.now))
      candidates.push({ plan: g.plan, source: "grant" })
  if ((i.verifications ?? []).some((v) => notExpired(v.expiresAt, i.now)))
    candidates.push({ plan: "pro", source: "verified" })
  if (
    isEarnedProTier(i.rewardsTier) ||
    (i.earnedProUntil != null && notExpired(i.earnedProUntil, i.now))
  )
    candidates.push({ plan: "pro", source: "earned" })

  if (candidates.length === 0) return build("free", "none", teamLibraryIds)

  const best = candidates.reduce(
    (a, b) =>
      PLAN_RANK[b.plan] > PLAN_RANK[a.plan] ||
      (PLAN_RANK[b.plan] === PLAN_RANK[a.plan] &&
        SOURCE_ORDER.indexOf(b.source) < SOURCE_ORDER.indexOf(a.source))
        ? b
        : a,
    candidates[0]
  )

  return build(best.plan, best.source, teamLibraryIds)
}

export const can = (e: Entitlements, f: Feature): boolean => e.features.has(f)

/**
 * Whether `feature` is unlocked for one library. A library-scoped feature
 * (`LIBRARY_SCOPED_FEATURES`) is on only when an active Team of the user's
 * covers that library; every other feature is the personal check.
 */
export function canForLibrary(
  e: Entitlements,
  f: Feature,
  libraryDocumentId: string
): boolean {
  if (LIBRARY_SCOPED_FEATURES.includes(f))
    return e.teamLibraryIds.has(libraryDocumentId)

  return can(e, f)
}
export const limitOf = (e: Entitlements, l: Limit): number => e.limits[l]

/** Plans with optional public recognition; never a contribution capability. */
export function isSupporterPlan(
  plan: unknown
): plan is "supporter" | "pro" | "team" {
  return plan === "supporter" || plan === "pro" || plan === "team"
}

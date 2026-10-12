import {
  type Entitlements,
  type EntitlementInput,
  resolveEntitlements,
  isSupporterPlan,
  type TeamInput,
  paidMembershipInput,
  type PaidMembership,
} from "@repo/access"

import { loadPaidMembership } from "./paid-membership"
import { loadTeamInputs } from "./team-access"

const PROFILE = "api::user-profile.user-profile"
const ENTITLEMENT_GRANT = "api::entitlement-grant.entitlement-grant"
const PRO_VERIFICATION = "api::pro-verification.pro-verification"

/** Most plan grants or verifications read for one user. */
const MAX_PLAN_ROWS = 20

export type PlanRows = {
  paidMembership?: PaidMembership | null
  /** Unexpired `entitlement-grant` rows for a known plan. */
  grants: { plan: "supporter" | "pro" | "team"; expiresAt: string | null }[]
  /** Unexpired `pro-verification` rows. */
  verifications: { expiresAt: string | null }[]
}

export type EntitlementInputs = PlanRows & {
  tier: string | null
  earnedProUntil: string | null
  /** Active Team memberships (R2-B): Pro personally, Team per library. */
  teams: TeamInput[]
}

const isUnexpired = (expiresAt: string | null | undefined, now: number) =>
  expiresAt == null || Date.parse(expiresAt) > now

/**
 * A user's unexpired plan grants and Pro verifications, as the session
 * bridge (`auth-bridge.sessionProfile`) reports them. Both collections are
 * admin-only (no REST routes).
 */
export async function loadPlanRows(
  strapi: any,
  baUserId: string,
  now: number = Date.now()
): Promise<PlanRows> {
  const [grantRows, verificationRows, paidMembership] = await Promise.all([
    strapi.documents(ENTITLEMENT_GRANT as any).findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["plan", "expiresAt"],
      sort: "id:asc",
      limit: MAX_PLAN_ROWS,
    }) as Promise<{ plan?: string; expiresAt?: string | null }[]>,
    strapi.documents(PRO_VERIFICATION as any).findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["expiresAt"],
      sort: "id:asc",
      limit: MAX_PLAN_ROWS,
    }) as Promise<{ expiresAt?: string | null }[]>,
    loadPaidMembership(strapi, baUserId, new Date(now)),
  ])

  return {
    paidMembership,
    grants: (grantRows ?? [])
      .filter((g) => isUnexpired(g.expiresAt, now))
      .filter(
        (
          g
        ): g is {
          plan: "supporter" | "pro" | "team"
          expiresAt: string | null
        } => isSupporterPlan(g.plan)
      )
      .map((g) => ({ plan: g.plan, expiresAt: g.expiresAt ?? null })),
    verifications: (verificationRows ?? [])
      .filter((v) => isUnexpired(v.expiresAt, now))
      .map((v) => ({ expiresAt: v.expiresAt ?? null })),
  }
}

/**
 * Everything `resolveEntitlements` needs for one user, read from the same
 * rows the session bridge sends the site: plan grants, Pro verifications,
 * the rewards tier, the earned-Pro hold and the Teams they belong to.
 */
export async function loadEntitlementInputs(
  strapi: any,
  baUserId: string,
  now: number = Date.now()
): Promise<EntitlementInputs> {
  const [[profile], planRows, teams] = await Promise.all([
    strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["tier", "earnedProUntil"],
      limit: 1,
    }) as Promise<{ tier?: string | null; earnedProUntil?: string | null }[]>,
    loadPlanRows(strapi, baUserId, now),
    loadTeamInputs(strapi, baUserId),
  ])

  return {
    ...planRows,
    tier: profile?.tier ?? null,
    earnedProUntil: profile?.earnedProUntil ?? null,
    teams,
  }
}

/**
 * The user's Entitlements, resolved in Strapi exactly as the session does
 * (`buildSessionAccess` in the UI). For gating Pro data Strapi serves, so
 * the site's session is never the only check.
 */
export async function resolveUserEntitlements(
  strapi: any,
  baUserId: string,
  now: Date = new Date()
): Promise<Entitlements> {
  const inputs = await loadEntitlementInputs(strapi, baUserId, now.getTime())
  const input: EntitlementInput = {
    signedIn: true,
    now,
    grants: inputs.grants,
    verifications: inputs.verifications,
    rewardsTier: inputs.tier,
    earnedProUntil: inputs.earnedProUntil,
    teams: inputs.teams,
    subscription: paidMembershipInput(inputs.paidMembership),
  }

  return resolveEntitlements(input)
}

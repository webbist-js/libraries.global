import {
  type Entitlements,
  type EntitlementInput,
  resolveEntitlements,
} from "@repo/access"

const PROFILE = "api::user-profile.user-profile"
const ENTITLEMENT_GRANT = "api::entitlement-grant.entitlement-grant"
const PRO_VERIFICATION = "api::pro-verification.pro-verification"

/** Most plan grants or verifications read for one user. */
const MAX_PLAN_ROWS = 20

export type PlanRows = {
  /** Unexpired `entitlement-grant` rows for a known plan. */
  grants: { plan: "pro" | "team"; expiresAt: string | null }[]
  /** Unexpired `pro-verification` rows. */
  verifications: { expiresAt: string | null }[]
}

export type EntitlementInputs = PlanRows & {
  tier: string | null
  earnedProUntil: string | null
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
  const [grantRows, verificationRows] = await Promise.all([
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
  ])

  return {
    grants: (grantRows ?? [])
      .filter((g) => isUnexpired(g.expiresAt, now))
      .filter(
        (g): g is { plan: "pro" | "team"; expiresAt: string | null } =>
          g.plan === "pro" || g.plan === "team"
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
 * the rewards tier and the earned-Pro hold.
 */
export async function loadEntitlementInputs(
  strapi: any,
  baUserId: string,
  now: number = Date.now()
): Promise<EntitlementInputs> {
  const [[profile], planRows] = await Promise.all([
    strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["tier", "earnedProUntil"],
      limit: 1,
    }) as Promise<{ tier?: string | null; earnedProUntil?: string | null }[]>,
    loadPlanRows(strapi, baUserId, now),
  ])

  return {
    ...planRows,
    tier: profile?.tier ?? null,
    earnedProUntil: profile?.earnedProUntil ?? null,
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
  }

  return resolveEntitlements(input)
}

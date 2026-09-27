import {
  type Capability,
  type ContributorRole,
  type Feature,
  isContributorRole,
  type Limit,
  type PlanKey,
  type PlanSource,
  resolveCapabilities,
  resolveEntitlements,
} from "@repo/access"

import type { SessionProfile } from "./session-profile"

export type SessionAccess = {
  /** False when the bridge failed; gates on `username === null` must check this. */
  profileLoaded: boolean
  contributorRole: ContributorRole
  username: string | null
  capabilities: Capability[]
  claimedLibraryIds: string[]
  plan: PlanKey
  planSource: PlanSource
  features: Feature[]
  limits: Record<Limit, number>
}

/**
 * Turns the bridge profile into the session's access fields. A missing
 * profile (bridge down) yields a reader with no capabilities: the UI hides
 * actions and route pre-checks deny, while Strapi stays the real gate.
 */
export function buildSessionAccess(
  profile: SessionProfile | null,
  now: Date = new Date()
): SessionAccess {
  const role =
    profile && isContributorRole(profile.contributorRole)
      ? profile.contributorRole
      : "reader"
  const caps = profile
    ? resolveCapabilities({
        signedIn: true,
        contributorRole: role,
        claims: profile.claims.map((libraryDocumentId) => ({
          libraryDocumentId,
        })),
      })
    : null
  const ent = resolveEntitlements({
    signedIn: true,
    now,
    grants: profile?.grants ?? [],
    verifications: profile?.verifications ?? [],
    rewardsTier: profile?.tier ?? null,
    earnedProUntil: profile?.earnedProUntil ?? null,
  })

  return {
    profileLoaded: profile !== null,
    contributorRole: role,
    username: profile?.username ?? null,
    capabilities: caps ? [...caps.set] : [],
    claimedLibraryIds: caps ? [...caps.claimedLibraryIds] : [],
    plan: ent.plan,
    planSource: ent.source,
    features: [...ent.features],
    limits: { ...ent.limits },
  }
}

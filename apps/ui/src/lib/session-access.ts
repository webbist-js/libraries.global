import {
  type Capability,
  type ContributorRole,
  type Feature,
  isContributorRole,
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
  // P-B: no subscription, grant, verification or tier input, so this is
  // always "free" for a signed-in user. P-D wires the real inputs.
  const ent = resolveEntitlements({ signedIn: true, now })

  return {
    profileLoaded: profile !== null,
    contributorRole: role,
    username: profile?.username ?? null,
    capabilities: caps ? [...caps.set] : [],
    claimedLibraryIds: caps ? [...caps.claimedLibraryIds] : [],
    plan: ent.plan,
    planSource: ent.source,
    features: [...ent.features],
  }
}

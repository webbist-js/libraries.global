import {
  type Capability,
  type ContributorRole,
  type Feature,
  isContributorRole,
  type Limit,
  type ModerationScope,
  type PlanKey,
  type PlanSource,
  resolveCapabilities,
  resolveEntitlements,
  toSessionCapabilities,
} from "@repo/access"
import type { DismissiblePrompt } from "@repo/shared-data"

import type { SessionProfile } from "./session-profile"

export type SessionAccess = {
  /** False when the bridge failed; gates on `username === null` must check this. */
  profileLoaded: boolean
  contributorRole: ContributorRole
  username: string | null
  capabilities: Capability[]
  claimedLibraryIds: string[]
  moderationScopes: ModerationScope[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
  plan: PlanKey
  planSource: PlanSource
  features: Feature[]
  limits: Record<Limit, number>
  /** Prompts hidden in the user's settings (`lib/dismissed-prompts.ts`). */
  dismissedPrompts: DismissiblePrompt[]
}

/**
 * Turns the bridge profile into the session's access fields. A missing
 * profile (bridge down) yields a reader with no capabilities: the UI hides
 * actions and route pre-checks deny, while Strapi stays the real gate.
 * Capabilities come from the role grants only; `contributorRole` is the
 * derived label, carried for display.
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
        grants: profile.roleGrants,
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
    ...(caps
      ? toSessionCapabilities(caps)
      : {
          capabilities: [],
          claimedLibraryIds: [],
          moderationScopes: [],
          editorLocales: { docs: [], journal: [] },
        }),
    plan: ent.plan,
    planSource: ent.source,
    features: [...ent.features],
    limits: { ...ent.limits },
    dismissedPrompts: profile?.dismissedPrompts ?? [],
  }
}

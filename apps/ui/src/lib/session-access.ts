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
  paidMembershipInput,
} from "@repo/access"
import type { DismissiblePrompt } from "@repo/shared-data"

import type { SessionTeam, StaffLibrarySummary } from "./access-server"
import type { CompositionPreferences } from "./composition-language"
import type { SessionProfile } from "./session-profile"

export type SessionAccess = {
  /** False when the bridge failed; gates on `username === null` must check this. */
  profileLoaded: boolean
  contributorRole: ContributorRole
  username: string | null
  /** Owner-only content defaults; unrelated to capabilities or UI locale. */
  compositionPreferences: CompositionPreferences
  capabilities: Capability[]
  claimedLibraryIds: string[]
  staffLibraries: StaffLibrarySummary[]
  moderationScopes: ModerationScope[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
  plan: PlanKey
  planSource: PlanSource
  features: Feature[]
  limits: Record<Limit, number>
  /** Prompts hidden in the user's settings (`lib/dismissed-prompts.ts`). */
  dismissedPrompts: DismissiblePrompt[]
  /** Teams the user belongs to (summary; the organiser page loads detail). */
  teams: SessionTeam[]
  /** Libraries of their active Teams: `canForLibrary` for Team features. */
  teamLibraryIds: string[]
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
        claims: profile.staff ?? [],
      })
    : null
  const ent = resolveEntitlements({
    signedIn: true,
    now,
    subscription: paidMembershipInput(profile?.paidMembership),
    grants: profile?.grants ?? [],
    verifications: profile?.verifications ?? [],
    rewardsTier: profile?.tier ?? null,
    earnedProUntil: profile?.earnedProUntil ?? null,
    teams: (profile?.teams ?? []).map((t) => ({
      libraryDocumentIds: t.libraryDocumentIds,
      expiresAt: t.expiresAt,
      status: t.status,
    })),
  })

  return {
    profileLoaded: profile !== null,
    contributorRole: role,
    username: profile?.username ?? null,
    compositionPreferences: profile?.compositionPreferences ?? {
      country: null,
      languages: [],
    },
    ...(caps
      ? toSessionCapabilities(caps)
      : {
          capabilities: [],
          claimedLibraryIds: [],
          moderationScopes: [],
          editorLocales: { docs: [], journal: [] },
        }),
    plan: ent.plan,
    claimedLibraryIds: profile?.claims ?? [],
    staffLibraries: (profile?.staff ?? []).map(
      ({
        libraryDocumentId,
        staffRole,
        canGoLive,
        name,
        slug,
        libraryType,
      }) => ({
        id: libraryDocumentId,
        role: staffRole,
        canGoLive,
        name,
        slug,
        libraryType,
      })
    ),
    planSource: ent.source,
    features: [...ent.features],
    limits: { ...ent.limits },
    dismissedPrompts: profile?.dismissedPrompts ?? [],
    teams: (profile?.teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: t.role,
      libraryCount: t.libraryCount,
      ...(t.selfService ? { selfService: true } : {}),
      status: t.status,
      expiresAt: t.expiresAt,
    })),
    teamLibraryIds: [...ent.teamLibraryIds],
  }
}

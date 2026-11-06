import type { DismissiblePrompt } from "@repo/shared-data"

import {
  type AccessFact,
  type AccessStanding,
  type ApiAccountInput,
  type Capability,
  type ContributorRole,
  type Feature,
  isContributorRole,
  isRecentlyActive,
  type Limit,
  type ModerationScope,
  resolveCapabilities,
  resolveEntitlements,
  toSessionCapabilities,
  type RoleGrant,
  type StaffClaim,
  type StaffRole,
} from "./index"

export type CompositionPreferences = {
  country?: string | null
  languages?: readonly {
    code: string
    proficiency: "native" | "fluent" | "conversational"
  }[]
}
export type StaffLibrarySummary = {
  id: string
  name: string
  slug: string
  libraryType: string
  role: StaffRole
  canGoLive: boolean
}
/**
 * A free staff workspace (organisation) the user belongs to. Membership is an
 * administrative container: it never grants library editing authority, which
 * comes only from the user's own verified staff claims.
 */
export type SessionTeam = {
  id: string
  name: string
  slug: string
  role: "organiser" | "member"
  libraryCount: number
}
export type SessionProfileTeam = SessionTeam & {
  libraryDocumentIds: string[]
  organiserName: string | null
}
/** An API account the user belongs to, with its settled paid coverage. */
export type SessionApiAccount = ApiAccountInput & {
  /** The organisation that owns the API account. */
  teamId: string
}

export type SessionProfile = {
  compositionPreferences?: CompositionPreferences
  staff: (StaffClaim & { name: string; slug: string; libraryType: string })[]
  contributorRole: ContributorRole
  username: string | null
  tier: string | null
  claims: string[]
  /** Contributor Role grants (capabilities). */
  roleGrants: RoleGrant[]
  rewardsPoints?: number
  /** Distinct accepted, substantive contributions (recognition). */
  acceptedContributions?: number
  lastContributionAt?: string | null
  recognitionRevoked?: boolean
  /** Prompts the user has hidden in their settings. */
  dismissedPrompts: DismissiblePrompt[]
  /** Free staff workspaces; never a source of authority. */
  teams: SessionProfileTeam[]
  /** API accounts (entitlements: the organiser Reach bonus and key tools). */
  apiAccounts?: SessionApiAccount[]
}

export type SessionAccess = {
  /** False when the profile is unavailable; gates on `username === null` must check this. */
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
  /** Free standing for display: explorer, contributor or supporter. */
  standing: AccessStanding
  /** Independent access facts (`explorer`, `contributor`, `supporter`, `apiCustomer`). */
  facts: AccessFact[]
  /** A recent accepted contribution; display only, never an entitlement. */
  recentlyActive: boolean
  acceptedContributions: number
  features: Feature[]
  limits: Record<Limit, number>
  /** Prompts hidden in the user's settings (`lib/dismissed-prompts.ts`). */
  dismissedPrompts: DismissiblePrompt[]
  /** Staff workspaces the user belongs to (summary; the organiser page loads detail). */
  teams: SessionTeam[]
  /** API accounts the user belongs to (by owning organisation). */
  apiAccounts: {
    teamId: string
    role: "organiser" | "member"
    active: boolean
  }[]
}

/**
 * Turns the profile into the session's access fields. A missing
 * profile yields a reader with no capabilities: the UI hides
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
  const apiAccounts = profile?.apiAccounts ?? []
  const ent = resolveEntitlements({
    signedIn: true,
    now,
    acceptedContributions: profile?.acceptedContributions ?? 0,
    recognitionRevoked: profile?.recognitionRevoked ?? false,
    apiAccounts,
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
    standing: ent.standing,
    facts: [...ent.facts],
    recentlyActive: isRecentlyActive(profile?.lastContributionAt, now),
    acceptedContributions: profile?.acceptedContributions ?? 0,
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
    features: [...ent.features],
    limits: { ...ent.limits },
    dismissedPrompts: profile?.dismissedPrompts ?? [],
    teams: (profile?.teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: t.role,
      libraryCount: t.libraryCount,
    })),
    apiAccounts: apiAccounts.map((a) => ({
      teamId: a.teamId,
      role: a.role,
      active:
        !a.revoked &&
        typeof a.paidThrough === "string" &&
        Date.parse(a.paidThrough) > now.getTime(),
    })),
  }
}

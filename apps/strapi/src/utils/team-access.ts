import { canForLibrary, type Feature, type TeamInput } from "@repo/access"

import { resolveUserEntitlements } from "./entitlement-inputs"

/**
 * Teams (R2-B): a Team organisation's active, unexpired membership gives Pro
 * personally (plan source `team`) and Team features on the Team's libraries
 * only. These readers feed `resolveEntitlements` in Strapi and the session
 * bridge, so both resolve the same answer.
 */

export const TEAM_UID = "plugin::access.team"
export const TEAM_MEMBER_UID = "plugin::access.team-member"

/** Most Teams one person's session carries. */
export const MAX_TEAMS_PER_USER = 10
/** Most libraries a Team may cover. */
export const MAX_TEAM_LIBRARIES = 200

export function teamIsActive(team: {
  status?: string | null
  expiresAt?: string | null
  source?: string | null
  billingMode?: string | null
}) {
  return (
    team.status === "active" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > Date.now()) &&
    (team.source !== "checkout" ||
      team.billingMode ===
        (process.env.BILLING_ENV === "live" ? "live" : "sandbox"))
  )
}

export type TeamMembership = {
  memberDocumentId: string
  teamDocumentId: string
  name: string
  slug: string
  teamRole: "organiser" | "member"
  status: "active" | "lapsed"
  expiresAt: string | null
  verified: boolean
  selfService?: boolean
  libraryDocumentIds: string[]
}

type MemberRow = {
  documentId: string
  teamRole?: string | null
  team?: {
    documentId?: string
    name?: string | null
    slug?: string | null
    status?: string | null
    expiresAt?: string | null
    verifiedAt?: string | null
    source?: string | null
    billingMode?: string | null
    libraries?: { documentId?: string }[] | null
  } | null
}

/**
 * The Teams `baUserId` is an active member of, with each Team's libraries.
 * Lapsed and expired Teams are included (status and expiry are reported),
 * so a caller can show them; `toTeamInputs` lets `resolveEntitlements`
 * decide what counts.
 */
export async function loadTeamMemberships(
  strapi: any,
  baUserId: string
): Promise<TeamMembership[]> {
  const rows = (await strapi.documents(TEAM_MEMBER_UID as any).findMany({
    filters: { baUserId: { $eq: baUserId }, status: { $eq: "active" } },
    fields: ["documentId", "teamRole"],
    populate: {
      team: {
        // Trusted internal query: private fields cannot be named in a nested
        // populate. Only the explicit public projection below leaves this helper.
        populate: { libraries: { fields: ["documentId"] } },
      },
    },
    sort: "id:asc",
    limit: MAX_TEAMS_PER_USER,
  })) as MemberRow[]

  return rows.flatMap((row): TeamMembership[] => {
    const team = row.team
    if (!team?.documentId) return []

    return [
      {
        memberDocumentId: row.documentId,
        teamDocumentId: team.documentId,
        name: team.name ?? "Team",
        slug: team.slug ?? "",
        teamRole: row.teamRole === "organiser" ? "organiser" : "member",
        status:
          team.status === "lapsed" ||
          (team.source === "checkout" &&
            team.billingMode !==
              (process.env.BILLING_ENV === "live" ? "live" : "sandbox"))
            ? "lapsed"
            : "active",
        expiresAt: team.expiresAt ?? null,
        verified: !!team.verifiedAt,
        ...(team.source === "checkout" ? { selfService: true } : {}),
        libraryDocumentIds: (team.libraries ?? [])
          .map((l) => l.documentId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, MAX_TEAM_LIBRARIES),
      },
    ]
  })
}

export const toTeamInputs = (memberships: TeamMembership[]): TeamInput[] =>
  memberships.map((m) => ({
    libraryDocumentIds: m.libraryDocumentIds,
    expiresAt: m.expiresAt,
    status: m.status,
  }))

/** `EntitlementInput.teams` for one user (for `loadEntitlementInputs`). */
export async function loadTeamInputs(
  strapi: any,
  baUserId: string
): Promise<TeamInput[]> {
  return toTeamInputs(await loadTeamMemberships(strapi, baUserId))
}

/**
 * Whether `feature` is unlocked for `baUserId` on one library: a
 * library-scoped feature needs an active Team of theirs covering it; any
 * other feature is their personal plan. Resolved in Strapi on every call,
 * so the site's session is never the only check.
 */
export async function hasLibraryFeature(
  strapi: any,
  baUserId: string,
  feature: Feature,
  libraryDocumentId: string
): Promise<boolean> {
  const entitlements = await resolveUserEntitlements(strapi, baUserId)

  return canForLibrary(entitlements, feature, libraryDocumentId)
}

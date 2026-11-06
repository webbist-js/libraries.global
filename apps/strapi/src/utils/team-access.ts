/**
 * Teams are free staff workspaces (organisations). Membership is an
 * administrative container: it never grants library editing or staff tools,
 * which come only from the user's own verified staff claims (`canStaff`).
 * A Team's `status` is an admin lifecycle flag, not a paid-seat state.
 */

export const TEAM_UID = "plugin::access.team"
export const TEAM_MEMBER_UID = "plugin::access.team-member"

/** One account holds one workspace membership. */
export const MAX_TEAMS_PER_USER = 1
/** Read legacy duplicates until an operator reconciles them. */
const MEMBERSHIP_READ_LIMIT = 11

/** Most libraries a Team may cover. */
export const MAX_TEAM_LIBRARIES = 2000

/** Whether a workspace is usable: an admin may lapse it; payment never does. */
export function teamIsActive(team: { status?: string | null }) {
  return team.status === "active"
}

export type TeamMembership = {
  memberDocumentId: string
  teamDocumentId: string
  name: string
  slug: string
  teamRole: "organiser" | "member"
  status: "active" | "lapsed"
  verified: boolean
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
    verifiedAt?: string | null
    libraries?: { documentId?: string }[] | null
  } | null
}

/**
 * The Teams `baUserId` is an active member of, with each Team's libraries.
 * Lapsed workspaces are included (status is reported) so a caller can show
 * them.
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
    limit: MEMBERSHIP_READ_LIMIT,
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
        status: teamIsActive(team) ? "active" : "lapsed",
        verified: !!team.verifiedAt,
        libraryDocumentIds: (team.libraries ?? [])
          .map((l) => l.documentId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, MAX_TEAM_LIBRARIES),
      },
    ]
  })
}

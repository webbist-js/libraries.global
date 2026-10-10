import {
  grantVerifiedLibrarian,
  upsertAffiliation,
} from "../../../../utils/affiliations"
import { loadStaffClaims } from "../../../../utils/staff"
import {
  loadTeamMemberships,
  MAX_TEAM_LIBRARIES,
  TEAM_UID,
} from "../../../../utils/team-access"
import { teamTransaction } from "../../../access/server/services/teams"
import { AccessError, isDocumentId } from "../../../access/server/utils/admin"

/** Stored only by the authenticated creation path, never by draft JSON. */
export type StaffLibraryCreation = {
  teamDocumentId: string | null
  teamName: string | null
}

export function staffCreationOf(
  draftData: unknown
): StaffLibraryCreation | null {
  if (!draftData || typeof draftData !== "object") return null
  const value = (draftData as Record<string, unknown>).staffCreation
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const context = value as Record<string, unknown>
  if (context.teamDocumentId !== null && !isDocumentId(context.teamDocumentId))
    return null

  return {
    teamDocumentId: context.teamDocumentId as string | null,
    teamName: typeof context.teamName === "string" ? context.teamName : null,
  }
}

/** Live access checks: a client flag or personal paid plan grants nothing. */
export async function resolveStaffLibraryCreation(
  strapi: any,
  baUserId: string,
  request: unknown
): Promise<StaffLibraryCreation | null> {
  if (request === undefined) return null
  if (!request || typeof request !== "object" || Array.isArray(request))
    throw new AccessError(400, "invalid_staff_creation")
  const teamId = (request as Record<string, unknown>).teamDocumentId ?? null
  if (teamId !== null && !isDocumentId(teamId))
    throw new AccessError(400, "invalid_team")
  const [claims, memberships] = await Promise.all([
    loadStaffClaims(strapi, baUserId),
    loadTeamMemberships(strapi, baUserId),
  ])
  const active = memberships.filter(
    (team) =>
      team.status === "active" &&
      (!team.expiresAt || Date.parse(team.expiresAt) > Date.now())
  )
  if (!claims.length && !active.some((team) => team.verified))
    throw new AccessError(403, "staff_access_required")
  const team = teamId
    ? active.find((entry) => entry.teamDocumentId === teamId)
    : null
  if (teamId && !team) throw new AccessError(403, "team_membership_required")
  if (team && team.libraryDocumentIds.length >= MAX_TEAM_LIBRARIES)
    throw new AccessError(409, "team_library_limit")

  return { teamDocumentId: teamId, teamName: team?.name ?? null }
}

/**
 * The moderator's approval grants the creator ownership and, when requested,
 * extends their existing Team's coverage. Runs inside the approval transaction.
 * Team coverage is additive; seats, billing and verification are unchanged.
 */
export async function applyStaffLibraryCreation(
  strapi: any,
  baUserId: string,
  libraryDocumentId: string,
  context: StaffLibraryCreation
): Promise<void> {
  const claim = async () => {
    await upsertAffiliation(strapi, {
      baUserId,
      libraryDocumentId,
      staffRole: "owner",
      source: "claim",
      verificationMethod: "contact_us",
    })
    await grantVerifiedLibrarian(strapi, baUserId)
  }
  if (!context.teamDocumentId) {
    await resolveStaffLibraryCreation(strapi, baUserId, context)
    await claim()

    return
  }
  const teamId = context.teamDocumentId
  await teamTransaction(strapi, teamId, async () => {
    await resolveStaffLibraryCreation(strapi, baUserId, context)
    await strapi.documents(TEAM_UID).update({
      documentId: teamId,
      data: { libraries: { connect: [{ documentId: libraryDocumentId }] } },
    })
    await claim()
  })
}

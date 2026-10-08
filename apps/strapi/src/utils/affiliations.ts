import { createGrant } from "./role-grants"

/**
 * Affiliation roles that are not claims. A `proposer` row records who
 * suggested a new library; it grants no capabilities and must never appear
 * in the session's `claimedLibraryIds`.
 */
export const NON_CLAIM_AFFILIATION_ROLES: readonly string[] = ["proposer"]

/**
 * Document Service filter for a user's real claims. `role NOT IN (...)`
 * alone would drop rows whose role is NULL (every email-domain auto-claim),
 * so a null role is allowed explicitly.
 */
export function claimAffiliationFilter(baUserId: string) {
  return {
    baUserId: { $eq: baUserId },
    $or: [
      { role: { $null: true } },
      { role: { $notIn: [...NON_CLAIM_AFFILIATION_ROLES] } },
    ],
  }
}

/**
 * Approving a Library Claim (or an email-domain auto-verification) gives the
 * user a `verified_librarian` Role Grant, unless they already hold one. It
 * never removes or lowers a grant, and never writes the profile: the
 * role-grant lifecycle derives `contributorRole` and `isVerifiedLibrarian`.
 */
export async function grantVerifiedLibrarian(
  strapi: any,
  baUserId: string,
  source: "claim" | "team" = "claim"
) {
  await createGrant(strapi, {
    baUserId,
    role: "verified_librarian",
    source,
    reason:
      source === "team"
        ? "Assigned to a library by a verified Team's organiser"
        : "Approved Library Claim",
  })
}

const AFFILIATION = "api::library-affiliation.library-affiliation"

/** True when the library has no staff claim yet (proposer rows don't count). */
async function libraryHasStaff(
  strapi: any,
  libraryDocumentId: string
): Promise<boolean> {
  const { baUserId: _user, ...claimFilter } = claimAffiliationFilter("")
  const count = await strapi.documents(AFFILIATION).count({
    filters: {
      ...claimFilter,
      library: { documentId: { $eq: libraryDocumentId } },
    },
  })

  return count > 0
}

/**
 * Creates or updates the affiliation for `baUserId` at `libraryDocumentId`,
 * instead of duplicating rows. On update, `role`, `department` and
 * `verificationMethod` are only overwritten when the caller explicitly
 * provides them (not `undefined`) — an update must never null out values a
 * previous call set. A proposer row promoted by a claim without a job title
 * gets `role: null`, so it counts as a claim.
 *
 * The first claimant of a library is stored as `staffRole: "owner"` (unless
 * the caller sets a level), so a later owner-level colleague never demotes
 * them. Membership effects (hasStaff, sessions, search) run from the
 * affiliation lifecycle, not from here.
 *
 * `source` and `teamMemberDocumentId` mark a row a Team organiser created
 * (`source: "team"`); a claim approval leaves them alone on update, so a
 * Team-managed row keeps its Team.
 *
 * Returns the affiliation's documentId and whether this call created it, so
 * a caller can compensate (delete it) if a later step fails.
 */
export async function upsertAffiliation(
  strapi: any,
  data: {
    baUserId: string
    libraryDocumentId: string
    role?: string | null
    department?: string | null
    verificationMethod?: string
    staffRole?: "owner" | "editor"
    source?: "claim" | "team"
    teamMemberDocumentId?: string | null
  }
): Promise<{ documentId: string; created: boolean }> {
  const teamFields =
    data.source === undefined
      ? {}
      : {
          source: data.source,
          teamMember:
            data.source === "team" && data.teamMemberDocumentId
              ? { set: [{ documentId: data.teamMemberDocumentId }] }
              : { set: [] },
        }
  const existing = (await strapi.documents(AFFILIATION).findMany({
    filters: {
      baUserId: { $eq: data.baUserId },
      library: { documentId: { $eq: data.libraryDocumentId } },
    },
    limit: 1,
    fields: ["documentId", "role"],
  })) as { documentId: string; role?: string | null }[]
  const joining = data.role !== "proposer"

  if (existing[0]) {
    const promoted = existing[0].role === "proposer" && joining
    const updateData: Record<string, unknown> = {}
    if (data.role !== undefined) updateData.role = data.role
    else if (promoted) updateData.role = null
    if (data.department !== undefined) updateData.department = data.department
    if (data.verificationMethod !== undefined)
      updateData.verificationMethod = data.verificationMethod
    if (data.staffRole !== undefined) updateData.staffRole = data.staffRole
    else if (
      promoted &&
      !(await libraryHasStaff(strapi, data.libraryDocumentId))
    )
      updateData.staffRole = "owner"
    if (promoted) updateData.approvedAt = new Date().toISOString()
    Object.assign(updateData, teamFields)

    await strapi
      .documents(AFFILIATION)
      .update({ documentId: existing[0].documentId, data: updateData as any })

    if (promoted)
      await strapi
        .plugin("library-staff")
        ?.service("staff")
        ?.joined(data.baUserId, data.libraryDocumentId)

    return { documentId: existing[0].documentId, created: false }
  }

  const staffRole =
    data.staffRole ??
    (joining && !(await libraryHasStaff(strapi, data.libraryDocumentId))
      ? "owner"
      : null)
  const created = (await strapi.documents(AFFILIATION).create({
    data: {
      baUserId: data.baUserId,
      role: data.role ?? null,
      department: data.department ?? null,
      verificationMethod: data.verificationMethod ?? null,
      staffRole,
      approvedAt: new Date().toISOString(),
      library: { connect: [{ documentId: data.libraryDocumentId }] },
      source: data.source ?? (joining ? "claim" : null),
      ...(data.source === "team" && data.teamMemberDocumentId
        ? {
            teamMember: {
              connect: [{ documentId: data.teamMemberDocumentId }],
            },
          }
        : {}),
    } as any,
  })) as { documentId: string }

  if (joining)
    await strapi
      .plugin("library-staff")
      ?.service("staff")
      ?.joined(data.baUserId, data.libraryDocumentId)

  return { documentId: created.documentId, created: true }
}

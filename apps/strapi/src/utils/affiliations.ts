import { isContributorRole, promoteRole } from "@repo/access"

/**
 * Approving a Library Claim (or an email-domain auto-verification) may only
 * *raise* the submitter's contributor role, never overwrite a higher one
 * (e.g. wiki_editor, editorial_board) with verified_librarian.
 */
export async function grantVerifiedLibrarian(strapi: any, baUserId: string) {
  const [profile] = (await strapi
    .documents("api::user-profile.user-profile")
    .findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["documentId", "contributorRole"],
      limit: 1,
    })) as { documentId: string; contributorRole?: string }[]
  if (!profile) return
  await strapi.documents("api::user-profile.user-profile").update({
    documentId: profile.documentId,
    data: {
      isVerifiedLibrarian: true,
      contributorRole: promoteRole(
        isContributorRole(profile.contributorRole)
          ? profile.contributorRole
          : null,
        "verified_librarian"
      ),
    },
  })
}

/**
 * Creates or updates the affiliation for `baUserId` at `libraryDocumentId`,
 * instead of duplicating rows. On update, `role`, `department` and
 * `verificationMethod` are only overwritten when the caller explicitly
 * provides them (not `undefined`) — an update must never null out values a
 * previous call set.
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
  }
): Promise<{ documentId: string; created: boolean }> {
  const existing = (await strapi
    .documents("api::library-affiliation.library-affiliation")
    .findMany({
      filters: {
        baUserId: { $eq: data.baUserId },
        library: { documentId: { $eq: data.libraryDocumentId } },
      },
      limit: 1,
    })) as { documentId: string }[]

  if (existing[0]) {
    const updateData: Record<string, unknown> = {}
    if (data.role !== undefined) updateData.role = data.role
    if (data.department !== undefined) updateData.department = data.department
    if (data.verificationMethod !== undefined)
      updateData.verificationMethod = data.verificationMethod

    await strapi
      .documents("api::library-affiliation.library-affiliation")
      .update({ documentId: existing[0].documentId, data: updateData as any })

    return { documentId: existing[0].documentId, created: false }
  }

  const created = (await strapi
    .documents("api::library-affiliation.library-affiliation")
    .create({
      data: {
        baUserId: data.baUserId,
        role: data.role ?? null,
        department: data.department ?? null,
        verificationMethod: data.verificationMethod ?? null,
        library: { connect: [{ documentId: data.libraryDocumentId }] },
      } as any,
    })) as { documentId: string }

  return { documentId: created.documentId, created: true }
}

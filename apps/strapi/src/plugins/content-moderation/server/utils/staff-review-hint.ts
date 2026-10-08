/** Moderator queues still permit a decision; this label only explains the staff route. */
export async function staffReviewHint(
  strapi: any,
  submission: any,
  preloaded?: Map<string, boolean>
): Promise<string | null> {
  if (submission.draftData?.requestedByStaff === true) return "Staff request"
  if (
    submission.submissionType !== "correction" ||
    submission.status !== "pending"
  )
    return null
  if (preloaded)
    return preloaded.get(submission.targetDocumentId ?? submission.targetSlug)
      ? Date.now() - Date.parse(submission.createdAt) >= 14 * 86_400_000
        ? "Staff haven’t answered"
        : "Library staff can review"
      : null
  const query = { status: "published", fields: ["documentId", "hasStaff"] }
  const library = submission.targetDocumentId
    ? await strapi
        .documents("api::library.library")
        .findOne({ documentId: submission.targetDocumentId, ...query })
    : submission.targetSlug
      ? (
          await strapi.documents("api::library.library").findMany({
            ...query,
            filters: { slug: submission.targetSlug },
            limit: 1,
          })
        )[0]
      : null
  if (!library?.hasStaff) return null

  return Date.now() - Date.parse(submission.createdAt) >= 14 * 86_400_000
    ? "Staff haven’t answered"
    : "Library staff can review"
}

export async function preloadStaffReviewHints(
  strapi: any,
  submissions: any[]
): Promise<Map<string, boolean>> {
  const rows = submissions.filter(
    (row) => row.submissionType === "correction" && row.status === "pending"
  )
  const ids = [
    ...new Set(rows.map((row) => row.targetDocumentId).filter(Boolean)),
  ]
  const slugs = [
    ...new Set(
      rows
        .filter((row) => !row.targetDocumentId)
        .map((row) => row.targetSlug)
        .filter(Boolean)
    ),
  ]
  const hints = new Map<string, boolean>()
  if (!ids.length && !slugs.length) return hints
  const filters = [
    ids.length ? { documentId: { $in: ids } } : null,
    slugs.length ? { slug: { $in: slugs } } : null,
  ].filter(Boolean)
  const libraries = await strapi.documents("api::library.library").findMany({
    status: "published",
    fields: ["documentId", "slug", "hasStaff"],
    filters: { $or: filters },
    limit: ids.length + slugs.length,
  })
  for (const library of libraries) {
    hints.set(library.documentId, library.hasStaff === true)
    if (library.slug) hints.set(library.slug, library.hasStaff === true)
  }

  return hints
}

export type ClaimReview = {
  /** The claimant's current staff row at the library, if any. */
  affiliation: {
    documentId: string
    staffRole: "owner" | "editor"
    source: "claim" | "team" | null
    approvedAt: string | null
  } | null
  /** Set when an unverified Team's organiser filed the claim by assignment. */
  team: { name: string; staffRole: "owner" | "editor" } | null
}

/**
 * What a Library Claim's review shows beyond its fields: whether the
 * claimant already holds staff access at the library (so a Moderator can
 * remove it from the panel, 1.3) and, for a Team-filed claim, the Team.
 */
export async function claimReview(
  strapi: any,
  submission: any
): Promise<ClaimReview> {
  const out: ClaimReview = { affiliation: null, team: null }
  if (
    submission.submissionType !== "library_claim" ||
    !submission.targetDocumentId ||
    !submission.submittedByUserId
  )
    return out
  const [row] = await strapi
    .documents("api::library-affiliation.library-affiliation")
    .findMany({
      filters: {
        baUserId: { $eq: submission.submittedByUserId },
        library: { documentId: { $eq: submission.targetDocumentId } },
        $or: [{ role: { $null: true } }, { role: { $ne: "proposer" } }],
      },
      fields: ["documentId", "staffRole", "source", "approvedAt"],
      limit: 1,
    })
  if (row)
    out.affiliation = {
      documentId: row.documentId,
      staffRole: row.staffRole === "owner" ? "owner" : "editor",
      source:
        row.source === "team" || row.source === "claim" ? row.source : null,
      approvedAt: row.approvedAt ?? null,
    }
  const teamName = submission.fields?.teamName
  const staffRole = submission.draftData?.staffRole
  if (
    typeof submission.draftData?.teamMemberDocumentId === "string" &&
    typeof teamName === "string"
  )
    out.team = {
      name: teamName,
      staffRole: staffRole === "owner" ? "owner" : "editor",
    }

  return out
}

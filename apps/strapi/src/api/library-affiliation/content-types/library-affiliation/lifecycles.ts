import { onStaffChanged } from "../../../../utils/staff-lifecycle"

/**
 * The only trigger of `onStaffChanged`: every create, update and delete of a
 * staff row (never a `proposer` row) refreshes `hasStaff`, live sessions,
 * the search index and the session profile. Deletes map to `"removed"`, so
 * the person is emailed and a lone claim's `verified_librarian` grant
 * expires; creates and updates map to `"approved"`.
 */
const capture = async (event: any) => {
  const rows = await strapi.db
    .query("api::library-affiliation.library-affiliation")
    .findMany({ where: event.params.where, populate: { library: true } })
  event.state ??= {}
  event.state.staffRows = rows
}
const changed = async (event: any) => {
  const rows = [...(event.state?.staffRows ?? [])]
  if (event.result?.id) {
    const row = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findOne({ where: { id: event.result.id }, populate: { library: true } })
    if (row) rows.push(row)
  }
  const change = String(event.action).startsWith("afterDelete")
    ? "removed"
    : "approved"
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.baUserId}:${row.library?.documentId}`
    if (
      seen.has(key) ||
      row.role === "proposer" ||
      !row.baUserId ||
      !row.library?.documentId
    )
      continue
    seen.add(key)
    await onStaffChanged(strapi, {
      baUserId: row.baUserId,
      libraryDocumentId: row.library.documentId,
      change,
    })
  }
}

export default {
  beforeDelete: capture,
  beforeDeleteMany: capture,
  beforeUpdate: capture,
  afterCreate: changed,
  afterUpdate: changed,
  afterDelete: changed,
  afterDeleteMany: changed,
}

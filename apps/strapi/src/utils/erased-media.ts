import type { Core } from "@strapi/strapi"

const OWNERSHIP = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"

/** Profile attachments are server-validated; draft JSON is never ownership evidence. */
export async function queueErasedMedia(
  strapi: Core.Strapi,
  userId: string,
  erasedId: string,
  profileFileIds: number[]
) {
  for (const fileId of new Set(profileFileIds)) {
    const existing = await strapi.db
      .query(OWNERSHIP)
      .findOne({ where: { fileId } })
    if (!existing)
      await strapi.db
        .query(OWNERSHIP)
        .create({ data: { fileId, baUserId: userId } })
  }
  // Retain the server ownership ledger until cleanup has completed. The old
  // account identifier is removed in the same transaction as account erasure.
  await strapi.db.query(OWNERSHIP).updateMany({
    where: { baUserId: userId },
    data: { baUserId: erasedId, updatedAt: new Date() },
  })
}

/** Bounded, retryable cleanup. Referenced assets are retained without an owner. */
export async function purgeErasedMedia(strapi: Core.Strapi, owner?: string) {
  const rows = await strapi.db.query(OWNERSHIP).findMany({
    where: { baUserId: owner ?? { $startsWith: "deleted-" } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    limit: 100,
  })
  const report = { removed: 0, retained: 0, failed: 0 }
  for (const row of rows) {
    if (!/^deleted-[0-9a-f-]{36}$/.test(row.baUserId)) continue
    try {
      const file = await strapi.db.query(FILE).findOne({
        where: { id: row.fileId },
        populate: { related: true },
      })
      if (file) {
        // A failed or incomplete reference read must never authorize deletion.
        if (!Array.isArray(file.related))
          throw new Error("media_reference_read_failed")
        if (file.related.length) report.retained++
        else {
          await strapi.plugin("upload").service("upload").remove(file)
          report.removed++
        }
      }
      await strapi.db.query(OWNERSHIP).deleteMany({
        where: { fileId: row.fileId, baUserId: row.baUserId },
      })
    } catch {
      report.failed++
      // Rotate failures behind other pending files, without retaining identity.
      await strapi.db.query(OWNERSHIP).updateMany({
        where: { fileId: row.fileId, baUserId: row.baUserId },
        data: { updatedAt: new Date() },
      })
      strapi.log.warn("[erase-account] Owned media cleanup will retry")
    }
  }

  return report
}

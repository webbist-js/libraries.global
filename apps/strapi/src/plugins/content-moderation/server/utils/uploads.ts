const UPLOADS = "plugin::content-moderation.submission-upload"

/** A2: only files this submitter uploaded through the submission flow. */
export async function ownedUploadIds(
  strapi: any,
  baUserId: string | undefined,
  ids: number[]
): Promise<Set<number>> {
  if (!baUserId || ids.length === 0) return new Set()
  const rows = (await strapi.documents(UPLOADS).findMany({
    filters: { baUserId: { $eq: baUserId }, fileId: { $in: ids } },
    limit: ids.length,
  })) as { fileId: number }[]

  return new Set(rows.map((r) => r.fileId))
}

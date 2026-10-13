export const atlasEnabled = (): boolean => process.env.ATLAS_ENABLED === "true"

type AtlasDirtyJob = {
  kind: "document" | "fanout"
  entityId: string
  payload?: Record<string, unknown>
}

/** Raw Knex writes explicitly join the content transaction supplied by Strapi. */
export async function enqueueAtlasJobs(
  strapi: any,
  jobs: AtlasDirtyJob[],
  trx?: any
): Promise<void> {
  if (!atlasEnabled() || jobs.length === 0) return
  if (jobs.length > 500) throw new RangeError("Atlas enqueue batch exceeds 500")
  const unique = new Map(
    jobs.map((job) => [
      `${job.kind}:${job.entityId}:${JSON.stringify(job.payload ?? {})}`,
      job,
    ])
  )
  const insert = (connection: any) =>
    connection("atlas_outbox").insert(
      [...unique.values()].map((job) => ({
        kind: job.kind,
        entity_id: job.entityId,
        payload: JSON.stringify(job.payload ?? {}),
      }))
    )
  await (trx
    ? insert(trx)
    : strapi.db.transaction(async ({ trx: transaction }: { trx: any }) =>
        insert(transaction)
      ))
}

export const enqueueAtlasLibrary = (
  strapi: any,
  documentId: string,
  trx?: any
): Promise<void> =>
  enqueueAtlasJobs(strapi, [{ kind: "document", entityId: documentId }], trx)

/** For derived writes which deliberately bypass Document Service. */
export async function withAtlasLibraryWrite<T>(
  strapi: any,
  documentIds: string[],
  write: () => Promise<T>
): Promise<T> {
  if (!atlasEnabled()) return write()

  return strapi.db.transaction(async ({ trx }: { trx: any }) => {
    const result = await write()
    await enqueueAtlasJobs(
      strapi,
      documentIds.map((entityId) => ({ kind: "document", entityId })),
      trx
    )

    return result
  })
}

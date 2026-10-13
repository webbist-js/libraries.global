import { atlasEnabled, enqueueAtlasJobs } from "../utils/atlas-outbox"

const LIBRARY = "api::library.library"
const NOTICE = "api::library-notice.library-notice"
const MUTATIONS = new Set([
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
  "discardDraft",
])
const FANOUT: Record<string, Record<string, string>> = {
  "api::continent.continent": { field: "continent_id" },
  "api::country.country": { field: "country_id" },
  "api::region.region": { field: "region_id" },
  "api::area.area": { field: "area_id" },
  "api::accessibility.accessibility": { optionKind: "access" },
  "api::service.service": { optionKind: "service" },
  "api::amenity.amenity": { optionKind: "amenity" },
}
const noticeLibrary = async (
  strapi: any,
  documentId: string | undefined
): Promise<string | null> => {
  if (!documentId) return null
  const row = await strapi
    .documents(NOTICE)
    .findOne({ documentId, populate: { library: { fields: ["documentId"] } } })

  return row?.library?.documentId ?? null
}

/** Enqueue only. No projection, fan-out scan, timer, index or tile CPU in CMS. */
export function registerAtlasOutboxMiddleware({
  strapi,
}: {
  strapi: any
}): void {
  strapi.documents.use(
    async (
      context: { uid: string; action: string; params?: any },
      next: () => Promise<any>
    ) => {
      if (
        !atlasEnabled() ||
        !MUTATIONS.has(context.action) ||
        !(
          context.uid === LIBRARY ||
          context.uid === NOTICE ||
          FANOUT[context.uid]
        )
      )
        return next()

      return strapi.db.transaction(async ({ trx }: { trx: any }) => {
        const beforeOwner =
          context.uid === NOTICE
            ? await noticeLibrary(strapi, context.params?.documentId)
            : null
        const result = await next()
        const id =
          context.params?.documentId ??
          result?.documentId ??
          result?.entries?.[0]?.documentId
        if (context.uid === LIBRARY && id)
          await enqueueAtlasJobs(
            strapi,
            [{ kind: "document", entityId: id }],
            trx
          )
        if (context.uid === NOTICE) {
          const afterOwner = await noticeLibrary(strapi, id)
          await enqueueAtlasJobs(
            strapi,
            [...new Set([beforeOwner, afterOwner].filter(Boolean))].map(
              (entityId) => ({ kind: "document", entityId })
            ),
            trx
          )
        }
        if (FANOUT[context.uid] && id)
          await enqueueAtlasJobs(
            strapi,
            [{ kind: "fanout", entityId: id, payload: FANOUT[context.uid] }],
            trx
          )

        return result
      })
    }
  )
}

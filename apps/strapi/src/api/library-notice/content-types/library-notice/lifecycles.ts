import {
  LIBRARY_NOTICE_UID,
  normalizeNotice,
  refreshNoticeEffects,
} from "../../../../utils/library-notices"

async function validate(event: any) {
  const current = event.params.where
    ? await strapi.db
        .query(LIBRARY_NOTICE_UID as any)
        .findOne({ where: event.params.where, populate: { library: true } })
    : null
  const data = event.params.data ?? {},
    rawLibrary = data.library ?? current?.library
  const documentId =
    typeof rawLibrary === "string"
      ? rawLibrary
      : (rawLibrary?.documentId ??
        rawLibrary?.connect?.[0]?.documentId ??
        rawLibrary?.set?.[0]?.documentId)
  let library = documentId
    ? await strapi.documents("api::library.library").findOne({ documentId })
    : null
  const relationId =
    typeof rawLibrary === "number"
      ? rawLibrary
      : (rawLibrary?.id ?? rawLibrary?.connect?.[0]?.id)
  if (!library && relationId)
    library = await strapi.db
      .query("api::library.library")
      .findOne({ where: { id: relationId } })
  if (!library) throw new Error("A library is required for a notice.")
  event.params.data = {
    ...data,
    ...normalizeNotice({ ...current, ...data }, library),
  }
  event.state = { libraryDocumentId: library.documentId }
}
const refresh = async (event: any) => {
  const id = event.state?.libraryDocumentId
  if (id)
    await strapi.db.transaction(async ({ onCommit }: any) => {
      onCommit(() => {
        refreshNoticeEffects(strapi, id).catch((e) =>
          strapi.log.warn("[notices] Refresh failed", e)
        )
      })
    })
}

export default {
  beforeCreate: validate,
  beforeUpdate: validate,
  afterCreate: refresh,
  afterUpdate: refresh,
}

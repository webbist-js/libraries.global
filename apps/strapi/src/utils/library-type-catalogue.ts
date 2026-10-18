import { DEFAULT_LIBRARY_TYPES } from "@repo/shared-data"
import { errors } from "@strapi/utils"

export const LIBRARY_TYPE = "api::library-type.library-type"

/** Resolve names from imports and native Strapi relation input against published types. */
export async function resolveLibraryType(strapi: any, value: any) {
  const refs = Array.isArray(value) ? value : (value?.set ?? value?.connect)
  if (refs && (!Array.isArray(refs) || refs.length !== 1))
    throw new errors.ValidationError("Choose one published library type")
  const ref = refs ? refs[0] : value
  const rowId = typeof ref === "number" ? ref : ref?.id
  const physical =
    typeof rowId === "number"
      ? await strapi.db
          .query(LIBRARY_TYPE)
          .findOne({ where: { id: rowId }, select: ["documentId"] })
      : null
  const filters =
    typeof ref === "string"
      ? { $or: [{ name: { $eq: ref } }, { documentId: { $eq: ref } }] }
      : physical?.documentId
        ? { documentId: physical.documentId }
        : typeof ref?.documentId === "string"
          ? { documentId: ref.documentId }
          : null
  if (!filters)
    throw new errors.ValidationError("Choose a published library type")
  const [type] = await strapi.documents(LIBRARY_TYPE).findMany({
    filters,
    status: "published",
    fields: ["documentId", "name"],
    limit: 1,
  })
  if (!type) throw new errors.ValidationError("Choose a published library type")

  return type
}

export async function seedLibraryTypes(strapi: any) {
  const docs = strapi.documents(LIBRARY_TYPE)
  for (const name of DEFAULT_LIBRARY_TYPES) {
    const [existing] = await docs.findMany({
      filters: { name: { $eqi: name } },
      status: "published",
      limit: 1,
    })
    if (!existing) await docs.create({ data: { name }, status: "published" })
  }
}

/** Accept existing import/form names at the write boundary; persist a real relation. */
export function registerLibraryTypeValidation(strapi: any) {
  strapi.documents.use(async (context: any, next: () => Promise<any>) => {
    if (
      context.uid === "api::library.library" &&
      ["create", "update"].includes(context.action) &&
      context.params?.data?.libraryType !== undefined
    ) {
      const value = context.params.data.libraryType
      // Content Manager sends this empty pair when the relation was untouched.
      if (
        context.action === "update" &&
        value &&
        !Array.isArray(value) &&
        value.set === undefined &&
        Array.isArray(value.connect) &&
        !value.connect.length &&
        (!value.disconnect ||
          (Array.isArray(value.disconnect) && !value.disconnect.length))
      ) {
        delete context.params.data.libraryType

        return next()
      }
      const type = await resolveLibraryType(strapi, value)
      context.params.data.libraryType = {
        set: [{ documentId: type.documentId }],
      }
    }

    return next()
  })
}

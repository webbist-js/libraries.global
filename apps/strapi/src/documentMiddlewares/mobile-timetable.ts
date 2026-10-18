import { libraryTypeName } from "@repo/shared-data"
import { errors } from "@strapi/utils"

import { resolveLibraryType } from "../utils/library-type-catalogue"
import {
  prepareMobileLibraryData,
  TimetableWriteError,
} from "../utils/mobile-timetable"

/** Applies the same validation to admin, API and approved submission writes. */
export function registerMobileTimetableMiddleware({
  strapi,
}: {
  strapi: any
}): void {
  strapi.documents.use(async (context: any, next: () => Promise<unknown>) => {
    if (
      context.uid !== "api::library.library" ||
      !["create", "update"].includes(context.action) ||
      !context.params?.data
    )
      return next()
    const data = { ...context.params.data }
    const mobileKeys = [
      "mobileTimetable",
      "homeLibrary",
      "mobileLibraries",
      "operatorName",
      "timetableUrl",
    ]
    if (
      ![...mobileKeys, "libraryType", "location", "timezone"].some((key) =>
        Object.prototype.hasOwnProperty.call(data, key)
      )
    )
      return next()
    const base = await strapi
      .plugin("i18n")
      .service("locales")
      .getDefaultLocale()
    const locale = context.params.locale ?? base
    if (locale !== base) {
      for (const key of mobileKeys) delete data[key]
      context.params.data = data

      return next()
    }
    const current = context.params.documentId
      ? await strapi.documents("api::library.library").findOne({
          documentId: context.params.documentId,
          locale,
          fields: ["documentId", "mobileTimetable", "location", "timezone"],
          populate: {
            libraryType: { fields: ["name"] },
            homeLibrary: { fields: ["documentId"] },
          },
        })
      : null
    const type =
      data.libraryType === undefined
        ? libraryTypeName(current?.libraryType)
        : typeof data.libraryType === "string"
          ? data.libraryType
          : (await resolveLibraryType(strapi, data.libraryType)).name
    if (
      type !== "Mobile" &&
      !Object.prototype.hasOwnProperty.call(data, "mobileTimetable")
    )
      return next()
    try {
      context.params.data = await prepareMobileLibraryData(
        strapi,
        data,
        current,
        locale
      )
    } catch (error) {
      if (error instanceof TimetableWriteError)
        throw new errors.ValidationError(error.message, { code: error.code })
      throw error
    }

    return next()
  })
}

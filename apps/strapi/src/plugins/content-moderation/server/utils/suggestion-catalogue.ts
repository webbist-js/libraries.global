import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { allDocuments } from "./documents-all"
import { OPTION_UIDS } from "./option-suggestions"
import { LIBRARY_TYPE } from "../../../../utils/library-type-catalogue"

/** An explicit published DTO; no API token or raw library relations are exposed. */
export async function suggestionCatalogue(
  strapi: any,
  requestedLocale: unknown
) {
  const locale = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE
  const uids = { ...OPTION_UIDS, library_types: LIBRARY_TYPE }
  const categories: Record<string, string[]> = {}
  const entries = await Promise.all(
    Object.entries(uids).map(async ([key, uid]) => {
      const localized =
        strapi.contentType(uid).pluginOptions?.i18n?.localized === true
      const read = (language: string) =>
        allDocuments(strapi, uid, {
          status: "published",
          ...(localized ? { locale: language } : {}),
          fields: ["name", "summary", "description", "category", "icon"],
        })
      const [original, translated] = await Promise.all([
        read(DEFAULT_LOCALE),
        localized && locale !== DEFAULT_LOCALE
          ? read(locale)
          : Promise.resolve([]),
      ])
      const rows = new Map(original.map((item) => [item.documentId, item]))
      for (const item of translated) rows.set(item.documentId, item)
      categories[key] = strapi.contentType(uid).attributes.category?.enum ?? []

      return [
        key,
        [...rows.values()]
          .map((item) => ({
            documentId: item.documentId,
            name: item.name,
            summary: item.summary ?? null,
            description: item.description ?? null,
            category: item.category ?? null,
            icon:
              typeof item.icon === "string"
                ? item.icon
                : item.icon?.iconName
                  ? { iconName: item.icon.iconName }
                  : null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, locale)),
      ]
    })
  )

  return { data: Object.fromEntries(entries), categories }
}

/** Refresh comparison names from published records; withdrawn references stay private. */
export async function publicComparisons<
  T extends {
    optionKey: keyof typeof OPTION_UIDS | "library_types"
    comparison?: {
      documentId: string
      name: string
      explanation: string
    } | null
  },
>(strapi: any, items: T[]): Promise<T[]> {
  const names = new Map<string, string>()
  const uids = { ...OPTION_UIDS, library_types: LIBRARY_TYPE }
  await Promise.all(
    Object.entries(uids).map(async ([key, uid]) => {
      const ids = items
        .filter((item) => item.optionKey === key && item.comparison)
        .map((item) => item.comparison!.documentId)
      if (!ids.length) return
      const rows = await allDocuments(strapi, uid, {
        status: "published",
        filters: { documentId: { $in: ids } },
        fields: ["name"],
      })
      for (const row of rows) names.set(`${key}:${row.documentId}`, row.name)
    })
  )

  return items.map((item) => {
    const name =
      item.comparison &&
      names.get(`${item.optionKey}:${item.comparison.documentId}`)

    return { ...item, comparison: name ? { ...item.comparison!, name } : null }
  })
}

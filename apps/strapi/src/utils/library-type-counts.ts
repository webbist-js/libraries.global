import type { Core } from "@strapi/strapi"

import librarySchema from "../api/library/content-types/library/schema.json"

const LIBRARY_TYPES = librarySchema.attributes.libraryType.enum as string[]

/**
 * Published-library counts per `libraryType` for one location, largest first,
 * zero counts dropped. Feeds programmatic copy and meta descriptions on the
 * continent / country / region pages.
 */
export async function countLibrariesByType(
  strapi: Core.Strapi,
  relation: "continent" | "country" | "region",
  documentId: string,
  opts: { locale?: string; status: "draft" | "published" }
): Promise<{ type: string; count: number }[]> {
  const counts = await Promise.all(
    LIBRARY_TYPES.map(async (type) => {
      try {
        const count = await strapi.documents("api::library.library").count({
          filters: {
            [relation]: { documentId: { $eq: documentId } },
            libraryType: { $eq: type },
          } as never,
          locale: opts.locale,
          status: opts.status,
        })

        return { type, count }
      } catch {
        return { type, count: 0 }
      }
    })
  )

  return counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)
}

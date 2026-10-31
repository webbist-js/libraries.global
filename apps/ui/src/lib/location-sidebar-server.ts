import "server-only"

import { cache } from "react"

import {
  meiliClient,
  searchLocaleFilter,
  type LibrarySearchHit,
} from "@/lib/meilisearch"

type Scope = "continent" | "country"

/** One small indexed preview, independent of editorial featured-library selection. */
export const sidebarLibraryPreview = cache(
  async (
    level: Scope,
    slug: string,
    locale: string
  ): Promise<LibrarySearchHit[]> => {
    try {
      const result = await meiliClient
        .index("library")
        .search<LibrarySearchHit>("", {
          filter: `${level}_slug = ${JSON.stringify(slug)} AND ${searchLocaleFilter(locale)}`,
          limit: 6,
          sort: ["featured:desc", "name:asc"],
          attributesToRetrieve: [
            "documentId",
            "name",
            "slug",
            "continent_slug",
            "continent_name",
            "country_slug",
            "country_name",
            "region_slug",
            "region_name",
          ],
        })

      return result.hits
    } catch {
      return []
    }
  }
)

import "server-only"

import {
  emptyArticleFacets,
  articleBrowseSearchParams,
  type ArticleBrowseQuery,
  type ArticleBrowseResult,
} from "@repo/shared-data"
import { cache } from "react"

import { PublicStrapiClient } from "@/lib/strapi-api"

/** One cached public CMS read for items, count and every facet. */
export const fetchArticleBrowse = cache(
  async (
    kind: "blog" | "wiki",
    encodedQuery: string
  ): Promise<ArticleBrowseResult> => {
    const params = Object.fromEntries(new URLSearchParams(encodedQuery))

    return PublicStrapiClient.fetchAPI(
      `/${kind === "blog" ? "blog" : "wiki"}-articles/browse`,
      params,
      {
        ...(params.groupBy === "document"
          ? { cache: "no-store" as const }
          : {}),
        next: {
          tags: [
            "user-profile",
            "country",
            "continent",
            "region",
            "area",
            "library",
            "topic",
            "blog-section",
            "wiki-section",
          ],
        },
      }
    ) as Promise<ArticleBrowseResult>
  }
)

export const articleBrowseParams = articleBrowseSearchParams

export function emptyArticleBrowse(
  query: ArticleBrowseQuery
): ArticleBrowseResult {
  return {
    items: [],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: 0,
    facets: emptyArticleFacets(),
    editorialItems: [],
    editorPick: null,
    appliedFilters: query.filters,
  }
}

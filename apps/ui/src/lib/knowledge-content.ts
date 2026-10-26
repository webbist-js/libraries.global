import "server-only"

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import type { Locale } from "next-intl"

import {
  articleBrowseParams,
  fetchArticleBrowse,
} from "@/lib/article-discovery"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type { WikiArticleDetail } from "@/lib/strapi-api/content/server"
import type { APIResponse } from "@/types/api"

/** Exports always read the publication, including for a browser in preview mode. */
export async function fetchPublishedKnowledgeArticle(
  slug: string,
  locale: Locale,
  contentLanguage: string | null
): Promise<{ article: WikiArticleDetail; locale: string } | null> {
  const requested = contentLanguage ?? locale
  const inLocale = async (language: string) => {
    const response = (await PublicStrapiClient.fetchAPI(
      `/wiki-articles/detail/${encodeURIComponent(slug)}`,
      { locale: language as Locale, status: "published" }
    )) as APIResponse<WikiArticleDetail>

    return response.data?.publishedAt ? response.data : null
  }
  const article = await inLocale(requested)
  if (article) return { article, locale: requested }
  if (contentLanguage || requested === DEFAULT_LOCALE) return null
  const fallback = await inLocale(DEFAULT_LOCALE)

  return fallback ? { article: fallback, locale: DEFAULT_LOCALE } : null
}

/** Page the public, body-free catalogue across all supported content languages. */
export async function fetchKnowledgeCatalogue(): Promise<ArticleBrowseItem[]> {
  const articles: ArticleBrowseItem[] = []
  const seen = new Set<string>()
  const pageSize = 50
  const maximum = 10_000
  let total: number | undefined
  for (let page = 1; page <= maximum / pageSize; page++) {
    const result = await fetchArticleBrowse(
      "wiki",
      articleBrowseParams({
        filters: {},
        sort: "title",
        page,
        pageSize,
      })
    )
    if (
      !Array.isArray(result.items) ||
      result.page !== page ||
      result.pageSize !== pageSize ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      result.total > maximum ||
      (total !== undefined && total !== result.total) ||
      result.items.length !== Math.min(pageSize, result.total - articles.length)
    )
      throw new Error("Invalid Knowledge catalogue page")
    total = result.total
    for (const item of result.items) {
      const key = `${item.documentId}:${item.locale}`
      if (
        !item.publishedAt ||
        !item.slug ||
        !isSupportedLocale(item.locale) ||
        seen.has(key)
      )
        throw new Error("Invalid Knowledge catalogue article")
      seen.add(key)
      articles.push(item)
    }
    if (articles.length === total) return articles
  }
  throw new Error("Knowledge catalogue exceeds the discovery limit")
}

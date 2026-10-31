import type { ArticleBrowseItem, ArticleBrowseResult } from "@repo/shared-data"

import type { ArticleKind } from "@/components/contribute/article-editor/article.types"
import { fetchJournalOwnership } from "@/lib/use-journal-ownership"

export type EditableArticle = {
  kind: ArticleKind
  documentId: string
  slug: string
  title: string
  sections: string[]
  publishedAt: string | null
  updatedAt: string | null
  locale?: string
  publicPath?: string
  canEdit?: boolean
  owned?: boolean
  contributorCount?: number
  translations?: { locale: string; slug: string; title: string }[]
}

export function catalogueItem(
  kind: ArticleKind,
  item: ArticleBrowseItem,
  known: readonly EditableArticle[]
): EditableArticle {
  const prior = known.find(
    (article) =>
      article.kind === kind &&
      article.documentId === item.documentId &&
      article.locale === item.locale
  )

  return {
    ...prior,
    kind,
    documentId: item.documentId,
    slug: item.slug,
    title: item.title,
    locale: item.locale,
    translations: item.translations,
    sections: item.facets.sections?.map((section) => section.label) ?? [],
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    publicPath: `/${kind === "journal" ? "journal" : "knowledge"}/${item.section?.slug ?? item.sectionSlugs[0] ?? "general"}/${item.slug}`,
  }
}

/** One row per document, including when a cached response still has separate languages. */
export function uniqueArticles(
  articles: readonly EditableArticle[],
  preferred: string
): EditableArticle[] {
  const groups = new Map<string, EditableArticle>()
  for (const article of articles) {
    const key = `${article.kind}:${article.documentId}`
    const prior = groups.get(key)
    const variants = [
      ...(prior?.translations ?? []),
      ...(article.translations ?? [
        {
          locale: article.locale ?? "en",
          slug: article.slug,
          title: article.title,
        },
      ]),
    ]
    const translations = [
      ...new Map(variants.map((item) => [item.locale, item])).values(),
    ]
    const chosen = !prior || article.locale === preferred ? article : prior
    groups.set(key, { ...chosen, translations })
  }

  return [...groups.values()].sort(
    (a, b) =>
      (b.updatedAt ?? b.publishedAt ?? "").localeCompare(
        a.updatedAt ?? a.publishedAt ?? ""
      ) || a.title.localeCompare(b.title)
  )
}

export async function fetchCatalogue({
  kinds,
  locale,
  query,
  missing,
  page,
  known,
  signal,
}: {
  kinds: readonly ArticleKind[]
  locale: string
  query: string
  missing: boolean
  page: number
  known: readonly EditableArticle[]
  signal?: AbortSignal
}) {
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const params = new URLSearchParams({
        groupBy: "document",
        preferredLocale: locale === "all" ? "en" : locale,
        pageSize: "12",
        page: String(page),
        collection: "all",
      })
      if (query) params.set("q", query)
      if (missing && locale !== "all") params.set("missingLocale", locale)
      const response = await fetch(
        `/api/public-proxy/api/${kind === "journal" ? "blog" : "wiki"}-articles/browse?${params}`,
        { signal }
      )
      if (!response.ok) throw new Error("Catalogue unavailable")
      const result = (await response.json()) as ArticleBrowseResult

      return {
        items: result.items.map((item) => catalogueItem(kind, item, known)),
        total: result.total ?? result.items.length,
        pageCount: result.pageCount ?? 1,
      }
    })
  )

  return {
    items: uniqueArticles(
      results.flatMap((result) => result.items),
      locale
    ),
    total: results.reduce((sum, result) => sum + result.total, 0),
    pageCount: Math.max(1, ...results.map((result) => result.pageCount)),
    page,
  }
}

/** Search successive published pages until there is a page of proven own stories. */
export async function fetchOwnCatalogue(
  input: Omit<Parameters<typeof fetchCatalogue>[0], "kinds">
) {
  const items: EditableArticle[] = []
  let page = input.page
  let data: Awaited<ReturnType<typeof fetchCatalogue>>
  do {
    data = await fetchCatalogue({ ...input, kinds: ["journal"], page })
    const unknown = data.items.filter((item) => item.owned === undefined)
    const ownership = await fetchJournalOwnership(
      unknown.map((item) => item.slug),
      input.signal
    )
    items.push(
      ...data.items
        .filter((item) => item.owned || ownership[item.slug])
        .map((item) => ({ ...item, owned: true }))
    )
    page += 1
  } while (items.length < 12 && data.page < data.pageCount)

  return { ...data, items }
}

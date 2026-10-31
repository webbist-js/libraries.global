import { parseArticleBrowseQuery } from "@repo/shared-data"
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { toDocsSections } from "@/components/docs/docs.config"
import DocsPage from "@/components/docs/DocsPage"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { knowledgeBrowseParams } from "@/lib/article-filter-state"
import { getPreferredContentLanguage } from "@/lib/content-language-server"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
  fetchWikiLanding,
  fetchWikiSections,
} from "@/lib/strapi-api/content/server"

export const revalidate = 300
type KnowledgeSearchParams = Record<string, string | string[] | undefined>

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<KnowledgeSearchParams>
}): Promise<Metadata> {
  const { locale } = await params
  const search: KnowledgeSearchParams = await (searchParams ??
    Promise.resolve({}))
  const query = parseArticleBrowseQuery(search)
  const [tUi, tArticle] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "ui" }),
    getTranslations({ locale: locale as Locale, namespace: "editorial" }),
  ])

  return buildMetadata({
    title: tUi("knowledge"),
    description: tArticle("knowledgeDescription", { site: SITE_NAME }),
    path: "knowledge",
    locale,
    robots:
      Object.keys(query.filters).length ||
      query.page > 1 ||
      query.q ||
      search.lang === "all"
        ? "noindex-follow"
        : "index",
  })
}

export default async function DocsRoute(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<KnowledgeSearchParams>
}) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const locale = params.locale as Locale
  setRequestLocale(locale)

  const query = parseArticleBrowseQuery(searchParams)
  const defaultLanguage =
    query.filters.languages?.length || searchParams.lang === "all"
      ? locale
      : await getPreferredContentLanguage(locale)
  const browseParams = knowledgeBrowseParams(
    locale,
    searchParams,
    defaultLanguage
  )
  const contentLocale = query.filters.languages?.[0] ?? defaultLanguage
  const [articlesRes, sectionsRes, landingRes, discovery] = await Promise.all([
    fetchDocsWikiArticles(contentLocale as Locale),
    fetchWikiSections(locale as Locale),
    fetchWikiLanding(locale),
    fetchArticleBrowse("wiki", browseParams),
  ])

  return (
    <DocsPage
      articles={articlesRes?.data ?? []}
      locale={locale}
      contentLocale={contentLocale}
      landing={landingRes?.data}
      quickStartCards={landingRes?.data?.quickStartCards}
      sections={toDocsSections(sectionsRes.data)}
      discovery={discovery}
      queryActive={Boolean(
        query.q ||
        Object.keys(query.filters).length ||
        searchParams.lang === "all" ||
        query.page > 1 ||
        query.sort !== "newest"
      )}
      searchQuery={query.q ?? ""}
      currentQuery={searchParams}
    />
  )
}

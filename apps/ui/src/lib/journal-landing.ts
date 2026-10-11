import "server-only"

import type { Locale } from "next-intl"

import {
  JOURNAL_PAGE_SIZE,
  journalSortParam,
  placeLabel,
  resolveJournalLanguage,
  type JournalQuery,
} from "@/components/blog/journalLanding.helpers"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { estimateReadingTime } from "@/lib/article-helpers"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
import {
  countJournalArticles,
  fetchBlogLanding,
  fetchBlogSections,
  fetchJournalArticles,
  type BlogLandingData,
  type BlogSection,
  type JournalArticleItem,
} from "@/lib/strapi-api/content/server"

/** A Journal article as its cards need it. */
export type JournalCardData = Omit<JournalArticleItem, "body" | "libraries"> & {
  readMinutes: number
  /** "Radlett, England", from the first linked library, or null. */
  place: string | null
}

export type JournalSectionWithCount = BlogSection & { count: number }

export type JournalLandingData = JournalTopStories & {
  landing: BlogLandingData | null
  /** The URL state, with an unknown section dropped. */
  query: JournalQuery
  /** The language the articles are shown in. */
  lang: string
  /** Locale for article links: `lang` when the site routes it, else the page's. */
  linkLocale: Locale
  /** Set when the page's own locale has no articles and English stands in. */
  fallbackFrom: string | null
  languages: { code: string; name: string }[]
  /** Sections with at least one article in `lang`, in Strapi's order. */
  sections: JournalSectionWithCount[]
  total: number
  list: {
    items: JournalCardData[]
    total: number
    page: number
    pageCount: number
  }
  mostRead: JournalCardData[]
}

function toCard(article: JournalArticleItem): JournalCardData {
  const { body, libraries, ...rest } = article

  return {
    ...rest,
    readMinutes: estimateReadingTime(body),
    place: placeLabel(libraries),
  }
}

/**
 * The month's most-read Journal articles. Nothing counts reads yet: this is
 * the placeholder for Vercel Web Analytics data (top /journal/* pages over
 * the last 30 days), see .scratch/journal-landing/issues/01-most-read.md.
 */
export async function fetchMostReadJournalArticles(
  _lang: string
): Promise<JournalCardData[]> {
  return []
}

export type JournalTopStories = {
  featured: JournalCardData | null
  editorsPick: boolean
  sideStories: JournalCardData[]
}

/** The newest Journal articles, enough for the lead story and two beside it. */
function fetchNewestJournalArticles(locale: Locale) {
  return fetchJournalArticles({
    locale,
    sort: journalSortParam("newest"),
    page: 1,
    pageSize: 3,
  })
}

/** Editors pick the lead story on the landing single type; else the newest.
 * The side stories are the newest of the rest. */
async function pickTopStories(
  locale: Locale,
  newest: JournalArticleItem[],
  pickId: string | null
): Promise<JournalTopStories> {
  let featuredItem: JournalArticleItem | null = null
  if (pickId) {
    featuredItem =
      newest.find((a) => a.documentId === pickId) ??
      (
        await fetchJournalArticles({
          locale,
          documentIds: [pickId],
          sort: journalSortParam("newest"),
          page: 1,
          pageSize: 1,
        })
      ).data[0] ??
      null
  }
  featuredItem ??= newest[0] ?? null
  const featured = featuredItem ? toCard(featuredItem) : null

  return {
    featured,
    editorsPick:
      !!featured && (featured.documentId === pickId || !!featured.featured),
    sideStories: newest
      .filter((a) => a.documentId !== featured?.documentId)
      .slice(0, 2)
      .map(toCard),
  }
}

/** The Journal landing's top stories in `locale`, for the homepage. */
export async function loadJournalTopStories(
  locale: Locale
): Promise<JournalTopStories> {
  const [landingRes, newest] = await Promise.all([
    fetchBlogLanding(locale),
    fetchNewestJournalArticles(locale),
  ])

  return pickTopStories(
    locale,
    newest.data,
    landingRes?.data?.featuredArticle?.documentId ?? null
  )
}

export async function loadJournalLanding(
  routeLocale: Locale,
  query: JournalQuery
): Promise<JournalLandingData> {
  const [configuredLocales, sectionsRes] = await Promise.all([
    fetchArticleLocales(),
    fetchBlogSections(routeLocale),
  ])

  // Languages with at least one article; a handful of locales at most.
  const localeCounts = await Promise.all(
    configuredLocales.map(
      async (l) => [l.code, await countJournalArticles(l.code)] as const
    )
  )
  const languages = localeCounts
    .filter(([, count]) => count > 0)
    .map(([code]) => ({ code, name: languageName(code, configuredLocales) }))

  const lang = resolveJournalLanguage({
    requested: query.lang,
    available: languages.map((l) => l.code),
    routeLocale,
    defaultLocale: routing.defaultLocale,
  })
  const total = localeCounts.find(([code]) => code === lang)?.[1] ?? 0
  const linkLocale = (routing.locales as readonly string[]).includes(lang)
    ? (lang as Locale)
    : routeLocale

  const allSections = sectionsRes?.data ?? []
  const section = allSections.some((s) => s.slug === query.section)
    ? query.section
    : null
  const resolvedQuery: JournalQuery = { ...query, section }

  const [landingRes, sectionCounts, top, list, mostRead] = await Promise.all([
    fetchBlogLanding(lang as Locale),
    Promise.all(allSections.map((s) => countJournalArticles(lang, s.slug))),
    fetchNewestJournalArticles(lang as Locale),
    fetchJournalArticles({
      locale: lang as Locale,
      section,
      sort: journalSortParam(query.sort),
      page: query.page,
      pageSize: JOURNAL_PAGE_SIZE,
    }),
    fetchMostReadJournalArticles(lang),
  ])
  const landing = landingRes?.data ?? null
  const topStories = await pickTopStories(
    lang as Locale,
    top.data,
    landing?.featuredArticle?.documentId ?? null
  )

  return {
    landing,
    query: resolvedQuery,
    lang,
    linkLocale,
    fallbackFrom: lang !== routeLocale && !query.lang ? routeLocale : null,
    languages,
    sections: allSections
      .map((s, i) => ({ ...s, count: sectionCounts[i] ?? 0 }))
      .filter((s) => s.count > 0),
    total,
    ...topStories,
    list: {
      items: list.data.map(toCard),
      total: list.meta.pagination.total,
      page: query.page,
      pageCount: list.meta.pagination.pageCount,
    },
    mostRead,
  }
}

import "server-only"

import type { ArticleBrowseItem, ArticleBrowseResult } from "@repo/shared-data"
import type { Locale } from "next-intl"

import {
  journalBrowseParams,
  type JournalQuery,
} from "@/components/blog/journalLanding.helpers"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
import {
  fetchBlogLanding,
  fetchBlogSections,
  type BlogLandingData,
  type BlogSection,
} from "@/lib/strapi-api/content/server"

/** Cards carry public metadata and a reading-time scalar, never article bodies. */
export type JournalCardData = ArticleBrowseItem & { readMinutes: number }
export type JournalSectionWithCount = BlogSection & { count: number }
export type JournalTopStories = {
  featured: JournalCardData | null
  editorsPick: boolean
  sideStories: JournalCardData[]
}
export type JournalLandingData = JournalTopStories & {
  landing: BlogLandingData | null
  query: JournalQuery
  lang: string
  linkLocale: Locale
  fallbackFrom: string | null
  languages: { code: string; name: string }[]
  sections: JournalSectionWithCount[]
  total: number
  list: {
    items: JournalCardData[]
    total: number
    page: number
    pageCount: number
  }
  mostRead: JournalCardData[]
  discovery: ArticleBrowseResult
  communityPick: JournalCardData | null
}
const toCard = (article: ArticleBrowseItem): JournalCardData => ({
  ...article,
  readMinutes: article.readingTimeMinutes,
})

/** No fabricated popularity metric until reads are measured. */
export async function fetchMostReadJournalArticles(
  _lang: string
): Promise<JournalCardData[]> {
  return []
}

function topStories(
  items: ArticleBrowseItem[],
  pickId: string | null
): JournalTopStories {
  const chosen =
    items.find((item) => item.documentId === pickId) ?? items[0] ?? null

  return {
    featured: chosen ? toCard(chosen) : null,
    editorsPick: !!chosen && (chosen.documentId === pickId || chosen.featured),
    sideStories: items
      .filter((item) => item !== chosen)
      .slice(0, 2)
      .map(toCard),
  }
}

export async function loadJournalTopStories(
  locale: Locale
): Promise<JournalTopStories> {
  const [landing, browse] = await Promise.all([
    fetchBlogLanding(locale),
    fetchArticleBrowse(
      "blog",
      `preferredLocale=${encodeURIComponent(locale)}&origin=index&pageSize=3`
    ),
  ])

  return topStories(
    browse.editorialItems,
    landing?.data?.featuredArticle?.documentId ?? null
  )
}

export async function loadJournalLanding(
  routeLocale: Locale,
  query: JournalQuery
): Promise<JournalLandingData> {
  const [initialDiscovery, sectionsRes, landingRes] = await Promise.all([
    fetchArticleBrowse("blog", journalBrowseParams(routeLocale, query)),
    fetchBlogSections(routeLocale),
    fetchBlogLanding(routeLocale),
  ])
  const section = sectionsRes.data.some(
    (section) => section.slug === query.section
  )
    ? query.section
    : null
  const discovery =
    query.section && !section
      ? await fetchArticleBrowse(
          "blog",
          journalBrowseParams(routeLocale, { ...query, section: null })
        )
      : initialDiscovery
  const lang = query.lang ?? discovery.appliedFilters.languages?.[0] ?? "all"
  const linkLocale = (routing.locales as readonly string[]).includes(lang)
    ? (lang as Locale)
    : routeLocale
  const sections = sectionsRes.data
    .map((section) => ({
      ...section,
      count:
        discovery.facets.sections.find((facet) => facet.value === section.slug)
          ?.count ?? 0,
    }))
    .filter((section) => section.count > 0)
  const total = discovery.facets.sections.reduce(
    (sum, facet) => sum + facet.count,
    0
  )
  const landing = landingRes?.data ?? null
  const stories = topStories(
    discovery.editorialItems,
    landing?.featuredArticle?.documentId ?? null
  )

  return {
    landing,
    query: { ...query, section },
    lang,
    linkLocale,
    fallbackFrom:
      lang !== routeLocale && lang !== "all" && !query.lang
        ? routeLocale
        : null,
    languages: discovery.facets.languages.map((facet) => ({
      code: facet.value,
      name: languageName(facet.value),
    })),
    sections,
    total,
    ...stories,
    list: {
      items: discovery.items.map(toCard),
      total: discovery.total,
      page: discovery.page,
      pageCount: discovery.pageCount,
    },
    mostRead: [],
    discovery,
    communityPick:
      discovery.editorPick?.publicationOrigin === "community"
        ? toCard(discovery.editorPick)
        : null,
  }
}

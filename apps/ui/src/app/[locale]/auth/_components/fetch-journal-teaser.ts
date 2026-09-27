import "server-only"

import type { Locale } from "next-intl"

import { fetchRecentBlogArticles } from "@/lib/strapi-api/content/server"

import type { JournalTeaser } from "./AuthLeftPanel"

/** The newest journal article for the auth panel, or null if there is none. */
export async function fetchJournalTeaser(
  locale: Locale
): Promise<JournalTeaser | null> {
  const { data } = await fetchRecentBlogArticles(locale)
  const article = data?.[0]
  if (!article?.title || !article.slug) return null

  return {
    title: article.title,
    href: `/blog/${article.section?.slug ?? "general"}/${article.slug}`,
  }
}

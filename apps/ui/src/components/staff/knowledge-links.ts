import "server-only"

import type { Locale } from "next-intl"

import { docsArticlePath } from "@/components/docs/docs.config"
import { fetchWikiArticle } from "@/lib/strapi-api/content/server"

/**
 * The Knowledge articles the staff section points at, by the slug the
 * source files in `docs/knowledge/` carry. A slug that isn't published
 * yet simply renders no link (`knowledgeHref` answers null), so a page
 * never links to a 404.
 */
export const KNOWLEDGE_SLUGS = {
  staffArea: "staff-area",
  goingLive: "going-live-from-your-phone",
  timetable: "adding-a-mobile-library-timetable",
  teams: "teams-for-library-services",
  plans: "plans-and-staff-access",
  contribute: "how-to-contribute",
} as const

export type KnowledgeSlug =
  (typeof KNOWLEDGE_SLUGS)[keyof typeof KNOWLEDGE_SLUGS]

/**
 * A Knowledge article's public path and title, or null when it isn't
 * published in this locale (the fetch falls back to the default locale).
 * Same resolver as `contribute/knowledge/apply`.
 */
export async function knowledgeLink(
  slug: string,
  locale: Locale
): Promise<{ href: string; title: string } | null> {
  try {
    const res = await fetchWikiArticle(slug, locale)
    const article = res?.data
    if (!article?.slug) return null

    return {
      href: docsArticlePath(article),
      title: article.title ?? slug,
    }
  } catch {
    return null
  }
}

/** The path alone, for callers that have their own copy. */
export async function knowledgeHref(
  slug: string,
  locale: Locale
): Promise<string | null> {
  return (await knowledgeLink(slug, locale))?.href ?? null
}

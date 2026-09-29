import "server-only"

import type { Locale } from "next-intl"

import type {
  ArticleKind,
  ArticleLocale,
  ArticleTag,
  ExistingArticle,
} from "@/components/contribute/article-editor/article.types"
import { docsSectionForArticle } from "@/components/docs/docs.config"
import {
  type ArticleForEditing,
  fetchArticleForEditing,
} from "@/lib/strapi-api/content/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** Strapi's configured locales; English alone when the bridge is down. */
export async function fetchArticleLocales(): Promise<ArticleLocale[]> {
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/locales`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(String(res.status))
    const json = (await res.json()) as { data?: ArticleLocale[] }
    const locales = (json.data ?? []).filter((l) => l.code && l.name)
    if (locales.length > 0) return locales
  } catch {
    // fall through
  }

  return [{ code: "en", name: "English", isDefault: true }]
}

/** An article as fetched, in the editor's shape. */
export function toExistingArticle(
  kind: ArticleKind,
  article: ArticleForEditing,
  locale: string
): ExistingArticle {
  const tags: ArticleTag[] = [
    ...(article.topics ?? []).flatMap((t) =>
      t.name
        ? [
            {
              kind: "topic" as const,
              label: t.name,
              slug: t.slug ?? undefined,
              documentId: t.documentId,
            },
          ]
        : []
    ),
    ...(article.libraries ?? []).flatMap((l) =>
      l.name
        ? [
            {
              kind: "library" as const,
              label: l.name,
              slug: l.slug ?? undefined,
              documentId: l.documentId,
            },
          ]
        : []
    ),
  ]
  const docsSections = Array.isArray(article.docsSections)
    ? article.docsSections.filter((k): k is string => typeof k === "string")
    : []
  const sections =
    kind === "knowledge"
      ? docsSections.length > 0
        ? docsSections
        : [
            docsSectionForArticle({
              documentId: article.documentId,
              title: article.title,
              slug: article.slug,
              section: null,
              category: null,
            }),
          ]
      : article.section?.slug
        ? [article.section.slug]
        : []

  return {
    documentId: article.documentId,
    slug: article.slug,
    locale: article.locale ?? locale,
    title: article.title ?? "",
    summary: article.summary ?? "",
    body: Array.isArray(article.body) ? article.body : [],
    sections,
    tags,
    availableLocales: [
      article.locale ?? locale,
      ...(article.localizations ?? []).flatMap((l) =>
        l.locale ? [l.locale] : []
      ),
    ],
  }
}

/** Loads an article for the editor, or null when it isn't published in this locale. */
export async function loadArticleForEditor(
  kind: ArticleKind,
  slug: string,
  locale: Locale
): Promise<ExistingArticle | null> {
  const article = await fetchArticleForEditing(kind, slug, locale)

  return article ? toExistingArticle(kind, article, locale) : null
}

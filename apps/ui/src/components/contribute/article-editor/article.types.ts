import type { Capability } from "@repo/access"
import { type ArticleSource, isSupportedLocale } from "@repo/shared-data"

import type { TiptapDoc } from "./articleBlocks"

export type ArticleKind = "knowledge" | "journal"

export type ArticleTag = {
  kind:
    | "topic"
    | "library"
    | "continent"
    | "country"
    | "region"
    | "area"
    | "event"
  label: string
  slug?: string
  documentId?: string
}

export type ArticleEventMention = {
  citationId?: string
  title: string
  startTime?: string | null
  endTime?: string | null
  timezone?: string | null
  url?: string | null
  libraryDocumentId?: string | null
  /** Display label only; the server always resolves libraryDocumentId itself. */
  libraryName?: string | null
  eventDocumentId?: string | null
}

export type ArticleLocale = { code: string; name: string; isDefault: boolean }

/** What the editor holds while you write. */
export type ArticleDraft = {
  title: string
  summary: string
  doc: TiptapDoc
  /** Knowledge: docs section keys, first is home. Journal: one blog-section slug. */
  sections: string[]
  tags: ArticleTag[]
  editSummary: string
  sources?: ArticleSource[]
  eventMentions?: ArticleEventMention[]
  /** New Journal stories only; author identity stays unchanged on edits. */
  byline?: string
  origin?: "community" | "index"
}

/** A published article the editor opens, in one locale. */
export type ExistingArticle = {
  documentId: string
  slug: string
  locale: string
  title: string
  summary: string
  body: unknown
  sections: string[]
  tags: ArticleTag[]
  /** Locales this article already exists in (published). */
  availableLocales: string[]
  baseRevision?: string
  publishedAt?: string | null
  updatedAt?: string | null
  sources?: ArticleSource[]
  eventMentions?: ArticleEventMention[]
}

export const ARTICLE_KIND_META: Record<
  ArticleKind,
  {
    label: string
    plural: string
    submissionType: "wiki_edit" | "blog_submission"
    targetEntityType: "wiki_article" | "blog_article"
    capability: Capability
    icon: string
    tintBg: string
    tintFg: string
    /** Path of the public section, for "view" links. */
    publicPath: string
    editPath: (slug: string) => string
  }
> = {
  knowledge: {
    label: "Knowledge article",
    plural: "Knowledge articles",
    submissionType: "wiki_edit",
    targetEntityType: "wiki_article",
    capability: "docs.directEdit",
    icon: "mdi:book-open-page-variant-outline",
    tintBg: "var(--tint-academic-bg)",
    tintFg: "var(--tint-academic-fg)",
    publicPath: "/knowledge",
    editPath: (slug) => `/contribute/knowledge/${encodeURIComponent(slug)}`,
  },
  journal: {
    label: "Journal article",
    plural: "Journal articles",
    submissionType: "blog_submission",
    targetEntityType: "blog_article",
    capability: "journal.directEdit",
    icon: "mdi:newspaper-variant-outline",
    tintBg: "var(--tint-special-bg)",
    tintFg: "var(--tint-special-fg)",
    publicPath: "/journal",
    editPath: (slug) =>
      `/contribute/knowledge/journal/${encodeURIComponent(slug)}`,
  },
}

export function isArticleKind(v: unknown): v is ArticleKind {
  return v === "knowledge" || v === "journal"
}

/** A `?locale=` value must be enabled in the CMS and supported by app routes. */
export function editingLocaleFrom(
  requested: unknown,
  locales: readonly ArticleLocale[]
): string | undefined {
  return isSupportedLocale(requested) &&
    locales.some((l) => l.code === requested)
    ? requested
    : undefined
}

export const EMPTY_DOC: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

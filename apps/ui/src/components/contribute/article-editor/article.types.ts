import type { Capability } from "@repo/access"

import type { TiptapDoc } from "./articleBlocks"

export type ArticleKind = "knowledge" | "journal"

export type ArticleTag = {
  kind: "topic" | "library" | "place" | "free"
  label: string
  slug?: string
  documentId?: string
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

export const EMPTY_DOC: TiptapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

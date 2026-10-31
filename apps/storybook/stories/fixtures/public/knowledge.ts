import type { DocsSection } from "@/components/docs/docs.config"
import type { DocsTree } from "@/components/docs/DocsSidebarTree"
import type {
  DocsWikiArticle,
  WikiArticleDetail,
  ArticleHistoryItem,
  LegalDocumentDetail,
} from "@/lib/strapi-api/content/server"

import { articleBody } from "./articles"

export const knowledgeSections: DocsSection[] = [
  {
    documentId: "example-contributing",
    slug: "contributing",
    title: "Contributing",
    description: "Help keep the library index useful and accurate.",
    icon: "mdi:pencil-outline",
    order: 1,
    tintBg: "var(--t-accent-chip)",
    tintFg: "var(--t-accent-primary)",
  },
  {
    documentId: "example-library-practice",
    slug: "library-practice",
    title: "Library practice",
    description: "Ideas and guidance shared by library staff.",
    icon: "mdi:bookshelf",
    order: 2,
    tintBg: "var(--t-palette-mint-soft)",
    tintFg: "var(--t-palette-mint-fg)",
  },
]
export const wikiArticle: WikiArticleDetail = {
  documentId: "example-guide",
  title: "Keep opening hours up to date",
  slug: "keep-opening-hours-up-to-date",
  summary: "How to confirm a regular library schedule using public sources.",
  author: "Maya S.",
  publishedAt: "2026-01-15T12:00:00Z",
  updatedAt: "2026-01-16T12:00:00Z",
  articleStatus: "stable",
  section: {
    documentId: "example-contributing",
    name: "Contributing",
    slug: "contributing",
  },
  docsSections: ["contributing"],
  body: articleBody,
  availableLocales: ["en", "fr"],
  contributors: [{ documentId: "example-author", username: "example-maya" }],
}
export const wikiArticles: DocsWikiArticle[] = [
  wikiArticle,
  {
    ...wikiArticle,
    documentId: "example-guide-2",
    title: "Describe an accessible entrance",
    slug: "describe-an-accessible-entrance",
  },
]
export const knowledgeTree: DocsTree = {
  contributing: wikiArticles.map((article, index) => ({
    documentId: article.documentId,
    title: article.title!,
    href: `/knowledge/contributing/${article.slug}`,
    active: index === 0,
  })),
}
export const knowledgeRows = [
  {
    section: knowledgeSections[0]!,
    rows: wikiArticles.map((article) => ({
      documentId: article.documentId,
      title: article.title!,
      href: `/knowledge/contributing/${article.slug}`,
      summary: article.summary ?? null,
      updatedLabel: "15 January 2026",
      readMinutes: 5,
    })),
  },
]
export const articleHistory: ArticleHistoryItem[] = [
  {
    changedAt: "2026-01-15T12:00:00Z",
    kind: "created",
    locale: "en",
    actor: { kind: "contributor", username: "example-maya" },
    editSummary: "Added the first public-source guide.",
  },
  {
    changedAt: "2026-01-16T12:00:00Z",
    kind: "edited",
    locale: "en",
    actor: { kind: "contributor", username: "example-ben" },
    editSummary: "Clarified how to record split opening sessions.",
  },
]
export const legalDocument: LegalDocumentDetail = {
  documentId: "example-privacy",
  title: "Privacy notice",
  navLabel: "Privacy",
  slug: "privacy",
  heroTitle: "Your information",
  lead: "A synthetic policy example for reviewing the document layout.",
  updatedAt: "2026-01-15T12:00:00Z",
  summaryPoints: [
    { id: 1, text: "Your profile visibility is your choice." },
    { id: 2, text: "Account changes are handled through your settings." },
  ],
  sections: [
    {
      id: 1,
      heading: "Your choices",
      inShort: "Choose what is visible on your profile.",
      body: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "This demonstration is synthetic and does not replace the published policy.",
            },
          ],
        },
      ],
    },
  ],
  revisions: [
    {
      id: 1,
      version: "1.0",
      date: "2026-01-15",
      summary: "First published version of this synthetic example.",
    },
  ],
}

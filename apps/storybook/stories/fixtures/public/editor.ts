import type {
  ArticleDraft,
  ArticleLocale,
  ExistingArticle,
} from "@/components/contribute/article-editor/article.types"
import type { HeldRoles } from "@/components/contribute/RoleApplicationForm"

import { articleBody } from "./articles"

export const editorLocales: ArticleLocale[] = [
  { code: "en", name: "English", isDefault: true },
  { code: "fr", name: "French", isDefault: false },
]
export const articleDraft: ArticleDraft = {
  title: "Welcoming a new reader",
  summary: "Practical ways a library can help people feel at home.",
  doc: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "A place to begin" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Clear signs, patient staff and a comfortable reading space help every visitor find their next book.",
          },
        ],
      },
    ],
  },
  sections: ["getting-started"],
  tags: [{ kind: "topic", label: "Accessibility", slug: "accessibility" }],
  editSummary: "Clarify the introduction",
  sources: [
    {
      title: "Northbridge Library reader guide",
      url: "https://example.org/reader-guide",
    },
  ],
}
export const existingArticle: ExistingArticle = {
  documentId: "example-article",
  slug: "welcoming-a-new-reader",
  locale: "en",
  title: articleDraft.title,
  summary: articleDraft.summary,
  body: articleBody,
  sections: articleDraft.sections,
  tags: articleDraft.tags,
  availableLocales: ["en", "fr"],
  baseRevision: "example-revision",
  updatedAt: "2026-01-20T12:00:00Z",
  publishedAt: "2026-01-18T12:00:00Z",
  sources: articleDraft.sources,
}
export const heldRoles: HeldRoles = {
  wiki_editor: [],
  journal_editor: [],
  moderator: { index: [], knowledge: [], journal: [], discussions: [] },
}

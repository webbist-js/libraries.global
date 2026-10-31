import * as React from "react"
import type { ReactElement, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
}))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => ({
    user: {
      id: "u1",
      email: "u@example.org",
      capabilities: ["docs.directEdit", "journal.directEdit"],
    },
  }),
}))
vi.mock("@/lib/journal-ownership-server", () => ({
  ownsJournalArticle: async () => false,
}))
vi.mock("@/lib/seo/metadata", () => ({ privateMetadata: () => ({}) }))
vi.mock("@/lib/article-editor-server", () => ({
  fetchArticleLocales: async () => [
    { code: "en", name: "English", isDefault: true },
    { code: "fr", name: "French", isDefault: false },
  ],
  loadArticleForEditor: async (_kind: string, slug: string) => ({
    documentId: "doc1",
    slug,
    locale: "en",
    title: "Title",
    summary: "",
    body: [],
    sections: [],
    tags: [],
    availableLocales: ["en"],
  }),
}))
const Shell = vi.hoisted(() => () => null)
vi.mock("@/components/contribute/article-editor/ArticleEditorShell", () => ({
  ArticleEditorShell: Shell,
}))
vi.mock(
  "@/app/[locale]/(dashboard)/contribute/_components/ContributeSectionHeader",
  () => ({
    ContributeSectionHeader: () => null,
  })
)
vi.mock(
  "@/app/[locale]/(dashboard)/contribute/knowledge/[slug]/_components/ReportProblemForm",
  () => ({ ReportProblemForm: () => null })
)

const knowledgePage = (
  await import("@/app/[locale]/(dashboard)/contribute/knowledge/[slug]/page")
).default
const journalPage = (
  await import("@/app/[locale]/(dashboard)/contribute/knowledge/journal/[slug]/page")
).default

/** The ArticleEditorShell element in a rendered page tree. */
function findShell(node: ReactNode): ReactElement | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findShell(child)
      if (found) return found
    }

    return null
  }
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === Shell) return el

  return findShell(el.props?.children)
}

const shellLocale = (tree: unknown) =>
  (findShell(tree as ReactNode)?.props as { initialLocale?: string })
    .initialLocale

const args = (locale?: string) => ({
  params: Promise.resolve({ locale: "en", slug: "my-article" }),
  searchParams: Promise.resolve(locale === undefined ? {} : { locale }),
})

describe("article editor pages read ?locale=", () => {
  it.each([
    ["Knowledge", knowledgePage],
    ["Journal", journalPage],
  ])("%s: passes a configured locale to the editor", async (_l, page) => {
    expect(shellLocale(await page(args("fr")))).toBe("fr")
  })

  it.each([
    ["Knowledge", knowledgePage],
    ["Journal", journalPage],
  ])("%s: ignores an unknown or missing locale", async (_l, page) => {
    expect(shellLocale(await page(args("xx")))).toBeUndefined()
    expect(shellLocale(await page(args()))).toBeUndefined()
  })
})

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../../../../locales/en.json"))
    .default

  return {
    getTranslations: async (config: string | { namespace?: string }) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof config === "string" ? config : config.namespace) as
          | keyof typeof messages
          | undefined,
      }),
  }
})

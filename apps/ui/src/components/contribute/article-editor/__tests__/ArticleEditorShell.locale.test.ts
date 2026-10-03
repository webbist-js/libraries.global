// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { editingLocaleFrom } from "../article.types"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
// strapi-helpers pulls in env validation; these tests need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/access-client", () => ({
  useCapabilities: () => ({ has: () => false, ready: true }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})
// The editor and sidebar are heavy (TipTap); the shell's locale logic isn't.
vi.mock("../ArticleEditor", () => ({ ArticleEditor: () => null }))
vi.mock("../ArticlePreview", () => ({ ArticlePreview: () => null }))
vi.mock("@/components/blog/ArticleBodyBlocks", () => ({
  ArticleBodyBlocks: () => null,
}))
vi.mock("../ArticleSidebar", () => {
  const Null = () => null

  return {
    EditSummaryCard: Null,
    HowEditingWorks: Null,
    LanguageCard: Null,
    SectionsCard: Null,
    StatusCard: Null,
    TagsCard: Null,
  }
})

const fetchMock = vi.fn(async () => Response.json({ data: null }))

const { ArticleEditorShell } = await import("../ArticleEditorShell")

const LOCALES = [
  { code: "en", name: "English", isDefault: true },
  { code: "fr", name: "French", isDefault: false },
]
const ARTICLE = {
  documentId: "doc1",
  slug: "my-article",
  locale: "en",
  title: "My article",
  summary: "",
  body: [],
  sections: [],
  tags: [],
  availableLocales: ["en"],
}

const renderShell = (initialLocale?: string) =>
  render(
    createElement(ArticleEditorShell, {
      kind: "knowledge",
      mode: "edit",
      article: ARTICLE,
      locales: LOCALES,
      uiLocale: "en",
      initialLocale,
    })
  )

const articleFetches = () =>
  fetchMock.mock.calls
    .map((c) => String((c as unknown[])[0]))
    .filter((u) => u.startsWith("/api/contribute/article"))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("editingLocaleFrom", () => {
  it("keeps a configured locale and ignores anything else", () => {
    expect(editingLocaleFrom("fr", LOCALES)).toBe("fr")
    expect(editingLocaleFrom("de", LOCALES)).toBeUndefined()
    expect(editingLocaleFrom(["fr"], LOCALES)).toBeUndefined()
    expect(editingLocaleFrom(undefined, LOCALES)).toBeUndefined()
  })
})

describe("ArticleEditorShell initialLocale", () => {
  it("opens the requested translation on load", async () => {
    renderShell("fr")
    await waitFor(() =>
      expect(articleFetches()).toEqual([
        "/api/contribute/article?kind=knowledge&slug=my-article&locale=fr",
      ])
    )
  })

  it("loads nothing extra for the source locale or none", async () => {
    renderShell("en")
    renderShell()
    await new Promise((r) => setTimeout(r, 20))
    expect(articleFetches()).toEqual([])
  })
})

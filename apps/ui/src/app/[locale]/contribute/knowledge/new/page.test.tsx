import { beforeEach, describe, expect, it, vi } from "vitest"

const current = vi.hoisted(() => ({
  user: {
    id: "writer",
    capabilities: ["docs.directEdit"],
    editorLocales: { docs: "all" as string | string[], journal: [] },
    compositionPreferences: { country: "CO" },
  },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => ({ user: current.user }),
}))
vi.mock("@/lib/article-editor-server", () => ({
  fetchArticleLocales: async () => [
    { code: "en", name: "English", isDefault: true },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
  ],
  loadArticleWriteContext: async () => ({ tags: [], eventMentions: [] }),
}))
vi.mock("@/components/contribute/article-editor/ArticleEditorShell", () => ({
  ArticleEditorShell: () => null,
}))
vi.mock("../../_components/ContributeSectionHeader", () => ({
  ContributeSectionHeader: () => null,
}))

import NewArticlePage from "./page"

beforeEach(() => {
  current.user.editorLocales.docs = "all"
  current.user.compositionPreferences.country = "CO"
})

const editor = async (query: { type?: string; locale?: string } = {}) => {
  const page = await NewArticlePage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(query),
  })

  return page.props.children[1].props
}

describe("new article language defaults", () => {
  it.each(["knowledge", "journal"])(
    "uses the current profile country for new %s content",
    async (type) => {
      expect((await editor({ type })).initialLocale).toBe("es")
    }
  )
  it("keeps an explicit configured language ahead of the country hint", async () => {
    expect((await editor({ locale: "fr" })).initialLocale).toBe("fr")
  })
  it("falls back to a Knowledge editor's permitted language when their country language is outside their grant", async () => {
    current.user.editorLocales.docs = ["en"]
    expect((await editor()).initialLocale).toBe("en")
    expect((await editor({ type: "journal" })).initialLocale).toBe("es")
  })
})

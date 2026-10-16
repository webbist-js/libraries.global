import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const dictionaries = {
    en: (await import("../../../../locales/en.json")).default,
    cs: (await import("../../../../locales/cs.json")).default,
    fr: (await import("../../../../locales/fr.json")).default,
  }

  return {
    setRequestLocale: vi.fn(),
    getTranslations: async ({
      locale,
      namespace,
    }: {
      locale: keyof typeof dictionaries
      namespace: "editorial" | "ui"
    }) =>
      createTranslator({ locale, namespace, messages: dictionaries[locale] }),
  }
})

vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/general-helpers", () => ({
  isProduction: () => true,
  isDevelopment: () => true,
}))
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchBlogLanding: async () => ({ data: { seo: { metaTitle: "Journal" } } }),
  countJournalArticles: async () => 20,
  fetchBlogArticle: async () => ({
    data: {
      title: "A library story",
      slug: "story",
      section: { slug: "stories" },
    },
  }),
  fetchWikiArticle: async () => ({
    data: { title: "Guide", slug: "guide", seo: { metaRobots: "none" } },
  }),
  fetchWikiSections: async () => ({
    data: [
      {
        documentId: "section-1",
        slug: "getting-started",
        name: "Getting started",
      },
    ],
  }),
}))
vi.mock("@/components/blog/BlogArticlePage", () => ({ default: () => null }))
vi.mock("@/components/blog/BlogLandingPage", () => ({ default: () => null }))
vi.mock("@/lib/journal-landing", () => ({ loadJournalLanding: vi.fn() }))
vi.mock("@/lib/article-discovery", () => ({
  fetchArticleBrowse: async () => ({ total: 20 }),
}))
vi.mock("@/components/docs/DocsArticlePage", () => ({ default: () => null }))
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (value: string) => value,
}))

import { generateMetadata as journalMetadata } from "@/app/[locale]/journal/[section]/[slug]/page"
import { generateMetadata as journalLandingMetadata } from "@/app/[locale]/journal/page"
import { generateMetadata as knowledgeMetadata } from "@/app/[locale]/knowledge/[section]/[slug]/page"

describe("article canonical metadata", () => {
  it.each([
    ["cs", "Guide / Znalosti", "Přečtěte si"],
    ["fr", "Guide / Connaissances", "Lisez"],
  ])(
    "localizes article metadata fallback copy in %s",
    async (locale, title, description) => {
      const params = Promise.resolve({
        locale,
        section: "general",
        slug: "guide",
      })
      const knowledge = await knowledgeMetadata({ params })
      const journal = await journalMetadata({ params })
      expect(knowledge.title).toBe(title)
      expect(journal.description).toContain(description)
    }
  )

  it("keeps out-of-range pagination out of the index", async () => {
    const metadata = await journalLandingMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ page: "999" }),
    })
    expect(metadata.robots).toMatchObject({ index: false, follow: true })
  })
  it("gives paginated Journal pages their own canonical and title", async () => {
    const metadata = await journalLandingMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ page: "2", view: "list" }),
    })
    expect(metadata.alternates?.canonical).toBe("/journal?page=2")
    expect(metadata.title).toBe("Journal / Page 2")
  })

  it("uses the Journal URL for canonicals and social sharing", async () => {
    const metadata = await journalMetadata({
      params: Promise.resolve({
        locale: "en",
        section: "wrong-section",
        slug: "story",
      }),
    })
    expect(metadata.alternates?.canonical).toBe("/journal/stories/story")
    expect(metadata.openGraph).toMatchObject({ url: "/journal/stories/story" })
  })

  it("uses the same fallback home section as the Knowledge page and sitemap", async () => {
    const metadata = await knowledgeMetadata({
      params: Promise.resolve({
        locale: "en",
        section: "general",
        slug: "guide",
      }),
    })
    expect(metadata.alternates?.canonical).toBe(
      "/knowledge/getting-started/guide"
    )
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })
})

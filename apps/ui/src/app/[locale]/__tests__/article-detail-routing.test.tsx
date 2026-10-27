import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchArticle, articleView, permanentRedirect } = vi.hoisted(() => ({
  fetchArticle: vi.fn(
    async (_slug: string, locale: string, language?: string | null) => ({
      data: {
        title: `Story in ${language ?? locale}`,
        slug: "story",
        section: { slug: "reports" },
      },
      localeFallback: false,
    })
  ),
  articleView: () => null,
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound")
  },
  permanentRedirect,
}))
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../locales/en.json")).default

  return {
    setRequestLocale: vi.fn(),
    getTranslations: async (config: string | { namespace: string }) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof config === "string"
          ? config
          : config.namespace) as keyof typeof messages,
      }),
  }
})
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/general-helpers", () => ({
  isProduction: () => true,
  isDevelopment: () => true,
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchBlogArticle: fetchArticle,
  fetchWikiArticle: fetchArticle,
  fetchRecentBlogArticles: async () => ({ data: [] }),
  fetchDocsWikiArticles: async () => ({ data: [] }),
  fetchWikiSections: async () => ({
    data: [{ documentId: "section", slug: "reports", name: "Reports" }],
  }),
}))
vi.mock("@/components/blog/BlogArticlePage", () => ({ default: articleView }))
vi.mock("@/components/docs/DocsArticlePage", () => ({ default: articleView }))
vi.mock("@/components/seo/JsonLd", () => ({ JsonLd: () => null }))
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (value: string) => value,
}))

import * as journal from "@/app/[locale]/journal/[section]/[slug]/page"
import * as knowledge from "@/app/[locale]/knowledge/[section]/[slug]/page"

function viewProps(node: ReactNode): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = viewProps(child)
      if (found) return found
    }

    return null
  }
  if (!node || typeof node !== "object") return null
  const element = node as ReactElement<{ children?: ReactNode }>

  return element.type === articleView
    ? element.props
    : viewProps(element.props?.children)
}
const props = (language?: string, section = "reports") => ({
  params: Promise.resolve({ locale: "en", section, slug: "story" }),
  searchParams: Promise.resolve(language ? { contentLang: language } : {}),
})
beforeEach(() => vi.clearAllMocks())

it("advertises each Knowledge article's Markdown alternate in the selected language", async () => {
  const metadata = await knowledge.generateMetadata(props("fr"))
  expect(metadata.alternates?.types?.["text/markdown"]).toBe(
    "/knowledge/reports/story.md?contentLang=fr"
  )
})

describe.each([
  ["Journal", journal],
  ["Knowledge", knowledge],
] as const)("%s query-dependent article routing", (_name, route) => {
  it("renders per request instead of opting new article paths into ISR", () => {
    // Empty static params enables on-demand static generation. Its first request
    // then fails at searchParams/draftMode with DYNAMIC_SERVER_USAGE in next start.
    expect(route.revalidate).toBe(0)
    expect("generateStaticParams" in route).toBe(false)
  })
  it("chooses each request's content language independently of the UI locale", async () => {
    for (const language of ["cs", "fr", undefined]) {
      const tree = await route.default(props(language))
      expect(viewProps(tree)).toMatchObject({
        locale: "en",
        contentLocale: language ?? "en",
        article: { title: `Story in ${language ?? "en"}` },
      })
      expect(fetchArticle).toHaveBeenLastCalledWith(
        "story",
        "en",
        language ?? null
      )
    }
  })
  it("retains the requested language when redirecting an old section URL", async () => {
    await expect(route.default(props("fr", "old-section"))).rejects.toThrow(
      `redirect:/${_name === "Journal" ? "journal" : "knowledge"}/reports/story?contentLang=fr`
    )
  })
  it("keeps explicit-language canonical metadata on its own URL", async () => {
    const metadata = await route.generateMetadata(props("fr"))
    expect(metadata.alternates?.canonical).toBe(
      `/${_name === "Journal" ? "journal" : "knowledge"}/reports/story?contentLang=fr`
    )
    expect(metadata.robots).toMatchObject({ index: false, follow: true })
  })
})

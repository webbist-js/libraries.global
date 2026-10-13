import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchAPI, DocsArticle, LegalDocument, notFound, permanentRedirect } =
  vi.hoisted(() => ({
    fetchAPI: vi.fn(),
    DocsArticle: () => null,
    LegalDocument: () => null,
    notFound: vi.fn(() => {
      throw new Error("notFound")
    }),
    permanentRedirect: vi.fn((url: string) => {
      throw new Error(`redirect:${url}`)
    }),
  }))

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("next/navigation", () => ({ notFound, permanentRedirect }))
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../locales/en.json")).default

  return {
    setRequestLocale: vi.fn(),
    getTranslations: async (
      config: string | { locale?: string; namespace?: string }
    ) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof config === "string"
          ? config
          : config.namespace) as keyof typeof messages,
      }),
  }
})
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "cs"] },
}))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: async () => null }))
vi.mock("@/lib/live-locales", () => ({ LIVE_LOCALES: ["en", "cs"] }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/general-helpers", () => ({
  isProduction: () => true,
  isDevelopment: () => true,
}))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/drives/drives-here-server", () => ({ drivesHere: vi.fn() }))
vi.mock("@/lib/find-search", () => ({ placeGapCounts: vi.fn() }))
vi.mock("@/lib/place-insights-server", () => ({ placeGapInsights: vi.fn() }))
vi.mock("@/components/continent/ContinentDetailPage", () => ({
  default: () => null,
}))
vi.mock("@/components/country/CountryDetailPage", () => ({
  CountryDetailPage: () => null,
}))
vi.mock("@/components/region/RegionDetailPage", () => ({
  RegionDetailPage: () => null,
}))
vi.mock("@/components/docs/DocsArticlePage", () => ({ default: DocsArticle }))
vi.mock("@/components/legal/LegalDocumentPage", () => ({
  default: LegalDocument,
}))

import { generateMetadata as regionMetadata } from "@/app/[locale]/[continent]/[country]/[region]/page"
import { generateMetadata as countryMetadata } from "@/app/[locale]/[continent]/[country]/page"
import { generateMetadata as continentMetadata } from "@/app/[locale]/[continent]/page"
import KnowledgeRoute, {
  generateMetadata as knowledgeMetadata,
} from "@/app/[locale]/knowledge/[section]/[slug]/page"
import LegalRoute, {
  generateMetadata as legalMetadata,
} from "@/app/[locale]/legal/[slug]/page"

const home = {
  documentId: "home",
  slug: "getting-started",
  name: "Getting started",
}
const other = {
  documentId: "other",
  slug: "contributing",
  name: "Contributing",
}

function fixture(translated = false, translatedSections: object[] = []) {
  fetchAPI.mockImplementation(
    async (path: string, params: { locale: string }) => {
      const available = params.locale === "en" || translated
      if (path === "/wiki-sections")
        return {
          data: params.locale === "en" ? [home, other] : translatedSections,
        }
      if (path === "/wiki-articles") return { data: [] }
      if (path === "/legal-documents/nav")
        return {
          data: available
            ? [{ documentId: "doc", slug: "terms", title: "Terms" }]
            : [],
        }
      if (!available) throw new Error("404")

      return {
        data: {
          documentId: "doc",
          name: "Europe",
          title: "Guide",
          slug: "guide",
          libraryCount: 10,
          locale: params.locale,
          section: home,
        },
      }
    }
  )
}

function componentProps(
  node: ReactNode,
  component: unknown
): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = componentProps(child, component)
      if (found) return found
    }

    return null
  }
  if (!node || typeof node !== "object") return null
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === component) return element.props

  return componentProps(element.props?.children, component)
}

const params = () =>
  Promise.resolve({
    locale: "cs",
    continent: "europe",
    country: "england",
    region: "london",
    section: "getting-started",
    slug: "guide",
  })

beforeEach(() => {
  vi.clearAllMocks()
  fixture()
})

describe("fallback routes", () => {
  it.each([
    ["Continent", continentMetadata],
    ["Country", countryMetadata],
    ["Region", regionMetadata],
    ["Legal", legalMetadata],
    ["Knowledge", knowledgeMetadata],
  ] as const)(
    "%s keeps English stand-ins out of the index",
    async (_name, metadata) => {
      const result = await metadata({ params: params() })
      expect(result.robots).toEqual({ index: false, follow: true })
      expect(result.title).not.toMatch(/not found/i)
    }
  )

  it.each([
    ["Continent", continentMetadata],
    ["Country", countryMetadata],
    ["Region", regionMetadata],
    ["Legal", legalMetadata],
    ["Knowledge", knowledgeMetadata],
  ] as const)(
    "%s still indexes an available translation",
    async (_name, metadata) => {
      fixture(true)
      expect((await metadata({ params: params() })).robots).toEqual({
        index: true,
        follow: true,
      })
    }
  )

  it.each([
    ["no translated sections", []],
    ["only another translated section", [{ ...other, name: "Přispívání" }]],
  ])("renders a Knowledge fallback with %s", async (_name, sections) => {
    fixture(false, sections as object[])
    const tree = await KnowledgeRoute({ params: params() })
    expect(componentProps(tree, DocsArticle)).toMatchObject({
      locale: "cs",
      untranslatedLocale: "cs",
      section: { slug: "getting-started" },
    })
    expect(notFound).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
    expect(
      (await knowledgeMetadata({ params: params() })).alternates?.canonical
    ).toBe("/cs/knowledge/getting-started/guide")
  })

  it("keeps the translation notice on Legal fallback renders", async () => {
    const tree = await LegalRoute({ params: params() })
    expect(componentProps(tree, LegalDocument)).toMatchObject({
      locale: "cs",
      untranslatedLocale: "cs",
      document: { locale: "en" },
      documents: [{ slug: "terms" }],
    })
  })

  it.each([
    ["Knowledge", KnowledgeRoute],
    ["Legal", LegalRoute],
  ] as const)(
    "%s still returns 404 when the original is also missing",
    async (_name, route) => {
      fetchAPI.mockRejectedValue(new Error("404"))
      await expect(route({ params: params() })).rejects.toThrow("notFound")
    }
  )
})

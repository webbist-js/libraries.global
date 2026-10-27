import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { publication, catalogue, sections } = vi.hoisted(() => ({
  publication: vi.fn(),
  catalogue: vi.fn(),
  sections: vi.fn(),
}))
vi.mock("@/lib/knowledge-content", () => ({
  fetchPublishedKnowledgeArticle: publication,
  fetchKnowledgeCatalogue: catalogue,
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchWikiSections: sections,
}))

import { GET as markdown } from "@/app/[locale]/knowledge/[section]/[slug]/markdown/route"
import { GET as llms } from "@/app/llms.txt/route"

const article = {
  documentId: "article",
  title: "Guide",
  slug: "guide",
  publishedAt: "2026-10-01T12:00:00Z",
  section: { slug: "data-api" },
  body: [
    {
      __component: "content.code-block",
      id: 1,
      code: "const value = 1;",
      language: "js",
    },
  ],
}
const request = (section = "data-api", query = "") =>
  markdown(
    new Request(
      `https://libraries.global/knowledge/${section}/guide.md${query}`
    ),
    { params: Promise.resolve({ locale: "en", section, slug: "guide" }) }
  )
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("PUBLIC_CANONICAL_ORIGIN", "https://libraries.global")
  vi.spyOn(console, "error").mockImplementation(vi.fn())
  publication.mockResolvedValue({ article, locale: "en" })
  sections.mockResolvedValue({
    data: [{ documentId: "section", slug: "data-api", name: "Data API" }],
  })
  catalogue.mockResolvedValue([])
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("published Knowledge Markdown route", () => {
  it("returns the complete body with source, language and discovery headers", async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    )
    expect(response.headers.get("content-language")).toBe("en")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("link")).toContain(
      '<https://libraries.global/knowledge/data-api/guide>; rel="canonical"'
    )
    expect(response.headers.get("link")).toContain(
      '<https://libraries.global/llms.txt>; rel="describedby"'
    )
    expect(await response.text()).toContain("```js\nconst value = 1;\n```")
  })

  it("keeps the selected language and Markdown extension through canonical redirects", async () => {
    const response = await request("old-section", "?contentLang=fr")
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://libraries.global/knowledge/data-api/guide.md?contentLang=fr"
    )
    expect(publication).toHaveBeenCalledWith("guide", "en", "fr")
  })

  it("separates a missing publication from an unavailable CMS or taxonomy", async () => {
    publication.mockResolvedValueOnce(null)
    expect((await request()).status).toBe(404)
    publication.mockRejectedValueOnce(new Error("CMS unavailable"))
    expect((await request()).status).toBe(503)
    sections.mockResolvedValueOnce({ data: [] })
    expect((await request()).status).toBe(503)
  })
})

describe("generated llms.txt", () => {
  it("includes newly published articles without a source-file update", async () => {
    catalogue.mockResolvedValue([
      {
        ...article,
        locale: "en",
        sectionSlugs: ["data-api"],
        summary: "API guide",
      },
    ])
    const response = await llms()
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    )
    expect(await response.text()).toContain(
      "[Guide (en)](https://libraries.global/knowledge/data-api/guide.md)"
    )
  })

  it("does not serve a successful partial guide when the catalogue is unavailable", async () => {
    catalogue.mockRejectedValue(new Error("Incomplete catalogue"))
    const response = await llms()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("# Libraries Global")
  })
})

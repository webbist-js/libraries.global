import type { ArticleBrowseItem } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import {
  renderDevelopersLlmsTxt,
  renderKnowledgeLlmsTxt,
  renderLlmsTxt,
} from "@/lib/agent-discovery"

const article = (input: Partial<ArticleBrowseItem>) =>
  ({
    documentId: "article",
    title: "API guide",
    slug: "api-guide",
    locale: "en",
    summary: "How to use the API.",
    section: { slug: "data-api" },
    sectionSlugs: ["data-api"],
    ...input,
  }) as ArticleBrowseItem
const sections = new Map([
  ["en", [{ slug: "getting-started" }, { slug: "data-api" }]],
  ["fr", [{ slug: "premiers-pas" }, { slug: "api-donnees" }]],
])

describe("agent Knowledge discovery", () => {
  it("keeps the root guide small and points to record and documentation discovery", () => {
    const result = renderLlmsTxt()
    expect(result).toContain("Use Libraries Global to find a library")
    expect(result).toContain("/knowledge/llms.txt")
    expect(result).toContain("/developers/llms.txt")
    expect(result).toContain("/sitemap.xml")
    expect(result).not.toContain("api-guide.md")
    expect(result.length).toBeLessThan(4000)
  })

  it("directs API clients to the public reference and states the access boundary", () => {
    const result = renderDevelopersLlmsTxt()
    expect(result).toContain("Authorization: Bearer YOUR_API_KEY")
    expect(result).toContain("settled paid coverage")
    expect(result).toContain("/developers/reference")
    expect(result).toContain("/openapi.json")
  })

  it("links every article to its full Markdown representation and translated home section", () => {
    const result = renderKnowledgeLlmsTxt(
      [
        article({}),
        article({
          documentId: "second",
          title: "New article",
          slug: "new",
          section: null,
          sectionSlugs: [],
        }),
        article({
          locale: "fr",
          title: "Guide API",
          slug: "guide-api",
          section: { slug: "api-donnees" } as ArticleBrowseItem["section"],
        }),
      ],
      sections
    )
    expect(result).toContain(
      "[API guide (en)](https://libraries.global/knowledge/data-api/api-guide.md)"
    )
    expect(result).toContain(
      "[New article (en)](https://libraries.global/knowledge/getting-started/new.md)"
    )
    expect(result).toContain(
      "[Guide API (fr)](https://libraries.global/fr/knowledge/api-donnees/guide-api.md)"
    )
    expect(result).toContain("# Libraries Global Knowledge")
    expect(result).not.toContain("team-api-quickstart")
  })

  it("escapes labels and prevents multiline summaries from injecting discovery entries", () => {
    const result = renderKnowledgeLlmsTxt(
      [
        article({
          title: "[API]\nGuide",
          summary: "First line\n- another line",
        }),
      ],
      sections
    )
    expect(result).toContain(String.raw`[\[API\] Guide (en)]`)
    expect(result).toContain(": First line - another line")
  })

  it("refuses a partial index when canonical sections are unavailable", () => {
    expect(() => renderKnowledgeLlmsTxt([article({})], new Map())).toThrow(
      "Knowledge sections are unavailable"
    )
  })
})

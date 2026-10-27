import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchAPI, browse } = vi.hoisted(() => ({
  fetchAPI: vi.fn(),
  browse: vi.fn(),
}))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/article-discovery", () => ({
  fetchArticleBrowse: browse,
  articleBrowseParams: (query: unknown) => JSON.stringify(query),
}))

import {
  fetchKnowledgeCatalogue,
  fetchPublishedKnowledgeArticle,
} from "@/lib/knowledge-content"

const published = {
  documentId: "article",
  slug: "guide",
  title: "Published guide",
  publishedAt: "2026-10-01T12:00:00Z",
}
const item = (index: number) => ({
  ...published,
  documentId: `article-${index}`,
  locale: "en",
})
beforeEach(() => vi.resetAllMocks())

describe("published Knowledge exports", () => {
  it("requests the published detail and does not forward preview status or private query fields", async () => {
    fetchAPI.mockResolvedValue({ data: published })
    expect(await fetchPublishedKnowledgeArticle("guide", "en", null)).toEqual({
      article: published,
      locale: "en",
    })
    expect(fetchAPI).toHaveBeenCalledWith("/wiki-articles/detail/guide", {
      locale: "en",
      status: "published",
    })
    fetchAPI.mockResolvedValue({
      data: { title: "Unpublished draft", publishedAt: null },
    })
    expect(await fetchPublishedKnowledgeArticle("guide", "en", null)).toBeNull()
  })

  it("uses default-language fallback only when a language was not explicitly selected", async () => {
    fetchAPI
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: published })
    expect(await fetchPublishedKnowledgeArticle("guide", "fr", null)).toEqual({
      article: published,
      locale: "en",
    })
    expect(fetchAPI.mock.calls.map((call) => call[1].locale)).toEqual([
      "fr",
      "en",
    ])
    fetchAPI.mockClear().mockResolvedValue({ data: null })
    expect(await fetchPublishedKnowledgeArticle("guide", "en", "fr")).toBeNull()
    expect(fetchAPI).toHaveBeenCalledTimes(1)
  })

  it("collects every catalogue page and language variant without bodies", async () => {
    const first = Array.from({ length: 50 }, (_, index) => item(index))
    const translated = { ...item(0), locale: "fr", slug: "guide-fr" }
    browse
      .mockResolvedValueOnce({ items: first, total: 51, page: 1, pageSize: 50 })
      .mockResolvedValueOnce({
        items: [translated],
        total: 51,
        page: 2,
        pageSize: 50,
      })
    const result = await fetchKnowledgeCatalogue()
    expect(result).toHaveLength(51)
    expect(result.at(-1)).toEqual(translated)
    expect(JSON.parse(browse.mock.calls[1]![1])).toMatchObject({
      page: 2,
      pageSize: 50,
      filters: {},
    })
  })

  it("fails instead of returning an incomplete, duplicate or unavailable catalogue", async () => {
    browse.mockResolvedValue({
      items: [item(0)],
      total: 2,
      page: 1,
      pageSize: 50,
    })
    await expect(fetchKnowledgeCatalogue()).rejects.toThrow(
      "Invalid Knowledge catalogue page"
    )
    browse.mockResolvedValue({
      items: [item(0), item(0)],
      total: 2,
      page: 1,
      pageSize: 50,
    })
    await expect(fetchKnowledgeCatalogue()).rejects.toThrow(
      "Invalid Knowledge catalogue article"
    )
    browse.mockRejectedValue(new Error("CMS unavailable"))
    await expect(fetchKnowledgeCatalogue()).rejects.toThrow("CMS unavailable")
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ browse: vi.fn(), landing: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/article-discovery", () => ({ fetchArticleBrowse: mocks.browse }))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchBlogLanding: mocks.landing,
  fetchBlogSections: vi.fn(),
}))

import { loadJournalTopStories } from "../journal-landing"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.landing.mockResolvedValue(undefined)
})

describe("optional Journal previews", () => {
  it("keeps the homepage and auth aside usable when article discovery is offline", async () => {
    mocks.browse.mockRejectedValue(new TypeError("fetch failed"))
    await expect(loadJournalTopStories("en")).resolves.toEqual({
      featured: null,
      editorsPick: false,
      sideStories: [],
    })
  })
  it("still renders a published preview when discovery succeeds", async () => {
    mocks.browse.mockResolvedValue({
      editorialItems: [
        { documentId: "fixture-article", readingTimeMinutes: 4 },
      ],
    })
    const result = await loadJournalTopStories("en")
    expect(result.featured).toMatchObject({
      documentId: "fixture-article",
      readMinutes: 4,
    })
  })
})

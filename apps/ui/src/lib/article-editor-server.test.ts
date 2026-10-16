import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchArticleForEditing: vi.fn(),
}))
vi.mock("@/lib/bridge-user-headers", () => ({
  strapiServiceHeaders: () => ({}),
}))

import {
  loadArticleWriteContext,
  toExistingArticle,
} from "./article-editor-server"

const libraryId = "library00000000000000001"
const eventId = "event0000000000000000001"
beforeEach(() => vi.unstubAllGlobals())

describe("article editor context", () => {
  it("preserves a purged Event's durable source ID and projects its public library label", () => {
    const article = toExistingArticle(
      "journal",
      {
        documentId: "story",
        slug: "story",
        eventMentions: [
          {
            citationId: "durable",
            title: "Past event",
            eventDocumentId: "expired-event",
            event: null,
            library: { documentId: "library", name: "Public library" },
          },
        ],
      },
      "en"
    )
    expect(article.eventMentions).toEqual([
      expect.objectContaining({
        citationId: "durable",
        eventDocumentId: "expired-event",
        libraryDocumentId: "library",
        libraryName: "Public library",
      }),
    ])
  })

  it("retains the current home section before historical section tags and pins a revision", () => {
    const article = toExistingArticle(
      "knowledge",
      {
        documentId: "w1",
        slug: "article",
        title: "Title",
        summary: "",
        body: [],
        section: { slug: "new-home" },
        docsSections: ["old-home", "new-home"],
      },
      "en"
    )
    expect(article.sections).toEqual(["new-home", "old-home"])
    expect(article.baseRevision).toMatch(/^[a-f0-9]{64}$/)
  })

  it("loads a public Library/Event context and durable mention without accepting query labels", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        url.includes("/events/event/")
          ? {
              documentId: eventId,
              title: "Book festival",
              libraryEntityRef: "CO-001",
              startTime: "2026-10-10T10:00:00Z",
              timezone: "America/Bogota",
              url: "https://library.example/festival",
            }
          : {
              data: [
                {
                  documentId: libraryId,
                  name: "Library in Colombia",
                  slug: "colombia-library",
                  entityRef: "CO-001",
                },
              ],
            }
      )
    )
    vi.stubGlobal("fetch", fetch)
    const context = await loadArticleWriteContext(
      { library: libraryId, event: eventId },
      "en"
    )
    expect(context.tags.map((tag) => tag.kind)).toEqual(["library", "event"])
    expect(context.eventMentions[0]).toMatchObject({
      eventDocumentId: eventId,
      libraryDocumentId: libraryId,
      title: "Book festival",
      timezone: "America/Bogota",
    })
  })

  it("ignores malformed record identifiers without sending a CMS request", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    expect(
      await loadArticleWriteContext(
        { library: "../private", event: "bad" },
        "en"
      )
    ).toEqual({ tags: [], eventMentions: [] })
    expect(fetch).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from "vitest"

import { buildFeedLayout } from "./blogFeed.helpers"

const article = (documentId: string) =>
  ({ documentId, title: documentId, slug: documentId }) as never

const a = article("a")
const b = article("b")
const c = article("c")

describe("buildFeedLayout", () => {
  it("lists the articles that are not the featured one in a young journal", () => {
    const layout = buildFeedLayout({
      processedArticles: [a, b],
      featured: a,
      activeSection: "All",
      totalArticles: 2,
    })

    expect(layout.listed).toEqual([b])
    expect(layout.showList).toBe(true)
    expect(layout.showMoreToCome).toBe(true)
  })

  it("skips the list when the only article is the featured one", () => {
    const layout = buildFeedLayout({
      processedArticles: [a],
      featured: a,
      activeSection: "All",
      totalArticles: 1,
    })

    expect(layout.listed).toEqual([])
    expect(layout.showList).toBe(false)
    expect(layout.showMoreToCome).toBe(true)
  })

  it("keeps the list (empty state) when a section filter matches nothing", () => {
    const layout = buildFeedLayout({
      processedArticles: [],
      featured: null,
      activeSection: "Feature",
      totalArticles: 2,
    })

    expect(layout.showList).toBe(true)
    expect(layout.showMoreToCome).toBe(false)
  })

  it("does not show More to come once the journal has four articles", () => {
    const layout = buildFeedLayout({
      processedArticles: [a, b, c, article("d")],
      featured: a,
      activeSection: "All",
      totalArticles: 4,
    })

    expect(layout.listed).toEqual([b, c, article("d")])
    expect(layout.showList).toBe(true)
    expect(layout.showMoreToCome).toBe(false)
  })
})

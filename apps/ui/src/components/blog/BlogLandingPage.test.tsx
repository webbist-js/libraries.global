// @vitest-environment happy-dom
import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { JournalLandingData } from "@/lib/journal-landing"
import { cleanup, render, screen, within } from "@/test/render"

import { BlogLandingPage } from "./BlogLandingPage"
import { DEFAULT_JOURNAL_QUERY } from "./journalLanding.helpers"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/ds/PageHero", () => ({
  PageHero: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock("./BlogSearchBar", () => ({ BlogSearchBar: () => null }))
vi.mock("./JournalListControls", () => ({ JournalListControls: () => null }))
vi.mock("./MonthlyDispatchCard", () => ({ MonthlyDispatchCard: () => null }))
vi.mock("./MostReadCard", () => ({ MostReadCard: () => null }))
vi.mock("./JournalWriteCta", () => ({ JournalWriteCta: () => null }))
vi.mock("@/components/articles/ArticleDiscoveryFilters", () => ({
  ArticleDiscoveryFilters: () => null,
}))
vi.mock("./JournalCards", () => ({
  JournalFeatureCard: ({ article }: { article: ArticleBrowseItem }) => (
    <p>{article.title}</p>
  ),
  JournalSideCard: ({ article }: { article: ArticleBrowseItem }) => (
    <p>{article.title}</p>
  ),
  JournalArticleCard: ({ article }: { article: ArticleBrowseItem }) => (
    <p>{article.title}</p>
  ),
  JournalArticleRow: ({ article }: { article: ArticleBrowseItem }) => (
    <p>{article.title}</p>
  ),
}))

function story(
  documentId: string,
  publicationOrigin: "index" | "community"
): ArticleBrowseItem {
  return {
    documentId,
    title: documentId,
    locale: "en",
    slug: documentId,
    summary: null,
    author: null,
    authorUsername: null,
    publicationOrigin,
    publishedAt: "2026-10-16",
    updatedAt: null,
    featured: false,
    readingTimeMinutes: 2,
    place: null,
    section: null,
    sectionSlugs: [],
    heroImage: null,
    facets: {
      languages: [{ value: "en", label: "English" }],
      origins: [{ value: publicationOrigin, label: publicationOrigin }],
    },
  }
}
const card = (article: ArticleBrowseItem) => ({
  ...article,
  readMinutes: article.readingTimeMinutes,
})

function fixture(origin = "community"): JournalLandingData {
  const discovery = aggregateArticleBrowse(
    [
      story("Index lead", "index"),
      story("Community one", "community"),
      story("Community two", "community"),
    ],
    parseArticleBrowseQuery({ origin }),
    null,
    "en"
  )

  return {
    landing: null,
    query: DEFAULT_JOURNAL_QUERY,
    lang: "all",
    linkLocale: "en",
    fallbackFrom: null,
    languages: [],
    sections: [],
    total: discovery.total,
    featured: card(discovery.editorialItems[0]!),
    editorsPick: false,
    sideStories: [],
    mostRead: [],
    discovery,
    communityPick: null,
    list: {
      items: discovery.items.map(card),
      total: discovery.total,
      page: discovery.page,
      pageCount: discovery.pageCount,
    },
  }
}
afterEach(cleanup)

describe("Journal editorial prominence and collection labels", () => {
  it("leads with a dedicated Index strip while counting only the Community collection below", () => {
    render(<BlogLandingPage data={fixture()} locale="en" />)
    const index = screen.getByRole("region", { name: "From the Index" })
    const community = screen.getByRole("region", { name: "Community Journal" })
    expect(within(index).getByText("Index lead")).toBeTruthy()
    expect(
      within(index).getByRole("link", { name: "View all" }).getAttribute("href")
    ).toBe("/journal?origin=index#all-articles")
    expect(within(community).getByText("2 articles")).toBeTruthy()
    expect(within(community).getByText("Community one")).toBeTruthy()
    expect(within(community).queryByText("Index lead")).toBeNull()
    expect(
      index.compareDocumentPosition(community) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
  it("uses the resolved All stories heading instead of claiming a default Community predicate", () => {
    render(<BlogLandingPage data={fixture("all")} locale="en" />)
    const all = screen.getByRole("region", { name: "All stories" })
    expect(within(all).getByText("3 articles")).toBeTruthy()
    expect(within(all).getByText("Index lead")).toBeTruthy()
    expect(
      screen.queryByRole("heading", { name: "Community Journal" })
    ).toBeNull()
  })
})

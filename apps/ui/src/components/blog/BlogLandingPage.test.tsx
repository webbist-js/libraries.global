// @vitest-environment happy-dom
import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { JournalSidebarFooter } from "@/components/articles/EditorialSidebar"
import type { JournalLandingData } from "@/lib/journal-landing"
import { cleanup, render, screen, within } from "@/test/render"

import { BlogLandingPage } from "./BlogLandingPage"
import { DEFAULT_JOURNAL_QUERY } from "./journalLanding.helpers"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: null, isPending: false, error: null }),
}))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "fr", "cs"], defaultLocale: "en" },
  usePathname: () => "/journal",
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("@/components/ds/PageHero", () => ({
  PageHero: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock("./BlogSearchBar", () => ({ BlogSearchBar: () => null }))
vi.mock("./JournalListControls", () => ({ JournalListControls: () => null }))
vi.mock("./MostReadCard", () => ({ MostReadCard: () => null }))
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
  it("keeps newsletter labels unique when desktop and mobile footers mount together", () => {
    render(
      <>
        <JournalSidebarFooter />
        <JournalSidebarFooter />
      </>
    )
    const fields = screen.getAllByRole("textbox", { name: "Email address" })
    expect(fields).toHaveLength(2)
    expect(new Set(fields.map((field) => field.id)).size).toBe(2)
    expect(
      new Set(fields.map((field) => field.getAttribute("aria-describedby")))
        .size
    ).toBe(2)
  })
  it("invites contributions between the Index and Data drops, with the dispatch in the sidebar", () => {
    const data = fixture()
    render(
      <BlogLandingPage
        data={{ ...data, dataDrops: [data.featured!], dataDropsTotal: 1 }}
        locale="en"
      />
    )
    const index = screen.getByRole("region", { name: "From the Index" })
    const contribution = screen.getByRole("region", {
      name: "A story from your library?",
    })
    const drops = screen.getByRole("region", { name: "Data drops" })
    expect(
      index.compareDocumentPosition(contribution) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      contribution.compareDocumentPosition(drops) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      within(contribution)
        .getByRole("link", { name: "Pitch a story" })
        .getAttribute("href")
    ).toBe("/contribute/knowledge?type=journal")

    const sidebar = screen.getByRole("complementary")
    expect(
      within(sidebar).getByRole("region", { name: "The monthly dispatch" })
    ).toBeTruthy()
    expect(screen.getAllByLabelText("Email address")).toHaveLength(1)
    expect(
      within(sidebar).queryByRole("link", { name: "Pitch a story" })
    ).toBeNull()
  })
  it.each([
    { q: "architecture" },
    { section: "history" },
    { page: 2 },
    { filters: { origins: ["index"] } },
  ])("keeps the contribution panel out of focused browsing: %j", (query) => {
    const data = fixture()
    render(
      <BlogLandingPage
        data={{ ...data, query: { ...data.query, ...query } }}
        locale="en"
      />
    )
    expect(
      screen.queryByRole("region", { name: "A story from your library?" })
    ).toBeNull()
    expect(
      screen.getByRole("region", { name: "The monthly dispatch" })
    ).toBeTruthy()
  })
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

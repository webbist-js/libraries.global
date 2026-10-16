// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BlogArticlePage } from "@/components/blog/BlogArticlePage"
import { toDocsSections } from "@/components/docs/docs.config"
import { DocsArticlePage } from "@/components/docs/DocsArticlePage"
import {
  articleCitationHref,
  articleLibraryHref,
  type ArticleContextData,
} from "@/lib/article-context"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ArticleContext } from "./ArticleContext"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
  }: {
    href?: string | null
    children: ReactNode
  }) => (href ? <a href={href}>{children}</a> : <span>{children}</span>),
}))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/ds/Breadcrumb", () => ({ Breadcrumb: () => null }))
vi.mock("@/components/ds/Badge", () => ({ Badge: () => null }))
vi.mock("@/lib/analytics-events", () => ({
  captureAnalyticsEvent: () => vi.fn(),
  analyticsAttributes: () => ({}),
}))
vi.mock("@/components/blog/BlogArticleCard", () => ({
  BlogArticleCard: () => null,
}))
vi.mock("@/components/docs/DocsSidebarTree", () => ({
  DocsSidebarTree: () => null,
}))
vi.mock("@/components/contribute/EditorOnly", () => ({
  EditorOnly: () => null,
}))
vi.mock("@/components/providers/ArticleEngagement", () => ({
  ArticleEngagement: () => null,
}))
vi.mock("@/components/docs/ArticleEditHistory", () => ({
  ArticleEditHistorySection: () => null,
}))
vi.mock("@/components/discussions/AttachedDiscussion", () => ({
  AttachedDiscussion: () => null,
}))
vi.mock("@/components/articles/ArticleReaderActions", () => ({
  ArticleReaderActions: () => null,
}))
vi.mock("@/lib/avatar", () => ({ avatarSrc: () => null }))
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/general-helpers", () => ({
  isProduction: () => true,
  isDevelopment: () => false,
}))

const library = {
  documentId: "library",
  name: "Bogotá Library",
  slug: "central",
  continent: { slug: "south-america" },
  country: { slug: "colombia" },
  region: { slug: "bogota" },
}
const context: ArticleContextData = {
  topics: [{ documentId: "reading", name: "Reading" }],
  libraries: [library],
  countries: [{ documentId: "changed", name: "Current library country" }],
  geographyFacet: {
    continents: [{ documentId: "south-america", name: "South America" }],
    countries: [{ documentId: "colombia", name: "Colombia" }],
    regions: [{ documentId: "bogota", name: "Bogotá" }],
    areas: [],
  },
  eventMentions: [
    {
      citationId: "event-citation",
      title: "Reading workshop",
      startTime: "2026-10-15T16:00:00Z",
      endTime: "2026-10-15T18:00:00Z",
      timezone: "America/Bogota",
      url: "https://library.example.org/workshop",
      library,
    },
  ],
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("public article context", () => {
  it("links Topics and Libraries while keeping frozen place context", () => {
    render(<ArticleContext article={context} kind="journal" locale="en" />)
    expect(
      screen.getByRole("link", { name: "Reading" }).getAttribute("href")
    ).toBe("/journal?lang=all&topic=reading")
    expect(
      screen
        .getAllByRole("link", { name: "Bogotá Library" })
        .every(
          (link) =>
            link.getAttribute("href") ===
            "/south-america/colombia/bogota/central"
        )
    ).toBe(true)
    expect(
      screen.getByRole("link", { name: "Colombia" }).getAttribute("href")
    ).toBe("/journal?lang=all&country=colombia")
    expect(screen.queryByText("Current library country")).toBeNull()
    expect(screen.getByText("Reading workshop")).toBeTruthy()
    expect(screen.getByText(/11:00 AM/).closest("p")?.textContent).toContain(
      "America/Bogota"
    )
    expect(
      screen
        .getByRole("link", { name: "library.example.org" })
        .getAttribute("href")
    ).toBe("https://library.example.org/workshop")
  })
  it("keeps a purged Event's stored citation and never renders extra source payloads", () => {
    const mention = {
      ...context.eventMentions![0],
      event: null,
      upstreamPayload: "private source payload",
      sourceEventId: "private source id",
    }
    const view = render(
      <ArticleContext
        article={{ eventMentions: [mention] }}
        kind="journal"
        locale="en"
      />
    )
    expect(screen.getByText("Reading workshop")).toBeTruthy()
    expect(screen.getAllByText(/America\/Bogota/)).toHaveLength(2)
    expect(
      screen.getByRole("link", { name: "library.example.org" })
    ).toBeTruthy()
    expect(view.container.textContent).not.toContain("private source")
  })
  it("preserves empty frozen groups and shows incomplete Library links as text", () => {
    render(
      <ArticleContext
        article={{
          ...context,
          eventMentions: [],
          libraries: [{ name: "Library without a region", slug: "missing" }],
          geographyFacet: {
            continents: [],
            countries: [],
            regions: [],
            areas: [],
          },
        }}
        kind="knowledge"
        locale="en"
      />
    )
    expect(screen.queryByText("Current library country")).toBeNull()
    expect(screen.getByText("Library without a region")).toBeTruthy()
    expect(
      screen.queryByRole("link", { name: "Library without a region" })
    ).toBeNull()
    expect(
      screen.getByRole("link", { name: "Reading" }).getAttribute("href")
    ).toBe("/knowledge?lang=all&topic=reading")
  })
  it("escapes citation text and withholds unsafe URLs and invalid dates", () => {
    const view = render(
      <ArticleContext
        article={{
          eventMentions: [
            {
              title: "<script>private()</script>",
              // eslint-disable-next-line sonarjs/code-eval -- Intentional unsafe source fixture verifies no executable link is rendered.
              url: "javascript:alert(1)",
              startTime: "not a date",
              timezone: "invalid/zone",
            },
          ],
        }}
        kind="journal"
        locale="en"
      />
    )
    expect(screen.getByText("<script>private()</script>")).toBeTruthy()
    expect(view.container.querySelector("script, time, a")).toBeNull()
    for (const url of [
      "data:text/html,bad",
      "//attacker.example/source",
      "https://user:secret@example.org",
      "https://example.org/\nsource",
      String.raw`https:\evil.example`,
    ])
      expect(articleCitationHref(url)).toBeNull()
    expect(articleLibraryHref({ ...library, slug: "../../private" })).toBeNull()
    expect(
      articleLibraryHref({ ...library, continent: { slug: "//attacker" } })
    ).toBeNull()
  })
  it("mounts the same context in both actual reader pages", () => {
    const article = {
      ...context,
      documentId: "article",
      title: "A story",
      slug: "story",
    }
    const sections = toDocsSections([
      { documentId: "section", name: "Reports", slug: "reports" },
    ])
    const view = render(<BlogArticlePage article={article} locale="en" />)
    expect(
      screen.getAllByRole("region", { name: "In this story" })
    ).toBeTruthy()
    expect(screen.getAllByText("Reading workshop")).toHaveLength(2)
    expect(view.container.querySelector("details")?.hasAttribute("open")).toBe(
      false
    )
    view.unmount()
    render(
      <DocsArticlePage
        article={article}
        articles={[]}
        sections={sections}
        section={sections[0]!}
        locale="en"
      />
    )
    expect(
      screen.getAllByRole("region", { name: "Related to this reference" })
    ).toBeTruthy()
    expect(
      screen.getAllByRole("link", { name: "Reading" })[0]?.getAttribute("href")
    ).toContain("/knowledge?")
    expect(screen.queryByText("Reading workshop")).toBeNull()
  })
  it("copies and shares the displayed Spanish-only Journal variant", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    render(
      <BlogArticlePage
        article={{
          documentId: "es-story",
          title: "Una tarde en Bogotá",
          slug: "demo-bogota-workshop",
          section: { documentId: "feature", name: "Feature", slug: "feature" },
        }}
        locale="en"
        contentLocale="es"
      />
    )
    const url =
      "https://libraries.global/journal/feature/demo-bogota-workshop?contentLang=es"
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
    const intent = new URL(
      screen
        .getByRole("link", { name: "Share on X / Twitter" })
        .getAttribute("href")!
    )
    expect(intent.searchParams.get("url")).toBe(url)
  })

  it.each([
    ["en", "In this story", "library.example.org"],
    ["fr", "Dans ce récit", "library.example.org"],
    ["cs", "V tomto příběhu", "library.example.org"],
  ] as const)(
    "localizes reader labels in %s",
    async (locale, title, source) => {
      const messages = (await import(`../../../locales/${locale}.json`)).default
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ArticleContext article={context} kind="journal" locale={locale} />
        </NextIntlClientProvider>
      )
      expect(screen.getByRole("region", { name: title })).toBeTruthy()
      expect(screen.getByRole("link", { name: source })).toBeTruthy()
    }
  )
})

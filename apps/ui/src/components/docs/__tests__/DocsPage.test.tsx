// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { toDocsSections } from "@/components/docs/docs.config"
import { DocsPage } from "@/components/docs/DocsPage"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/dashboard/RecordToolbar", () => ({
  RecordToolbar: () => null,
}))
vi.mock("@/components/contribute/EditorOnly", () => ({
  EditorOnly: ({ fallback = null }: { fallback?: ReactNode }) => fallback,
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/knowledge",
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  formatHref: (href: string) => href,
  isAppLink: (href: string) => href.startsWith("/"),
}))

const sections = toDocsSections([
  {
    documentId: "getting-started",
    name: "Getting started",
    slug: "getting-started",
    order: 1,
    icon: "mdi:code-tags",
  },
  {
    documentId: "data-api",
    name: "Data and API",
    slug: "data-api",
    order: 2,
    icon: "mdi:database-outline",
  },
])
const props = { articles: [], sections, locale: "en" as const }

afterEach(cleanup)

describe("Knowledge landing quick-start cards", () => {
  it("uses preferred-language guide titles and reader links without changing the header language", () => {
    render(
      <DocsPage
        {...props}
        contentLocale="fr"
        articles={[
          {
            documentId: "install",
            title: "Installer en local",
            slug: "install",
            summary: "Exécutez la plateforme.",
          },
        ]}
        quickStartCards={[
          { documentId: "install", title: "Install locally", slug: "install" },
        ]}
      />
    )
    const cards = within(screen.getByRole("navigation", { name: "Start here" }))
    expect(
      cards
        .getByRole("link", { name: /Installer en local/ })
        .getAttribute("href")
    ).toBe("/knowledge/getting-started/install?contentLang=fr")
    expect(cards.queryByText("Install locally")).toBeNull()
  })

  it("uses the localized CMS heading and introduction with a live guide count", () => {
    render(
      <DocsPage
        {...props}
        landing={{
          heroEyebrow: "Znalosti",
          heroTitle: "Vítejte ve znalostech",
          heroText: "Průvodce příspěvky a otevřenými daty.",
          version: "v2",
          quickStartCards: [],
        }}
      />
    )
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Vítejte ve znalostech"
    )
    expect(
      screen.getByText("Průvodce příspěvky a otevřenými daty.")
    ).toBeTruthy()
    expect(screen.queryByText("v2")).toBeNull()
    expect(screen.getAllByText("0 guides").length).toBeGreaterThan(0)
    expect(screen.queryByRole("navigation", { name: "Start here" })).toBeNull()
  })

  it("renders the CMS selection in order with article titles, summaries and canonical links", () => {
    render(
      <DocsPage
        {...props}
        quickStartCards={[
          {
            documentId: "exports",
            title: "Download the index",
            slug: "exports",
            summary: "Export library records for your research.",
            section: {
              documentId: "data-api",
              name: "Data and API",
              slug: "data-api",
            },
          },
          {
            documentId: "install",
            title: "Install locally",
            slug: "install",
            summary: "Start the platform on your computer.",
          },
        ]}
      />
    )

    const cards = within(screen.getByRole("navigation", { name: "Start here" }))
    expect(
      cards.getAllByRole("link").map((link) => link.getAttribute("href"))
    ).toEqual([
      "/knowledge/data-api/exports",
      "/knowledge/getting-started/install",
    ])
    expect(cards.getByText("Download the index")).toBeTruthy()
    expect(
      cards.getByText("Export library records for your research.")
    ).toBeTruthy()
    expect(cards.getByText("Install locally")).toBeTruthy()
    expect(cards.queryByText("Improve library records")).toBeNull()
  })

  it("honours an empty CMS selection instead of displaying hardcoded cards", () => {
    render(<DocsPage {...props} quickStartCards={[]} />)
    expect(screen.queryByRole("navigation", { name: "Start here" })).toBeNull()
  })

  it("keeps the existing entry cards when the CMS landing is unavailable", () => {
    render(<DocsPage {...props} />)
    const cards = within(screen.getByRole("navigation", { name: "Start here" }))
    expect(cards.getAllByRole("link")).toHaveLength(3)
    expect(cards.getByText("Improve library records")).toBeTruthy()
  })
})

describe("Knowledge search discovery state", () => {
  it("retains recognized country, language and section filters while replacing search and resetting pagination", () => {
    render(
      <DocsPage
        {...props}
        locale="fr"
        searchQuery="old words"
        currentQuery={{
          q: "old words",
          country: "CO",
          lang: "es",
          section: "getting-started",
          page: "8",
          pageSize: "999",
          sort: "title",
          topic: ["reading", "../private"],
          unknown: "discard",
          status: "draft",
          populate: "*",
          preferredLocale: "cs",
        }}
      />
    )
    const input = screen.getByRole("searchbox", {
      name: "Search the knowledge base",
    }) as HTMLInputElement
    fireEvent.change(input, { target: { value: "new search" } })
    const form = input.closest("form")!
    expect(form.getAttribute("action")).toBe("/fr/knowledge")
    expect(form.getAttribute("method")).toBe("get")
    const fields = new FormData(form)
    expect(Object.fromEntries(fields)).toEqual({
      q: "new search",
      country: "CO",
      lang: "es",
      section: "getting-started",
      sort: "title",
      pageSize: "50",
      topic: "reading",
    })
    expect(fields.getAll("q")).toEqual(["new search"])
    expect(fields.has("page")).toBe(false)
    expect(fields.has("unknown")).toBe(false)
  })

  it("preserves explicit all-language and worldwide choices in a native search submission", () => {
    render(
      <DocsPage
        {...props}
        currentQuery={{ lang: "all", country: "all", page: "3" }}
      />
    )
    const form = screen
      .getByRole("searchbox", { name: "Search the knowledge base" })
      .closest("form")!
    const fields = new FormData(form)
    expect(fields.get("lang")).toBe("all")
    expect(fields.get("country")).toBe("all")
    expect(fields.has("page")).toBe(false)
  })
})

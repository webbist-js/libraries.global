// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { toDocsSections } from "@/components/docs/docs.config"
import { DocsPage } from "@/components/docs/DocsPage"
import { cleanup, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
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
  it("uses the localized CMS heading, introduction and version", () => {
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
    expect(screen.getByText("v2")).toBeTruthy()
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

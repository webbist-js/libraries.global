// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchArticleHistory: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { ArticleEditHistory, articleChangeText } =
  await import("../ArticleEditHistory")

const item = (over: Record<string, unknown> = {}) =>
  ({
    changedAt: "2026-09-20T10:00:00.000Z",
    kind: "edited",
    locale: "en",
    actor: { kind: "contributor", username: "ada" },
    editSummary: null,
    ...over,
  }) as never

afterEach(cleanup)

describe("ArticleEditHistory", () => {
  it("is a collapsible Edit history listing who, what and when", () => {
    const { container, getByText } = render(
      createElement(ArticleEditHistory, {
        items: [
          item(),
          item({ kind: "published", actor: { kind: "admin", username: null } }),
        ],
        total: 2,
        locale: "en",
      })
    )
    expect(container.querySelector("details summary")!.textContent).toContain(
      "Edit history"
    )
    expect(getByText("@ada").closest("a")!.getAttribute("href")).toBe(
      "/profile/ada"
    )
    expect(container.textContent).toContain("Libraries Global staff")
    expect(container.textContent).toContain("Edited")
    expect(container.textContent).toContain("Published")
    expect(container.querySelector("time")!.getAttribute("dateTime")).toBe(
      "2026-09-20T10:00:00.000Z"
    )
  })

  it("names the language of a translation and badges other locales", () => {
    const { container } = render(
      createElement(ArticleEditHistory, {
        items: [item({ kind: "translated", locale: "fr" })],
        total: 1,
        locale: "en",
      })
    )
    expect(container.textContent).toContain("Translated into French")
    expect(container.querySelector("[data-locale]")!.textContent).toBe("FR")
  })

  it("leaves the badge off changes in the page's own locale", () => {
    const { container } = render(
      createElement(ArticleEditHistory, {
        items: [item()],
        total: 1,
        locale: "en",
      })
    )
    expect(container.querySelector("[data-locale]")).toBe(null)
  })

  it("renders nothing without entries", () => {
    const { container } = render(
      createElement(ArticleEditHistory, { items: [], total: 0, locale: "en" })
    )
    expect(container.innerHTML).toBe("")
  })
})

describe("articleChangeText", () => {
  it.each([
    ["created", "en", "Created"],
    ["edited", "en", "Edited"],
    ["translated", "fr", "Translated into French"],
    ["published", "en", "Published"],
    ["unpublished", "en", "Unpublished"],
    ["deleted", "en", "Deleted"],
  ])("%s (%s) reads %s", (kind, locale, text) => {
    expect(articleChangeText(kind, locale)).toBe(text)
  })
})

import * as React from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

const { PageHero } = await import("../PageHero")

const h1 = (html: string) => /<h1[^>]*>(.*?)<\/h1>/s.exec(html)?.[1] ?? ""

describe("PageHero title", () => {
  it("supports ink emphasis and a summary before the section tabs", () => {
    const html = renderToStaticMarkup(
      createElement(PageHero, {
        title: "A *drive*",
        emphasisTone: "ink",
        prelude: "Metadata",
        footer: "Progress summary",
        tabs: "Section tabs",
      })
    )
    expect(h1(html)).toContain("var(--t-ink-base)")
    expect(html.indexOf("Metadata")).toBeLessThan(html.indexOf("<h1"))
    expect(html.indexOf("Progress summary")).toBeLessThan(
      html.indexOf("Section tabs")
    )
  })
  it("renders *markup* as italic by default", () => {
    const html = renderToStaticMarkup(
      createElement(PageHero, { eyebrow: "X", title: "Review *submissions*" })
    )
    expect(h1(html)).toContain("<em")
  })

  it("renders a plainTitle as text, asterisks included", () => {
    const html = renderToStaticMarkup(
      createElement(PageHero, {
        eyebrow: "X",
        title: "Stars *and* stripes",
        plainTitle: true,
      })
    )
    expect(h1(html)).not.toContain("<em")
    expect(h1(html)).toContain("Stars *and* stripes")
  })
})

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

const { ArticleReviewPanel } = await import("../ArticleReviewPanel")

const detail = (status: string) => ({
  status,
  submissionType: "wiki_edit",
  draftData: { proposedTitle: "T", proposedBody: [] },
  fields: null,
  locale: "en",
  article: null,
  editSummary: null,
  canPublish: true,
  targetSlug: "faq",
})

describe("ArticleReviewPanel", () => {
  it.each(["pending", "needs_info"])(
    "says what approval does while %s",
    (s) => {
      expect(
        renderToStaticMarkup(
          createElement(ArticleReviewPanel, { detail: detail(s) })
        )
      ).toContain("On approval")
    }
  )

  it.each(["approved", "rejected"])("drops it once %s", (s) => {
    expect(
      renderToStaticMarkup(
        createElement(ArticleReviewPanel, { detail: detail(s) })
      )
    ).not.toContain("On approval")
  })
})

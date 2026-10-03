// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon, style }: { icon: string; style?: React.CSSProperties }) =>
      h("svg", { "data-icon": icon, style }),
  }
})
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

const { StatusBadge } = await import("../StatusBadge")

describe("StatusBadge", () => {
  it("puts the icon inside the tinted pill, in the pill's colour", () => {
    const html = renderToStaticMarkup(
      createElement(StatusBadge, { status: "rejected" })
    )
    const doc = new DOMParser().parseFromString(html, "text/html")
    const icon = doc.querySelector("svg[data-icon]")
    const pill = icon?.closest("span[style*='border-radius']") as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.textContent).toBe("Rejected")
    expect(icon?.getAttribute("style")).toContain("color:#A13A1A")
  })
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/global/NavigationProgress", () => ({
  NavigationProgress: () => null,
}))
vi.mock("@/hooks/useTranslatedZod", () => ({ useTranslatedZod: () => {} }))
vi.mock("@/lib/general-helpers", () => ({ setupLibraries: () => {} }))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))

const { ClientProviders } = await import("../ClientProviders")

describe("ClientProviders", () => {
  it("gives next-themes' inline bootstrap script the request's CSP nonce", () => {
    const html = renderToStaticMarkup(
      createElement(ClientProviders, { nonce: "n0nce123", children: "page" })
    )
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toContain('nonce="n0nce123"')
    expect(html).toContain("page")
  })

  it("renders the script without a nonce attribute when none is given", () => {
    const html = renderToStaticMarkup(
      createElement(ClientProviders, { children: "page" })
    )
    expect(html).toMatch(/<script\b/)
    expect(html).not.toContain("nonce=")
  })
})

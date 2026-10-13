// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const caps = vi.hoisted(() => ({ list: [] as string[] }))

vi.mock("@/lib/access-client", () => ({
  useCapabilities: () => ({
    has: (c: string) => caps.list.includes(c),
    claimedLibraryIds: [],
    moderationScopes: [],
    canDirectEdit: () => false,
    ready: true,
  }),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/contribute/moderation/abcdefghijklmnopqrstuvwx",
}))
// The ds barrel pulls in env validation; the tabs need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const { ContributeNavBar, activeContributeTab } =
  await import("../ContributeNavBar")

afterEach(() => {
  cleanup()
  caps.list = []
})

describe("ContributeNavBar", () => {
  it("hides the Moderation tab without moderate.queue", () => {
    render(createElement(ContributeNavBar))
    expect(screen.queryByRole("link", { name: /Moderation/ })).toBeNull()
    expect(screen.getByRole("link", { name: /My submissions/ })).toBeTruthy()
  })

  it("shows the Moderation tab with moderate.queue, active on a review page", () => {
    caps.list = ["moderate.queue"]
    render(createElement(ContributeNavBar))
    const tab = screen.getByRole("link", { name: /Moderation/ })
    expect(tab.getAttribute("href")).toBe("/contribute/moderation")
    expect(tab.getAttribute("aria-current")).toBe("page")
  })

  it("maps moderation routes to the Moderation tab", () => {
    expect(activeContributeTab("/contribute/moderation")).toBe("moderation")
    expect(activeContributeTab("/fr/contribute/moderation/suggestions")).toBe(
      "moderation"
    )
  })

  it("has no Community tab: Community is its own section", () => {
    render(createElement(ContributeNavBar))
    expect(screen.queryByRole("link", { name: /Community/ })).toBeNull()
    expect(activeContributeTab("/contribute/community")).toBeNull()
  })
})

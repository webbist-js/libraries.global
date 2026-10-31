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
  usePathname: () => "/moderation/abcdefghijklmnopqrstuvwx",
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

  it("keeps Moderation out of Contribute navigation for moderators too", () => {
    caps.list = ["moderate.queue"]
    render(createElement(ContributeNavBar))
    expect(screen.queryByRole("link", { name: /Moderation/ })).toBeNull()
  })

  it("does not classify moderation routes as Contribute pages", () => {
    expect(activeContributeTab("/moderation")).toBeNull()
    expect(activeContributeTab("/fr/moderation/suggestions")).toBeNull()
  })

  it("has no Community tab: Community is its own section", () => {
    render(createElement(ContributeNavBar))
    expect(screen.queryByRole("link", { name: /Community/ })).toBeNull()
    expect(activeContributeTab("/contribute/community")).toBeNull()
  })
})

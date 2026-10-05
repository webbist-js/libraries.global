// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ path: "/community/leaderboard" }))

vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
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

const { CommunityNavBar, activeCommunityTab } =
  await import("../CommunityNavBar")

afterEach(() => {
  cleanup()
  nav.path = "/community/leaderboard"
})

describe("CommunityNavBar", () => {
  it("links the three Community tabs and marks the current one", () => {
    render(createElement(CommunityNavBar))
    expect(
      screen.getByRole("link", { name: /Noticeboard/ }).getAttribute("href")
    ).toBe("/community")
    const leaderboard = screen.getByRole("link", { name: /Leaderboard/ })
    expect(leaderboard.getAttribute("href")).toBe("/community/leaderboard")
    expect(leaderboard.getAttribute("aria-current")).toBe("page")
    expect(
      screen.getByRole("link", { name: /Suggestions/ }).getAttribute("href")
    ).toBe("/community/suggestions")
  })
})

describe("activeCommunityTab", () => {
  it("maps the landing page and drive pages to the Noticeboard", () => {
    expect(activeCommunityTab("/community")).toBe("noticeboard")
    expect(activeCommunityTab("/fr/community")).toBe("noticeboard")
    expect(activeCommunityTab("/community/drives/ohio-hours")).toBe(
      "noticeboard"
    )
    expect(activeCommunityTab("/community/propose")).toBe("noticeboard")
  })

  it("maps the leaderboard and suggestions to their own tabs", () => {
    expect(activeCommunityTab("/community/leaderboard?period=week")).toBe(
      "leaderboard"
    )
    expect(activeCommunityTab("/community/suggestions")).toBe("suggestions")
  })

  it("ignores paths outside the section", () => {
    expect(activeCommunityTab("/contribute")).toBeNull()
    expect(activeCommunityTab("/communityx")).toBeNull()
  })
})

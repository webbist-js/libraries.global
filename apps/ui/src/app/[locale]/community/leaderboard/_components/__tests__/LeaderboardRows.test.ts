// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { LeaderboardEntry } from "@/lib/types/leaderboard"

Object.assign(globalThis, { React })

vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

afterEach(() => {
  cleanup()
})

const { LeaderboardRows } = await import("../LeaderboardRows")

const entry = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  rank: 1,
  username: "jane-doe",
  firstName: "Jane",
  lastName: "Doe",
  country: null,
  avatarUrl: null,
  contributorRole: null,
  periodPoints: 120,
  totalPoints: 500,
  tier: "Cartographer",
  ...overrides,
})

describe("LeaderboardRows", () => {
  it("links a named contributor to their profile", () => {
    render(createElement(LeaderboardRows, { entries: [entry({})] }))
    const link = screen.getByRole("link")

    expect(link.getAttribute("href")).toBe("/profile/jane-doe")
  })

  it("renders no link for a contributor with a private profile", () => {
    render(
      createElement(LeaderboardRows, {
        entries: [entry({ username: null, firstName: null, lastName: null })],
      })
    )

    expect(screen.queryByRole("link")).toBeNull()
  })
})

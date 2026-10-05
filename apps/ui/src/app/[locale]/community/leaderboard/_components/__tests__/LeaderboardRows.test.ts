// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
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
  rank: 4,
  username: "jane-doe",
  firstName: "Jane",
  lastName: "Doe",
  country: null,
  city: null,
  avatarUrl: null,
  contributorRole: null,
  periodPoints: 1200,
  totalPoints: 5000,
  tier: "Cartographer",
  approvedCount: 158,
  acceptanceRate: 93,
  ...overrides,
})

const rows = () => screen.getAllByRole("listitem")

const rowAt = (i: number): HTMLElement => {
  const row = rows()[i]
  if (!row) throw new Error(`No row ${i}`)

  return row
}

describe("LeaderboardRows", () => {
  it("links a named contributor to their profile", () => {
    render(createElement(LeaderboardRows, { entries: [entry({})] }))
    const link = screen.getByRole("link", { name: "Jane Doe" })

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

  it("shows rank, tier and place, points, and approved count with rate", () => {
    render(
      createElement(LeaderboardRows, {
        entries: [entry({ city: "Seville", country: "Spain" })],
      })
    )
    const row = rowAt(0)

    expect(row.textContent).toContain("4")
    expect(within(row).getByText("Cartographer · Seville, Spain")).toBeTruthy()
    expect(row.textContent).toContain("Points: 1,200")
    expect(within(row).getByText("158 approved · 93%")).toBeTruthy()
  })

  it("shows just the tier when there's no place", () => {
    render(createElement(LeaderboardRows, { entries: [entry({})] }))

    expect(within(rowAt(0)).getByText("Cartographer")).toBeTruthy()
  })

  it("leaves the rate out when there isn't one", () => {
    render(
      createElement(LeaderboardRows, {
        entries: [entry({ approvedCount: 0, acceptanceRate: null })],
      })
    )

    expect(within(rowAt(0)).getByText("0 approved")).toBeTruthy()
    expect(rowAt(0).textContent).not.toContain("%")
  })

  it("marks only the viewer's row with a You chip", () => {
    render(
      createElement(LeaderboardRows, {
        entries: [
          entry({ rank: 4 }),
          entry({ rank: 5, username: "katie", firstName: "Katie" }),
        ],
        youRank: 5,
      })
    )

    expect(within(rowAt(0)).queryByText("You")).toBeNull()
    expect(within(rowAt(1)).getByText("You")).toBeTruthy()
  })

  it("shows no You chip without a rank", () => {
    render(createElement(LeaderboardRows, { entries: [entry({})] }))

    expect(screen.queryByText("You")).toBeNull()
  })

  it("renders nothing when there are no rows", () => {
    const { container } = render(
      createElement(LeaderboardRows, { entries: [] })
    )

    expect(container.innerHTML).toBe("")
  })
})

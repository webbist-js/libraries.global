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

const { LeaderboardPodium } = await import("../LeaderboardPodium")

const entry = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  rank: 1,
  username: "morag",
  firstName: "Morag",
  lastName: "Reid",
  country: "UK",
  city: "Glasgow",
  avatarUrl: null,
  contributorRole: null,
  periodPoints: 1483,
  totalPoints: 2000,
  tier: "Curator",
  approvedCount: 346,
  acceptanceRate: 98,
  ...overrides,
})

const cards = () =>
  within(screen.getByRole("list", { name: "Top three" })).getAllByRole(
    "listitem"
  )

const card = (i: number): HTMLElement => {
  const el = cards()[i]
  if (!el) throw new Error(`No card ${i}`)

  return el
}

describe("LeaderboardPodium", () => {
  it("shows three open spots when nobody has points", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [],
        periodPhrase: "today",
      })
    )

    expect(cards()).toHaveLength(3)
    expect(screen.getAllByText("Open spot")).toHaveLength(3)
    expect(
      screen.getAllByText("One approved change today puts you here.")
    ).toHaveLength(3)
  })

  it("fills the ranks it has and leaves the rest open", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [entry({})],
        periodPhrase: "this month",
      })
    )
    const [first, second, third] = [card(0), card(1), card(2)]

    expect(within(first).getByText("Rank 1")).toBeTruthy()
    expect(within(first).queryByText("Open spot")).toBeNull()
    expect(within(second).getByText("Rank 2")).toBeTruthy()
    expect(within(second).getByText("Open spot")).toBeTruthy()
    expect(
      within(third).getByText("One approved change this month puts you here.")
    ).toBeTruthy()
  })

  it("keeps rank order in the DOM", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [
          entry({ rank: 1 }),
          entry({ rank: 2, firstName: "Dev", lastName: "Patel" }),
          entry({ rank: 3, firstName: "Inès", lastName: "Garnier" }),
        ],
        periodPhrase: "ever",
      })
    )

    expect(
      cards().map((li) => within(li).getByText(/^Rank/).textContent)
    ).toEqual(["Rank 1", "Rank 2", "Rank 3"])
  })

  it("shows the tier, points, approved count and rate", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [entry({})],
        periodPhrase: "ever",
      })
    )
    const first = card(0)

    expect(
      within(first)
        .getByRole("link", { name: "Morag Reid" })
        .getAttribute("href")
    ).toBe("/profile/morag")
    expect(within(first).getByText("Curator")).toBeTruthy()
    expect(first.textContent).toContain("1,483 pts")
    expect(within(first).getByText("346 approved")).toBeTruthy()
    expect(within(first).getByText("98% accepted")).toBeTruthy()
  })

  it("leaves out the rate line when there isn't one", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [entry({ acceptanceRate: null })],
        periodPhrase: "ever",
      })
    )

    expect(card(0).textContent).not.toContain("accepted")
  })

  it("shows a private contributor's name without a link", () => {
    render(
      createElement(LeaderboardPodium, {
        entries: [
          entry({
            username: null,
            firstName: "Private",
            lastName: "contributor",
          }),
        ],
        periodPhrase: "ever",
      })
    )

    expect(within(card(0)).getByText("Private contributor")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
  })
})

// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Standing } from "@/lib/community/leaderboard-server"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
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

const { StandingCard } = await import("../StandingCard")

const standing = (overrides: Partial<Standing> = {}): Standing => ({
  globalRank: 14,
  monthRank: 9,
  periodRank: 9,
  tier: {
    level: 1,
    name: "Reader",
    nextName: "Indexer",
    nextThreshold: 100,
    progressPercent: 64,
  },
  streak: 3,
  totalPoints: 64,
  pointsThisMonth: 22,
  recentBadges: [],
  suggestedAction: "",
  ...overrides,
})

const renderCard = (props: Partial<Parameters<typeof StandingCard>[0]>) =>
  render(
    createElement(StandingCard, {
      standing: standing(),
      signedIn: true,
      initials: "KA",
      signInReturnTo: "/community",
      ...props,
    })
  )

/** The `dd` paired with a tile's `dt`. */
const tile = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent

describe("StandingCard", () => {
  it("shows the tier, ranks, points and streak", () => {
    renderCard({})

    expect(screen.getByRole("heading", { name: "Your standing" })).toBeTruthy()
    expect(screen.getByText("Reader · Level 1")).toBeTruthy()
    expect(tile("This month")).toBe("#9")
    expect(tile("All time")).toBe("#14")
    expect(tile("Total points")).toBe("64")
    expect(tile("Streak")).toBe("3 days")
  })

  it("says 1 day for a one-day streak", () => {
    renderCard({ standing: standing({ streak: 1 }) })

    expect(tile("Streak")).toBe("1 day")
  })

  it("shows progress to the next tier as text and a bar", () => {
    renderCard({})

    expect(screen.getByText("Progress to Indexer")).toBeTruthy()
    expect(screen.getByText("64 of 100 pts")).toBeTruthy()
    const bar = screen.getByRole("progressbar", { name: "Progress to Indexer" })
    expect(bar.getAttribute("aria-valuemin")).toBe("0")
    expect(bar.getAttribute("aria-valuemax")).toBe("100")
    expect(bar.getAttribute("aria-valuenow")).toBe("64")
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("64%")
    expect(
      screen.getByText("36 points to go. One approved new library is worth 50.")
    ).toBeTruthy()
  })

  it("measures the bar against the next tier's threshold", () => {
    renderCard({
      standing: standing({
        totalPoints: 300,
        tier: {
          level: 2,
          name: "Indexer",
          nextName: "Cartographer",
          nextThreshold: 500,
          progressPercent: 50,
        },
      }),
    })

    expect(screen.getByText("300 of 500 pts")).toBeTruthy()
    const bar = screen.getByRole("progressbar")
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("60%")
    expect(
      screen.getByText(
        "200 points to go. One approved new library is worth 50."
      )
    ).toBeTruthy()
  })

  it("says Not ranked yet with no month rank and no points", () => {
    renderCard({
      standing: standing({
        monthRank: null,
        periodRank: null,
        globalRank: 120,
        totalPoints: 0,
        streak: 0,
      }),
    })

    expect(tile("This month")).toBe("Not ranked yet")
    expect(tile("All time")).toBe("Not ranked yet")
    expect(tile("Total points")).toBe("0")
    expect(tile("Streak")).toBe("0 days")
    expect(screen.getByText("0 of 100 pts")).toBeTruthy()
  })

  it("thanks a contributor at the top tier, with no bar", () => {
    renderCard({
      standing: standing({
        totalPoints: 9500,
        tier: {
          level: 6,
          name: "Curator",
          nextName: null,
          nextThreshold: null,
          progressPercent: 100,
        },
      }),
    })

    expect(screen.getByText("Curator · Level 6")).toBeTruthy()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByText(/Progress to/)).toBeNull()
    expect(
      screen.getByText("You’ve reached the top tier. Thank you.")
    ).toBeTruthy()
  })

  it("asks a signed-out visitor to sign in, coming back to the page", () => {
    renderCard({
      signedIn: false,
      standing: null,
      signInReturnTo: "/community/leaderboard?period=week",
    })

    expect(
      screen.getByText("Sign in to see your rank, tier and progress.")
    ).toBeTruthy()
    const link = screen.getByRole("link", { name: "Sign in" })
    expect(link.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community/leaderboard?period=week")}`
    )
    expect(screen.queryByRole("progressbar")).toBeNull()
  })
})

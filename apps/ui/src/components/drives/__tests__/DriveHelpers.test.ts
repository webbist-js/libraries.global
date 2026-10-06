// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveLeaderboardEntry } from "@/lib/drives/types"

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

const { DriveHelpers } = await import("../DriveHelpers")

const entry = (
  over: Partial<DriveLeaderboardEntry>
): DriveLeaderboardEntry => ({
  rank: 1,
  credits: 12,
  username: "morag",
  displayName: "Morag Reid",
  avatarUrl: null,
  ...over,
})

const WEEK = [
  entry({}),
  entry({ rank: 2, credits: 1, username: null, displayName: "A contributor" }),
]
const ALL = [
  entry({ credits: 40 }),
  entry({ rank: 2, credits: 9, username: "dev", displayName: "Dev Patel" }),
]

describe("DriveHelpers", () => {
  it("lists this week's and all-time helpers with their accepted tasks", () => {
    render(createElement(DriveHelpers, { week: WEEK, all: ALL }))

    const week = screen.getByRole("list", { name: "This week" })
    const rows = within(week).getAllByRole("listitem")
    expect(rows[0]!.textContent).toContain("Morag Reid")
    expect(rows[0]!.textContent).toContain("12 accepted")
    expect(rows[1]!.textContent).toContain("1 accepted")

    const all = screen.getByRole("list", { name: "All time" })
    expect(within(all).getAllByRole("listitem")).toHaveLength(2)
  })

  it("links public helpers to their profiles and never links a private one", () => {
    render(createElement(DriveHelpers, { week: WEEK, all: ALL }))

    const week = screen.getByRole("list", { name: "This week" })
    expect(
      within(week)
        .getByRole("link", { name: "Morag Reid" })
        .getAttribute("href")
    ).toBe("/profile/morag")
    expect(
      within(week).queryByRole("link", { name: "A contributor" })
    ).toBeNull()
    expect(within(week).getByText("A contributor")).toBeTruthy()
  })

  it("can keep to public helpers only, counting the rest", () => {
    render(
      createElement(DriveHelpers, { week: [], all: WEEK, publicOnly: true })
    )

    expect(screen.queryByText("A contributor")).toBeNull()
    expect(
      screen.getByText("And 1 more who keeps their activity private.")
    ).toBeTruthy()
    expect(screen.queryByRole("list", { name: "This week" })).toBeNull()
  })

  it("is honest when nobody has been credited yet", () => {
    render(createElement(DriveHelpers, { week: [], all: [] }))

    expect(screen.getByText("No accepted work yet this week.")).toBeTruthy()
    expect(screen.getByText("No accepted work yet.")).toBeTruthy()
  })
})

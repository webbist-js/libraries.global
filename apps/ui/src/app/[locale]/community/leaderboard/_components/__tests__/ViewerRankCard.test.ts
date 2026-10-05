// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

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

const { ViewerRankCard } = await import("../ViewerRankCard")

describe("ViewerRankCard", () => {
  it("tells an unranked viewer how rankings start", () => {
    render(
      createElement(ViewerRankCard, {
        initials: "KA",
        rank: null,
        periodPhrase: "this month",
      })
    )

    expect(screen.getByText("You’re not ranked yet.")).toBeTruthy()
    expect(
      screen.getByText("Rankings start with your first approved change.")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Make a change" }).getAttribute("href")
    ).toBe("/contribute/index")
  })

  it("gives a viewer ranked below the rows shown their rank", () => {
    render(
      createElement(ViewerRankCard, {
        initials: "KA",
        rank: 1057,
        periodPhrase: "this week",
      })
    )

    expect(screen.getByText("You’re #1,057 this week.")).toBeTruthy()
    expect(screen.queryByText("You’re not ranked yet.")).toBeNull()
  })
})

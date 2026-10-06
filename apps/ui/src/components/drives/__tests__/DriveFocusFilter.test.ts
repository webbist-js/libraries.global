// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

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

const { DriveFocusFilter } = await import("../DriveFocusFilter")

const OPTIONS = [
  { key: "hours" as const, label: "Opening hours", icon: "x", count: 2 },
  { key: "verify" as const, label: "Check details", icon: "x", count: 1 },
]

describe("DriveFocusFilter", () => {
  it("is a labelled list of ?focus= links with counts, after an 'All drives' link", () => {
    render(
      createElement(DriveFocusFilter, {
        options: OPTIONS,
        total: 3,
        active: null,
      })
    )

    const nav = screen.getByRole("navigation", {
      name: "Filter drives by focus",
    })
    const links = within(nav).getAllByRole("link")
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/community#drives",
      "/community?focus=hours#drives",
      "/community?focus=verify#drives",
    ])
    expect(links.map((a) => a.textContent)).toEqual([
      "All drives3",
      "Opening hours2",
      "Check details1",
    ])
  })

  it("marks only the active link with aria-current", () => {
    render(
      createElement(DriveFocusFilter, {
        options: OPTIONS,
        total: 3,
        active: "hours",
      })
    )

    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")
    expect(current.map((a) => a.textContent)).toEqual(["Opening hours2"])
  })

  it("marks 'All drives' current with no focus chosen", () => {
    render(
      createElement(DriveFocusFilter, {
        options: OPTIONS,
        total: 3,
        active: null,
      })
    )

    expect(
      screen
        .getByRole("link", { name: /All drives/ })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("renders nothing with fewer than two kinds to choose between", () => {
    const { container } = render(
      createElement(DriveFocusFilter, {
        options: [OPTIONS[0]!],
        total: 2,
        active: null,
      })
    )

    expect(container.innerHTML).toBe("")
  })
})

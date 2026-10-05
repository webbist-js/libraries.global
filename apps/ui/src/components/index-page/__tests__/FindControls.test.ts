// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// FindControls also exports FindResultsControls, which pulls in the full
// `@/components/ds` barrel (Link, next-intl navigation, …) that this unit
// test doesn't need and can't resolve under vitest's node resolution.
vi.mock("@/components/ds", () => ({
  FilterShowButton: () => null,
  FilterToggleButton: () => null,
}))

const { FindFilterChips } = await import("../FindControls")
const { DEFAULT_FIND_STATE } = await import("../find-helpers")

afterEach(cleanup)

describe("FindFilterChips", () => {
  it("shows a removable Source chip, and Clear all, for a URL-only ?source=", () => {
    const state = { ...DEFAULT_FIND_STATE, source: "imls-pls" }
    const onChange = vi.fn()
    const onClearAll = vi.fn()
    render(
      createElement(FindFilterChips, {
        state,
        onChange,
        onClearAll,
      })
    )

    expect(screen.getByText("Source: imls-pls")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter: Source: imls-pls" })
    )
    expect(onChange).toHaveBeenCalledWith({ source: null, page: 0 })
    expect(onClearAll).not.toHaveBeenCalled()
  })

  it("renders nothing when no filter is active", () => {
    const { container } = render(
      createElement(FindFilterChips, {
        state: DEFAULT_FIND_STATE,
        onChange: vi.fn(),
        onClearAll: vi.fn(),
      })
    )

    expect(container.firstChild).toBeNull()
  })
})

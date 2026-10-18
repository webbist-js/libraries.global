// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { SuggestionList } from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

afterEach(() => {
  cleanup()
})

const { AlreadyInLists, namesInLists } = await import("../AlreadyInLists")

const many = Array.from(
  { length: 30 },
  (_, i) => `Service ${String(i).padStart(2, "0")}`
)

const optionNames: Record<SuggestionList, string[]> = {
  accessibility: ["Step-free access", "Hearing loop"],
  amenities: ["Free Wi-Fi", "hearing loop"],
  services: many,
  library_types: ["Public"],
}

describe("namesInLists", () => {
  it("merges every list for All, without case-insensitive repeats", () => {
    const names = namesInLists(optionNames, "all")

    expect(names).toHaveLength(2 + 1 + 30 + 1)
    expect(names.slice(0, 3)).toEqual(["Free Wi-Fi", "Hearing loop", "Public"])
  })

  it("keeps to one list under a filter", () => {
    expect(namesInLists(optionNames, "accessibility")).toEqual([
      "Hearing loop",
      "Step-free access",
    ])
  })
})

describe("AlreadyInLists", () => {
  it("shows the first 24, then all of them on request", () => {
    render(createElement(AlreadyInLists, { optionNames, filter: "services" }))

    expect(screen.getAllByRole("listitem")).toHaveLength(24)
    const more = screen.getByRole("button", { name: "Show all 30" })
    expect(more.getAttribute("aria-expanded")).toBe("false")

    fireEvent.click(more)

    expect(screen.getAllByRole("listitem")).toHaveLength(30)
    expect(
      screen
        .getByRole("button", { name: "Show fewer" })
        .getAttribute("aria-expanded")
    ).toBe("true")
  })

  it("has no button when everything fits", () => {
    render(
      createElement(AlreadyInLists, { optionNames, filter: "accessibility" })
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByRole("button")).toBeNull()
  })
})

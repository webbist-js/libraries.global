// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { POINTS_TABLE } from "@/lib/community/points"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

afterEach(() => {
  cleanup()
})

const { PointsTableCard } = await import("../PointsTableCard")

describe("PointsTableCard", () => {
  it("is a section named by its heading", () => {
    render(createElement(PointsTableCard))

    expect(screen.getByRole("region", { name: "How points work" })).toBeTruthy()
  })

  it("lists every action with its points as +n", () => {
    const { container } = render(createElement(PointsTableCard))
    const terms = [...container.querySelectorAll("dt")].map(
      (dt) => dt.textContent
    )
    const values = [...container.querySelectorAll("dd")].map(
      (dd) => dd.textContent
    )

    expect(terms).toEqual(POINTS_TABLE.map(([label]) => label))
    expect(values).toEqual(POINTS_TABLE.map(([, value]) => `+${value}`))
    expect(values).toContain("+50")
  })

  it("explains that only approved work earns points", () => {
    render(createElement(PointsTableCard))

    expect(
      screen.getByText(
        "Rejected or reverted changes earn nothing. Staff verification doesn’t depend on points."
      )
    ).toBeTruthy()
  })
})

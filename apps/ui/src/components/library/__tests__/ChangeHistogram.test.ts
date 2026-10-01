// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const { ChangeHistogram, histogramLabel } = await import("../ChangeHistogram")

/** 24 months from Nov 2024 to Oct 2026, all zero unless given. */
function months(counts: Record<string, number> = {}) {
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 10 + i, 1))
    const month = d.toISOString().slice(0, 7)
    const batches = counts[month] ?? 0

    return { month, batches, fields: batches * 2, contributors: batches }
  })
}

afterEach(cleanup)

describe("ChangeHistogram", () => {
  it("draws one bar per month, 24 in all", () => {
    const { container } = render(
      createElement(ChangeHistogram, {
        months: months({ "2025-10": 3 }),
        verificationEvents: [],
      })
    )
    expect(container.querySelectorAll("rect[data-month]")).toHaveLength(24)
  })

  it("labels the chart with the non-zero months and their counts", () => {
    const { getByRole } = render(
      createElement(ChangeHistogram, {
        months: months({ "2025-10": 3, "2026-01": 1 }),
        verificationEvents: [],
      })
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Changes per month, last 24 months")
    expect(label).toContain("3 in Oct 2025")
    expect(label).toContain("1 in Jan 2026")
    expect(label).not.toContain("Nov 2024")
  })

  it("says so when no month has a change", () => {
    expect(histogramLabel(months())).toBe(
      "Changes per month, last 24 months: none."
    )
  })

  it("repeats the numbers in a visually hidden table", () => {
    const { container } = render(
      createElement(ChangeHistogram, {
        months: months({ "2025-10": 3 }),
        verificationEvents: [],
      })
    )
    const table = container.querySelector("table")!
    expect(table.className).toContain("sr-only")
    expect(table.querySelectorAll("tbody tr")).toHaveLength(24)
    expect(table.textContent).toContain("Oct 2025")
  })

  it("marks months with a verification and explains the mark", () => {
    const { container, getByText } = render(
      createElement(ChangeHistogram, {
        months: months({ "2025-10": 3 }),
        verificationEvents: ["2025-10", "2026-02"],
      })
    )
    expect(container.querySelectorAll("[data-checked]")).toHaveLength(2)
    expect(getByText("Checked")).toBeTruthy()
  })

  it("labels every sixth month on the axis", () => {
    const { container } = render(
      createElement(ChangeHistogram, {
        months: months(),
        verificationEvents: [],
      })
    )
    expect(container.querySelectorAll("text[data-axis]")).toHaveLength(4)
  })
})

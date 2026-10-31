// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { PlanCompareTable } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareTable"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

afterEach(cleanup)

it("compares two selected plans on mobile using the same export limits as the full matrix", () => {
  render(<PlanCompareTable />)
  const mobile = within(
    screen.getByRole("region", { name: "Compare two plans" })
  )
  expect(mobile.getByText("10,000")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("Second plan"), {
    target: { value: "supporter" },
  })
  expect(mobile.getByText("500")).toBeTruthy()
  expect(mobile.queryByText("10,000")).toBeNull()
  fireEvent.click(mobile.getByRole("button", { name: /Atlas analysis/ }))
  expect(mobile.queryByRole("table", { name: /Atlas analysis/ })).toBeNull()
  fireEvent.click(mobile.getByRole("button", { name: /Atlas analysis/ }))
  expect(mobile.getByRole("table", { name: /Atlas analysis/ })).toBeTruthy()
})

it("keeps the highlighted column distinct from the current membership and syncs the mobile selection", () => {
  render(<PlanCompareTable currentPlan="pro" />)
  const full = within(
    screen.getByRole("region", { name: "What each plan includes" })
  )
  const team = full.getByRole("button", { name: /Team £600/ })
  fireEvent.click(team)
  expect(team.getAttribute("aria-pressed")).toBe("true")
  const pro = full.getByRole("button", { name: /Pro.*Your plan/ })
  expect(pro.getAttribute("aria-pressed")).toBe("false")
  expect(
    (screen.getByLabelText("Second plan") as HTMLSelectElement).value
  ).toBe("team")
})

it("filters roadmap features across both layouts without losing the selected plans", () => {
  render(<PlanCompareTable currentPlan="pro" />)
  const controls = within(
    screen.getByRole("region", { name: "Comparison controls" })
  )
  fireEvent.change(controls.getByLabelText("Second plan"), {
    target: { value: "team" },
  })
  const full = within(
    screen.getByRole("region", { name: "What each plan includes" })
  )
  const mobile = within(
    screen.getByRole("region", { name: "Compare two plans" })
  )
  expect(
    full.getByRole("row", { name: /Transit stops and lines/ })
  ).toBeTruthy()
  expect(
    mobile.getByRole("row", { name: /Transit stops and lines/ })
  ).toBeTruthy()

  fireEvent.click(controls.getByRole("radio", { name: "Available now" }))
  expect(
    full.queryByRole("row", { name: /Transit stops and lines/ })
  ).toBeNull()
  expect(
    mobile.queryByRole("row", { name: /Transit stops and lines/ })
  ).toBeNull()
  expect(
    full.getByRole("row", { name: /Export Atlas results as CSV/ })
  ).toBeTruthy()
  expect(
    full.getByRole("button", { name: /Team £600/ }).getAttribute("aria-pressed")
  ).toBe("true")
  expect(
    (controls.getByLabelText("Second plan") as HTMLSelectElement).value
  ).toBe("team")

  fireEvent.click(controls.getByRole("radio", { name: "All features" }))
  expect(
    mobile.getByRole("row", { name: /Transit stops and lines/ })
  ).toBeTruthy()
})

it("expands and collapses the visible feature groups from the shared toolbar", () => {
  render(<PlanCompareTable />)
  const controls = within(
    screen.getByRole("region", { name: "Comparison controls" })
  )
  const mobile = within(
    screen.getByRole("region", { name: "Compare two plans" })
  )
  fireEvent.click(controls.getByRole("button", { name: "Expand all groups" }))
  expect(
    mobile
      .getAllByRole("button")
      .every((button) => button.getAttribute("aria-expanded") === "true")
  ).toBe(true)
  fireEvent.click(controls.getByRole("button", { name: "Collapse all groups" }))
  expect(mobile.queryAllByRole("table")).toHaveLength(0)
  expect(controls.getByText(/^Showing 0 of/)).toBeTruthy()
  fireEvent.click(controls.getByRole("radio", { name: "Available now" }))
  fireEvent.click(controls.getByRole("button", { name: "Expand all groups" }))
  expect(
    mobile
      .getAllByRole("button")
      .every((button) => button.getAttribute("aria-expanded") === "true")
  ).toBe(true)
})

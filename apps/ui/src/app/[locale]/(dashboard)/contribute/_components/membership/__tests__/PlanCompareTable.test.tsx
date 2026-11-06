// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { PlanCompareTable } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareTable"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

afterEach(cleanup)

it("compares two selected options on mobile using the resolver's Reach allowances", () => {
  render(<PlanCompareTable />)
  const mobile = within(
    screen.getByRole("region", { name: "Compare two options" })
  )
  expect(mobile.getByText("2 a week")).toBeTruthy()
  choose(screen.getByLabelText("Second option"), "API Access")
  expect(mobile.getByText("20 an hour")).toBeTruthy()
  expect(mobile.queryByText("2 a week")).toBeNull()
  fireEvent.click(mobile.getByRole("button", { name: /Atlas analysis/ }))
  expect(mobile.queryByRole("table", { name: /Atlas analysis/ })).toBeNull()
  fireEvent.click(mobile.getByRole("button", { name: /Atlas analysis/ }))
  expect(mobile.getByRole("table", { name: /Atlas analysis/ })).toBeTruthy()
})

it("links unbuilt rows to roadmap items the published Roadmap still lists", () => {
  render(<PlanCompareTable roadmapKeys={["compare-libraries"]} />)
  const full = within(screen.getByRole("region", { name: "What’s included" }))
  fireEvent.click(full.getByRole("button", { name: /Watching and comparing/ }))
  const links = full.getAllByRole("link", { name: /On the roadmap/ })
  expect(links).toHaveLength(1)
  expect(links[0]!.getAttribute("href")).toMatch(
    /\/community\/roadmap#roadmap-compare-libraries$/
  )
  expect(links[0]!.textContent).toMatch(/Compare up to six libraries/)
})

it("keeps the highlighted column distinct from what the viewer has and syncs the mobile selection", () => {
  render(<PlanCompareTable held={["explorer", "staff"]} />)
  const full = within(screen.getByRole("region", { name: "What’s included" }))
  const api = full.getByRole("button", { name: /API Access £100\/month/ })
  fireEvent.click(api)
  expect(api.getAttribute("aria-pressed")).toBe("true")
  const staff = full.getByRole("button", {
    name: /Verified Staff.*You have this/,
  })
  expect(staff.getAttribute("aria-pressed")).toBe("false")
  expect(screen.getByLabelText("Second option").textContent).toBe("API Access")
})

it("shows staff tools only in the Verified Staff column", () => {
  render(<PlanCompareTable />)
  const full = within(screen.getByRole("region", { name: "What’s included" }))
  const row = full.getByRole("row", { name: /Embeddable widgets/ })
  expect(within(row).getAllByText("Included")).toHaveLength(1)
})

it("filters roadmap features across both layouts without losing the selection", () => {
  render(<PlanCompareTable />)
  const controls = within(
    screen.getByRole("region", { name: "Comparison controls" })
  )
  const full = within(screen.getByRole("region", { name: "What’s included" }))
  expect(full.getByRole("row", { name: /Traffic reports/ })).toBeTruthy()
  fireEvent.click(controls.getByRole("radio", { name: "Available now" }))
  expect(full.queryByRole("row", { name: /Traffic reports/ })).toBeNull()
  expect(
    full.getByRole("row", { name: /Export Atlas results as CSV/ })
  ).toBeTruthy()
  fireEvent.click(controls.getByRole("radio", { name: "All features" }))
  expect(full.getByRole("row", { name: /Traffic reports/ })).toBeTruthy()
})

it("expands and collapses the visible feature groups from the shared toolbar", () => {
  render(<PlanCompareTable />)
  const controls = within(
    screen.getByRole("region", { name: "Comparison controls" })
  )
  const mobile = within(
    screen.getByRole("region", { name: "Compare two options" })
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
})

function choose(control: HTMLElement, label: string) {
  fireEvent.keyDown(control, { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: label }))
}

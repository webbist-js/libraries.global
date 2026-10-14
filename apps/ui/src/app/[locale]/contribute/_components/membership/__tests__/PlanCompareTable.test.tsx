// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))
vi.mock("next-intl", () => ({ useTranslations: () => translate }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

import { PlanCompareTable } from "../PlanCompareTable"

afterEach(cleanup)

it("compares two selected plans on mobile using the same export limits as the full matrix", () => {
  render(<PlanCompareTable />)
  const mobile = within(
    screen.getByRole("region", { name: "Compare two plans" })
  )
  expect(mobile.getByText("10,000")).toBeTruthy()
  fireEvent.change(mobile.getByLabelText("Second plan"), {
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

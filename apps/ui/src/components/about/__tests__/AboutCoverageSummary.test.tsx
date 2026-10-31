// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { AboutCoverageSummary } from "@/components/about/AboutCoverageSummary"
import { cleanup, render, screen } from "@/test/render"

vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
afterEach(cleanup)

it("shows the live published totals and community activity with the existing methodology destination", () => {
  render(
    <AboutCoverageSummary
      stats={{
        libraries: 48285,
        countries: 25,
        contributors: 1,
        contributionsThisMonth: 7,
      }}
    />
  )
  for (const text of [
    "48,285",
    "libraries published",
    "25",
    "countries",
    "1",
    "contributor",
    "7",
    "changes this month",
  ]) {
    expect(screen.getByText(text)).toBeTruthy()
  }
  expect(
    screen.getByRole("link", { name: "How we count" }).getAttribute("href")
  ).toBe("/knowledge/data-api/how-we-count")
})
it("keeps recorded zeros honest and hides empty community activity", () => {
  render(
    <AboutCoverageSummary
      stats={{
        libraries: 0,
        countries: 0,
        contributors: 0,
        contributionsThisMonth: 0,
      }}
    />
  )
  expect(screen.getAllByText("0")).toHaveLength(2)
  expect(screen.queryByText("contributors")).toBeNull()
  expect(screen.queryByText("changes this month")).toBeNull()
})
it("offers the index when counts are unavailable without inventing totals", () => {
  render(<AboutCoverageSummary stats={null} />)
  expect(screen.getByRole("status").textContent).toContain("unavailable")
  expect(screen.queryByText("0")).toBeNull()
  expect(screen.queryByText("libraries published")).toBeNull()
  expect(
    screen.getByRole("link", { name: "Browse the index" }).getAttribute("href")
  ).toBe("/libraries")
})

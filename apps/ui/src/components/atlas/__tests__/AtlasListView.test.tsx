// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import type { AtlasLibrary } from "../atlas.logic"
import { AtlasListView } from "../AtlasListView"

vi.mock("../AtlasExportButton", () => ({ AtlasExportButton: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))
afterEach(cleanup)
const libraries: AtlasLibrary[] = [
  ["Zulu", 25],
  ["Alpha", 80],
  ["Beta", 50],
].map(([name, complete], n) => ({
  id: String(n),
  name: String(name),
  complete: Number(complete),
  slug: String(n),
  type: "Public",
  status: "open",
  operator: null,
  city: "London",
  country: "England",
  region: null,
  path: null,
  tz: null,
  hours: null,
  founded: null,
  closed: null,
  events: false,
  catalogue: false,
  access: [],
  services: [],
  lat: 51.5,
  lng: n,
}))
function list(rows = libraries, onSelect = vi.fn()) {
  return render(
    <AtlasListView
      libraries={rows}
      center={{ lat: 51.5, lng: 0 }}
      now={new Date("2026-10-26T12:00:00Z")}
      onHover={vi.fn()}
      onSelect={onSelect}
      onShowMap={vi.fn()}
      onSeePlans={vi.fn()}
    />
  )
}
const names = () =>
  screen.getAllByRole("rowheader").map((row) => row.textContent)
it("inspects a library from its name or row without navigating away", () => {
  const onSelect = vi.fn()
  list(libraries, onSelect)
  const name = screen.getByRole("button", { name: "Alpha" })
  fireEvent.click(name)
  expect(onSelect).toHaveBeenCalledOnce()
  expect(onSelect).toHaveBeenLastCalledWith(libraries[1], name)
  fireEvent.click(name.closest("tr")!.querySelector("td")!)
  expect(onSelect).toHaveBeenCalledTimes(2)
  expect(onSelect).toHaveBeenLastCalledWith(libraries[1], name)
})
it("reverses name order when the same column is clicked again", () => {
  list()
  fireEvent.click(screen.getByRole("button", { name: "Sort by name" }))
  const first = names()
  fireEvent.click(screen.getByRole("button", { name: "Sort by name" }))
  expect(names()).toEqual([...first].reverse())
})
it("sorts all rows by most and least complete records", () => {
  list()
  fireEvent.click(
    screen.getByRole("button", { name: "Sort by record completeness" })
  )
  expect(names()).toEqual(["Alpha", "Beta", "Zulu"])
  expect(
    screen
      .getByRole("button", { name: "Sort by record completeness" })
      .closest("th")
      ?.getAttribute("aria-sort")
  ).toBe("descending")
  fireEvent.click(
    screen.getByRole("button", { name: "Sort by record completeness" })
  )
  expect(names()).toEqual(["Zulu", "Beta", "Alpha"])
})
it("keeps unscored records last in both directions without displaying a zero score", () => {
  list([
    ...libraries,
    {
      ...libraries[0]!,
      id: "unknown",
      name: "Unscored",
      complete: 0,
      completenessKnown: false,
    },
  ])
  for (let i = 0; i < 2; i++) {
    fireEvent.click(
      screen.getByRole("button", { name: "Sort by record completeness" })
    )
    expect(names().at(-1)).toBe("Unscored")
    expect(screen.getByText("Not scored")).toBeTruthy()
  }
})

// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@/components/library/LibraryCorrection", () => ({
  OpenCorrectionLink: ({ children }: { children: React.ReactNode }) =>
    h("a", { href: "#correct-location" }, children),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    h("a", { href }, children),
}))
vi.mock("@/components/library/LibraryEventsEmptyAction", () => ({
  LibraryEventsEmptyAction: () => null,
}))
const { LibraryMissingDetails } = await import("../LibraryMissingDetails")
afterEach(cleanup)

it("asks for a missing map location without claiming no neighbouring libraries exist", () => {
  render(
    h(LibraryMissingDetails, {
      library: { location: null } as never,
      missing: ["nearby"],
      addHref: "/contribute/index/new",
    })
  )
  expect(
    screen.getByText(
      "Add this library’s map location to find nearby libraries."
    )
  ).toBeTruthy()
  expect(screen.getByRole("link", { name: "Add the location" })).toBeTruthy()
  expect(screen.queryByText(/No other libraries are listed nearby/)).toBeNull()
  expect(
    screen.queryByRole("link", { name: "Add a missing library" })
  ).toBeNull()
})

it("keeps a mapped library’s empty nearby result and missing-library action", () => {
  render(
    h(LibraryMissingDetails, {
      library: { location: { lat: 51, lng: -121 } } as never,
      missing: ["nearby"],
      addHref: "/contribute/index/new",
    })
  )
  expect(
    screen.getByText("No other libraries are listed nearby in the index yet.")
  ).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Add a missing library" })
      .getAttribute("href")
  ).toBe("/contribute/index/new")
  expect(screen.queryByRole("link", { name: "Add the location" })).toBeNull()
})

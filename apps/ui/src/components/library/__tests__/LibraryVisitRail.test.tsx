// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/library/LibraryHoursTable", () => ({
  LibraryOpenStatusBadge: () => null,
}))
vi.mock("@/components/library/StaffLibraryEntry", () => ({
  StaffLibraryEntry: () => null,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    h("a", { href }, children),
}))
const { LibraryVisitRail } = await import("../LibraryVisitRail")
afterEach(cleanup)

it("keeps three official links visible and puts all remaining valid links in one disclosure", () => {
  const { container } = render(
    h(LibraryVisitRail, {
      library: {
        name: "Library",
        documentId: "lib",
        website: "https://example.org",
        catalogueUrl: "https://example.org/catalogue",
        planVisitUrl: "https://example.org/visit",
        membershipUrl: "https://example.org/join",
        bookingUrl: "https://example.org/book",
        wikidataId: "Q1",
        iiifEndpoint: "ftp://example.org",
      } as never,
    })
  )
  const disclosure = container.querySelector("details")!
  expect(disclosure.open).toBe(false)
  expect(
    within(disclosure).getAllByRole("link", { hidden: true })
  ).toHaveLength(3)
  expect(screen.getByText("All 6 links")).toBeTruthy()
  expect(container.querySelectorAll('a[href^="ftp:"]')).toHaveLength(0)
  expect(
    screen.getByRole("link", { name: "Official website" }).closest("details")
  ).toBeNull()
  expect(
    screen
      .getByRole("link", { name: /Improve this record/ })
      .getAttribute("href")
  ).toBe("#contribute")
})
it("offers mobile stops instead of directions to a static location", () => {
  render(
    h(LibraryVisitRail, {
      library: {
        documentId: "lib",
        libraryType: "Mobile",
        location: { lat: 52, lng: -3 },
      } as never,
    })
  )
  expect(
    screen.getByRole("link", { name: /Stops & times/ }).getAttribute("href")
  ).toBe("#stops")
  expect(screen.queryByRole("link", { name: /Get directions/ })).toBeNull()
})
it("uses online access for digital libraries without a map directions action", () => {
  render(
    h(LibraryVisitRail, {
      library: {
        documentId: "lib",
        libraryType: "Digital",
        location: { lat: 52, lng: -3 },
      } as never,
    })
  )
  expect(screen.getByRole("heading", { name: "Online access" })).toBeTruthy()
  expect(screen.queryByRole("link", { name: /Get directions/ })).toBeNull()
})

it("retains the operator type when it is the only operator detail recorded", () => {
  render(
    h(LibraryVisitRail, {
      library: { documentId: "lib", operatorType: "Municipality" } as never,
    })
  )
  expect(screen.getByText("Run by Municipality")).toBeTruthy()
})

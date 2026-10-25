// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/library/LibraryCorrection", () => ({
  OpenCorrectionLink: () => null,
  OpenVerifyLink: () => null,
}))
vi.mock("@/components/library/LibraryHoursTable", () => ({
  LibraryHoursTable: () => null,
}))
vi.mock("@/components/library/LibraryCopyButton", () => ({
  LibraryCopyButton: () => null,
}))
vi.mock("@/components/library/LibraryAboutDisclosure", () => ({
  LibraryAboutDisclosure: ({ children }: { children: React.ReactNode }) =>
    h("div", null, children),
}))
vi.mock("@/lib/navigation", () => ({ Link: () => null }))
const { LibraryCollectionsSection } = await import("../LibrarySections")
afterEach(cleanup)

it("shows six key facts including dates, with every remaining figure and its notes in a disclosure", () => {
  const library = {
    name: "Full library",
    slug: "full",
    summary: "A library with detailed collections.",
    foundedYear: "1711",
    openedYear: "1896",
    collectionStats: Array.from({ length: 8 }, (_, index) => ({
      value: `${index + 1} million`,
      category: `Collection ${index}`,
      description: `Source year 202${index}`,
    })),
    libraryStats: [
      { value: "10,000", label: "Visitors", note: "Annual report 2025" },
    ],
  }
  const { container } = render(
    h(LibraryCollectionsSection, { library: library as never })
  )
  expect(
    container.querySelectorAll('[aria-label="Library timeline"] > li')
  ).toHaveLength(2)
  expect(
    container.querySelectorAll('[aria-label="Collection figures"] > div')
  ).toHaveLength(4)
  const summary = screen.getByText("All 9 figures")
  const disclosure = summary.closest("details")!
  expect(disclosure.open).toBe(false)
  expect(disclosure.textContent).toContain("Annual report 2025")
  expect(disclosure.textContent).toContain("Source year 2027")
  expect(disclosure.querySelectorAll("dl > div")).toHaveLength(9)
})

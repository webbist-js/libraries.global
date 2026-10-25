// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

Object.assign(globalThis, { React })
const drawer = vi.hoisted(() => ({ open: vi.fn(), verify: vi.fn() }))
vi.mock("@/components/library/LibraryCorrection", () => ({
  useCorrectionDrawer: () => drawer,
}))
vi.mock("@/components/library/LibraryDriveNote", () => ({
  LibraryDriveNote: ({ fallback }: { fallback: React.ReactNode }) => fallback,
}))
vi.mock("@/components/library/LibraryHelpPanel", () => ({
  translateHref: (slug: string, locale: string) =>
    `/contribute/index/${slug}?locale=${locale}`,
}))
vi.mock("@/components/mobile/useMobileClock", () => ({
  useMobileClock: () => new Date("2026-10-24T12:00:00Z"),
}))
vi.mock("@/hooks/useMounted", () => ({ useMounted: () => true }))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user" } } }) },
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => h("a", { href, ...props }, children),
}))
const { LibraryFeaturedContribution } =
  await import("../LibraryFeaturedContribution")
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const props = {
  library: {
    name: "Library",
    slug: "library",
    documentId: "lib",
    libraryType: "Public",
  },
  unanswered: 6,
  hasHours: true,
  hasPhoto: false,
  path: "/library",
}

it("offers one primary task and three next tasks, with a working schedule verification action", () => {
  const { container } = render(
    h(LibraryFeaturedContribution, {
      ...props,
      gaps: ["photo", "about", "hours", "history", "address"],
    })
  )
  expect(
    screen.getByRole("link", { name: "Answer a question" }).getAttribute("href")
  ).toBe("#access")
  const list = screen
    .getByRole("heading", { name: "Next tasks" })
    .parentElement!.querySelector("ul")!
  expect(list.children).toHaveLength(3)
  const details = container.querySelector("details")!
  expect(details.open).toBe(false)
  fireEvent.click(details.querySelector("summary")!)
  expect(details.open).toBe(true)
  expect(details.textContent).toContain("Add a date from its history")
  fireEvent.click(
    screen.getByRole("button", { name: /^Check the opening hours/ })
  )
  expect(drawer.verify).toHaveBeenCalledWith(["hours"])
  expect(drawer.open).not.toHaveBeenCalled()
  expect(
    screen.getByText("You’re signed in. Review your contribution and send it.")
  ).toBeTruthy()
})
it("prioritises a missing mobile timetable over facility questions and opens the existing editor", () => {
  render(
    h(LibraryFeaturedContribution, {
      ...props,
      library: { ...props.library, libraryType: "Mobile" },
      hasHours: false,
    })
  )
  expect(
    screen.getByRole("heading", { name: "Add stops and times" })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Add the schedule" }))
  expect(drawer.open).toHaveBeenCalledWith("Stops & times")
  expect(drawer.verify).not.toHaveBeenCalled()
})
it("omits hours tasks for digital libraries", () => {
  render(
    h(LibraryFeaturedContribution, {
      ...props,
      library: { ...props.library, libraryType: "Digital" },
      unanswered: 0,
      hasHours: false,
      hasPhoto: true,
    })
  )
  expect(
    screen.getByRole("heading", { name: "Suggest a correction" })
  ).toBeTruthy()
  expect(screen.queryByText("Add the opening hours")).toBeNull()
})

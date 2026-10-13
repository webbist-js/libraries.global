// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })

const staff = vi.hoisted(() => ({
  ready: true,
  mounted: true,
  can: new Set<string>(),
  libraries: [] as { id: string; libraryType: string }[],
}))

vi.mock("@/hooks/useMounted", () => ({ useMounted: () => staff.mounted }))

vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({
    ready: staff.ready,
    libraries: staff.libraries,
    can: (action: string, id: string) => staff.can.has(`${action}:${id}`),
  }),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/library/LibraryClaimButton", async () => {
  const { createElement: h } = await import("react")

  return {
    LibraryClaimButton: () =>
      h("button", { type: "button" }, "Claim this library"),
  }
})
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const { StaffLibraryEntry } = await import("../StaffLibraryEntry")

const ID = "lib000000000000000000001"
const props = {
  libraryDocumentId: ID,
  librarySlug: "central-library",
  libraryName: "Central Library",
}

afterEach(() => {
  cleanup()
  staff.ready = true
  staff.mounted = true
  staff.can.clear()
  staff.libraries = []
})

/** The same-height placeholder: hidden from assistive tech, no copy. */
const placeholder = (container: HTMLElement) =>
  container.querySelector(String.raw`[aria-hidden="true"].min-h-\[52px\]`)

describe("StaffLibraryEntry", () => {
  it("holds the space with a placeholder until the session is known", () => {
    staff.ready = false
    const { container } = render(createElement(StaffLibraryEntry, props))
    expect(placeholder(container)).toBeTruthy()
    expect(container.textContent).toBe("")
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("shows the placeholder until mounted, even with a session in the store", () => {
    staff.mounted = false
    staff.can.add(`edit:${ID}`)
    const { container } = render(createElement(StaffLibraryEntry, props))
    expect(placeholder(container)).toBeTruthy()
    expect(container.textContent).toBe("")
  })

  it("shows the claim button to everyone who isn't staff", () => {
    render(createElement(StaffLibraryEntry, props))
    expect(
      screen.getByRole("button", { name: "Claim this library" })
    ).toBeTruthy()
    expect(screen.queryByText(/You run this/)).toBeNull()
  })

  it("gives staff of a building library the dark card and the staff area link, no Go live", () => {
    staff.can.add(`edit:${ID}`)
    render(
      createElement(StaffLibraryEntry, { ...props, libraryType: "Public" })
    )
    expect(
      screen.getByRole("heading", { name: "You run this library" })
    ).toBeTruthy()
    expect(
      screen.getByText("Keep the record, hours and notices up to date.")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Open the Staff area/ })
        .getAttribute("href")
    ).toBe("/staff/central-library")
    expect(screen.queryByRole("link", { name: /Go live/ })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Claim this library" })
    ).toBeNull()
  })

  it("offers to connect an event feed only while none is active", () => {
    staff.can.add(`edit:${ID}`)
    const { unmount } = render(createElement(StaffLibraryEntry, props))
    expect(
      screen
        .getByRole("link", { name: /Connect an event feed/ })
        .getAttribute("href")
    ).toBe("/staff/central-library/events/connect")
    unmount()

    render(createElement(StaffLibraryEntry, { ...props, hasActiveFeed: true }))
    expect(
      screen.queryByRole("link", { name: /Connect an event feed/ })
    ).toBeNull()
  })

  it("tells Mobile staff who may not go live to ask an owner", () => {
    staff.can.add(`edit:${ID}`)
    render(
      createElement(StaffLibraryEntry, { ...props, libraryType: "Mobile" })
    )
    expect(
      screen.getByText("Live updates are off for you: ask an owner.")
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Go live/ })).toBeNull()
  })

  it("offers Go live only to Mobile staff who may go live", () => {
    staff.can.add(`edit:${ID}`)
    const { unmount } = render(
      createElement(StaffLibraryEntry, { ...props, libraryType: "Mobile" })
    )
    expect(
      screen.getByRole("heading", { name: "You run this mobile library" })
    ).toBeTruthy()
    expect(
      screen.getByText(/Share today.s route live from your phone/)
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Go live/ })).toBeNull()
    unmount()

    staff.can.add(`goLive:${ID}`)
    render(
      createElement(StaffLibraryEntry, { ...props, libraryType: "Mobile" })
    )
    expect(
      screen.getByRole("link", { name: /Go live/ }).getAttribute("href")
    ).toBe(`/live/${ID}`)
  })

  it("falls back to the session's library type when the page gives none", () => {
    staff.can.add(`edit:${ID}`)
    staff.can.add(`goLive:${ID}`)
    staff.libraries = [{ id: ID, libraryType: "Mobile" }]
    render(createElement(StaffLibraryEntry, props))
    expect(
      screen.getByRole("heading", { name: "You run this mobile library" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: /Go live/ })).toBeTruthy()
  })
})

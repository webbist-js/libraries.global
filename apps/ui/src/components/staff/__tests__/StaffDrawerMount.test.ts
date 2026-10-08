// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const state = vi.hoisted(() => ({
  libraries: [] as { id: string }[],
  ready: true,
  pathname: "/europe/uk/kent/central-library",
}))

vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({ libraries: state.libraries, ready: state.ready }),
}))
vi.mock("@/lib/navigation", () => ({ usePathname: () => state.pathname }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/staff/StaffDrawer", async () => {
  const { createElement: h } = await import("react")

  return {
    StaffDrawer: () =>
      h("div", { role: "dialog", "aria-label": "Staff drawer" }),
  }
})

const { StaffDrawerMount } = await import("../StaffDrawerMount")
const { closeStaffDrawer, useStaffDrawer } = await import("@/lib/staff/drawer")

const altS = (target: Window | Element = window) =>
  fireEvent.keyDown(target, { key: "s", code: "KeyS", altKey: true })
const tab = () =>
  screen.queryByRole("button", { name: "Open the staff drawer" })
const drawer = () => screen.queryByRole("dialog", { name: "Staff drawer" })

afterEach(() => {
  cleanup()
  closeStaffDrawer()
  state.libraries = []
  state.ready = true
  state.pathname = "/europe/uk/kent/central-library"
})

describe("StaffDrawerMount", () => {
  it("renders nothing, and ignores the shortcut, for everyone who isn't staff", () => {
    const { container } = render(createElement(StaffDrawerMount))
    expect(container.innerHTML).toBe("")
    altS()
    expect(drawer()).toBeNull()
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing until the session is ready", () => {
    state.libraries = [{ id: "lib1" }]
    state.ready = false
    const { container } = render(createElement(StaffDrawerMount))
    expect(container.innerHTML).toBe("")
  })

  it("shows the edge tab to staff, which opens the drawer and then hides itself", () => {
    state.libraries = [{ id: "lib1" }]
    render(createElement(StaffDrawerMount))
    const open = tab()
    expect(open).toBeTruthy()
    expect(open?.getAttribute("title")).toBe("Staff drawer (Alt+S)")
    expect(drawer()).toBeNull()
    fireEvent.click(open!)
    expect(drawer()).toBeTruthy()
    expect(tab()).toBeNull()
  })

  it("toggles with Alt+S, but not while typing or with other modifiers", () => {
    state.libraries = [{ id: "lib1" }]
    render(
      createElement(
        StaffDrawerMount,
        null,
        createElement("input", { "aria-label": "Search" })
      )
    )
    altS()
    expect(drawer()).toBeTruthy()
    altS()
    expect(drawer()).toBeNull()
    fireEvent.keyDown(window, {
      key: "s",
      code: "KeyS",
      altKey: true,
      ctrlKey: true,
    })
    expect(drawer()).toBeNull()
    fireEvent.keyDown(window, { key: "s", code: "KeyS" })
    expect(drawer()).toBeNull()
    const input = document.createElement("input")
    document.body.append(input)
    altS(input)
    expect(drawer()).toBeNull()
    input.remove()
  })

  it("hides the tab on the map, the live console and the staff area, where Alt+S still works", () => {
    state.libraries = [{ id: "lib1" }]
    // next-intl's usePathname strips the locale, so paths arrive unprefixed.
    for (const path of ["/map", "/live/abc", "/staff", "/staff/lib1/edit"]) {
      state.pathname = path
      const view = render(createElement(StaffDrawerMount))
      expect(tab(), path).toBeNull()
      view.unmount()
    }
    state.pathname = "/staff/lib1"
    render(createElement(StaffDrawerMount))
    altS()
    expect(drawer()).toBeTruthy()
    cleanup()
    closeStaffDrawer()
    // A lookalike section keeps its tab.
    state.pathname = "/staffroom"
    render(createElement(StaffDrawerMount))
    expect(tab()).toBeTruthy()
  })

  it("exposes the open state through the shared store", () => {
    state.libraries = [{ id: "lib1" }]
    const Probe = () =>
      createElement("output", null, String(useStaffDrawer().open))
    render(
      createElement(
        React.Fragment,
        null,
        createElement(StaffDrawerMount),
        createElement(Probe)
      )
    )
    expect(screen.getByRole("status").textContent).toBe("false")
    altS()
    expect(screen.getByRole("status").textContent).toBe("true")
  })
})

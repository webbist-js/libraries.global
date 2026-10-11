// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { Sheet } = await import("../Sheet")

afterEach(cleanup)

const open = (extra: Partial<Parameters<typeof Sheet>[0]> = {}) => {
  const onClose = vi.fn()
  render(
    h(Sheet, {
      open: true,
      onClose,
      side: "bottom",
      title: "Remove this stop?",
      footer: h("button", { type: "button" }, "Remove Ford Cross"),
      children: h("p", null, "Every visit there comes off the timetable."),
      ...extra,
    })
  )

  return onClose
}

describe("Sheet", () => {
  it("is a dialog named by its title, with the body and footer inside, and hides the page behind it", () => {
    const outside = document.createElement("p")
    outside.textContent = "The page"
    document.body.append(outside)
    open()
    const dialog = screen.getByRole("dialog", { name: "Remove this stop?" })
    // Radix marks everything outside the dialog aria-hidden while it is open.
    expect(outside.getAttribute("aria-hidden")).toBe("true")
    outside.remove()
    expect(
      within(dialog).getByText("Every visit there comes off the timetable.")
    ).toBeTruthy()
    expect(
      within(dialog).getByRole("button", { name: "Remove Ford Cross" })
    ).toBeTruthy()
  })

  it("closes from its Close button and on Escape", () => {
    const onClose = open()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("can be named from another element instead", () => {
    open({ labelledBy: "stop-sheet-title" })
    const dialog = screen.getByRole("dialog", { name: "Remove this stop?" })
    expect(dialog.getAttribute("aria-labelledby")).toBe("stop-sheet-title")
    expect(document.getElementById("stop-sheet-title")?.textContent).toBe(
      "Remove this stop?"
    )
  })

  it("renders nothing while closed", () => {
    render(
      h(Sheet, {
        open: false,
        onClose: vi.fn(),
        side: "right",
        title: "Hidden",
        children: h("p", null, "Body"),
      })
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByText("Body")).toBeNull()
  })
})

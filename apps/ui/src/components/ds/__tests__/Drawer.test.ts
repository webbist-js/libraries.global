// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { Drawer } = await import("../Drawer")

afterEach(() => {
  cleanup()
  document.documentElement.style.overflow = ""
})

function open(
  onClose = vi.fn(),
  extra: Partial<Parameters<typeof Drawer>[0]> = {}
) {
  const trigger = document.createElement("button")
  trigger.textContent = "Open"
  document.body.append(trigger)
  trigger.focus()
  const view = render(
    h(
      Drawer,
      {
        titleId: "drawer-title",
        title: "Suggest a correction",
        subtitle: "Nailsea Library · Nailsea",
        onClose,
        ...extra,
      },
      h("label", { htmlFor: "f" }, "Field"),
      h("input", { id: "f" }),
      h("button", { type: "button" }, "Send")
    )
  )

  return { onClose, trigger, view }
}

describe("Drawer", () => {
  it("is a modal dialog named by its title, with the line under it", () => {
    open()
    const dialog = screen.getByRole("dialog", { name: "Suggest a correction" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(screen.getByText("Nailsea Library · Nailsea")).toBeTruthy()
  })

  it("starts on the first field, and gives focus back on close", () => {
    const { trigger, view } = open()
    expect(document.activeElement).toBe(screen.getByLabelText("Field"))
    view.unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it("can start somewhere else", () => {
    open(vi.fn(), {
      initialFocus: (panel) =>
        panel.querySelector<HTMLElement>("button:not([aria-label])"),
    })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Send" })
    )
  })

  it("locks the page's scroll while open", () => {
    document.documentElement.style.overflow = "auto"
    const { view } = open()
    expect(document.documentElement.style.overflow).toBe("hidden")
    view.unmount()
    expect(document.documentElement.style.overflow).toBe("auto")
  })

  it("closes on Escape, on Close and on the backdrop", () => {
    const { onClose } = open()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    const [backdrop, close] = screen.getAllByRole("button", { name: "Close" })
    fireEvent.click(close!)
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it("keeps Tab inside the dialog", () => {
    open()
    const send = screen.getByRole("button", { name: "Send" })
    // The header's Close is the first stop; Send is the last.
    const close = screen.getAllByRole("button", { name: "Close" })[1]!
    send.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(send)
  })
})

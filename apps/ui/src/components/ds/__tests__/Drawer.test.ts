// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { Drawer } = await import("../Drawer")
const { DrawerPresence } = await import("../DrawerPresence")

afterEach(() => {
  cleanup()
  document.documentElement.style.overflow = ""
  document
    .querySelectorAll("button[data-drawer-test-trigger]")
    .forEach((el) => el.remove())
})

function open(
  onClose = vi.fn(),
  extra: Partial<Parameters<typeof Drawer>[0]> = {}
) {
  const trigger = document.createElement("button")
  trigger.textContent = "Open"
  trigger.dataset.drawerTestTrigger = ""
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
  it("pins workspace headers and footers outside the scrolling middle", () => {
    open(vi.fn(), {
      size: "md",
      edgeAligned: true,
      footer: h("footer", null, "Workspace"),
    })
    const panel = screen.getByRole("dialog")
    const body = panel.querySelector("[data-drawer-body]")!
    expect(panel.dataset.drawerEdge).toBe("true")
    expect(panel.className).toContain("inset-y-0")
    expect(body.contains(screen.getByLabelText("Field"))).toBe(true)
    expect(body.contains(screen.getByRole("heading"))).toBe(false)
    expect(body.contains(screen.getByText("Workspace"))).toBe(false)
  })

  it("keeps on-demand drawers through close and drops their contents after focus restoration", async () => {
    const trigger = document.createElement("button")
    trigger.dataset.drawerTestTrigger = ""
    document.body.append(trigger)
    trigger.focus()
    function Workspace() {
      const [opened, setOpened] = React.useState(false)

      return h(
        React.Fragment,
        null,
        h("button", { onClick: () => setOpened(true) }, "Open workspace"),
        h(DrawerPresence, {
          open: opened,
          children: (onAfterClose) =>
            h(
              Drawer,
              {
                open: opened,
                titleId: "workspace-heading",
                title: "Workspace",
                onClose: () => setOpened(false),
                onAfterClose,
              },
              h("p", null, "Current account summary")
            ),
        })
      )
    }
    render(h(Workspace))
    expect(screen.queryByText("Current account summary")).toBeNull()
    fireEvent.click(screen.getByText("Open workspace"))
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() =>
      expect(screen.queryByText("Current account summary")).toBeNull()
    )
    expect(Object.hasOwn(document.body.dataset, "scrollLocked")).toBe(false)
  })
  it("is a modal dialog named by its title, with the line under it", () => {
    open()
    const dialog = screen.getByRole("dialog", { name: "Suggest a correction" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(screen.getByText("Nailsea Library · Nailsea")).toBeTruthy()
  })

  it("starts on the first field, and gives focus back on close", async () => {
    const { trigger, view } = open()
    expect(document.activeElement).toBe(screen.getByLabelText("Field"))
    view.unmount()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
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
    expect(Object.hasOwn(document.body.dataset, "scrollLocked")).toBe(true)
    view.unmount()
    expect(Object.hasOwn(document.body.dataset, "scrollLocked")).toBe(false)
    expect(document.documentElement.style.overflow).toBe("auto")
  })

  it("closes on Escape, on Close and on the backdrop", () => {
    const { onClose } = open()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    // The backdrop is a click target only: hidden from assistive tech and
    // out of the Tab order, so it never reads as a second "Close".
    const backdrop = document.querySelector<HTMLElement>(
      "[data-drawer-backdrop]"
    )!
    expect(backdrop.hasAttribute("tabindex")).toBe(false)
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBe(1)
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it("keeps Tab inside the dialog", () => {
    open()
    const send = screen.getByRole("button", { name: "Send" })
    // The header's Close is the first stop; Send is the last.
    const close = screen.getByRole("button", { name: "Close" })
    send.focus()
    fireEvent.keyDown(send, { key: "Tab" })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(send)
  })
})

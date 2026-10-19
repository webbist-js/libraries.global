// @vitest-environment happy-dom
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StickyPageLayout } from "@/components/ds/StickyPageLayout"

let resized: ResizeObserverCallback
const disconnect = vi.fn()
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return { height: Number(this.dataset.height ?? 0) } as DOMRect
    }
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resized = callback
      }

      observe() {}
      disconnect = disconnect
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("sticky page clearance", () => {
  it("tracks the actual header and wrapped subnav heights", () => {
    const view = render(
      <StickyPageLayout id="main">
        <header data-global-header data-height="57" />
        <nav data-sticky-navigation data-height="56" />
        <aside />
      </StickyPageLayout>
    )
    const root = view.container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue("--sticky-header-height")).toBe("57px")
    expect(root.style.getPropertyValue("--sticky-navigation-height")).toBe(
      "56px"
    )
    expect(root.style.getPropertyValue("--sticky-content-top")).toBe("137px")
    const nav = root.querySelector("nav")!
    nav.dataset.height = "112"
    act(() => resized([], {} as ResizeObserver))
    expect(root.style.getPropertyValue("--sticky-navigation-height")).toBe(
      "112px"
    )
    expect(root.style.getPropertyValue("--sticky-content-top")).toBe("193px")
    expect(root.style.getPropertyValue("--sticky-content-max-height")).toBe(
      "calc(100dvh - 217px)"
    )
  })

  it("clears the extra offset when navigation is removed, and measures streamed navigation", async () => {
    const shell = (navigation: boolean) => (
      <StickyPageLayout>
        <header data-global-header data-height="57" />
        {navigation ? <nav data-sticky-navigation data-height="60" /> : null}
      </StickyPageLayout>
    )
    const view = render(shell(true))
    const root = view.container.firstElementChild as HTMLElement
    view.rerender(shell(false))
    await waitFor(() =>
      expect(root.style.getPropertyValue("--sticky-navigation-height")).toBe(
        "0px"
      )
    )
    view.rerender(shell(true))
    await waitFor(() =>
      expect(root.style.getPropertyValue("--sticky-navigation-height")).toBe(
        "60px"
      )
    )
  })
})

// @vitest-environment happy-dom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { useEffect, type AnchorHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AtlasGlobePreview from "@/components/home/AtlasGlobePreview"

const canvas = vi.hoisted(() => ({
  unavailable: false,
  mount: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock("@/components/home/KnowledgeGlobeCanvas", () => ({
  default: function MockGlobe({ active }: { active: boolean }) {
    useEffect(() => {
      canvas.mount()

      return canvas.dispose
    }, [])
    if (canvas.unavailable) throw new Error("WebGL unavailable")

    return <div role="img" aria-label="Canvas globe" data-active={active} />
  },
}))

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))

const markers = [
  { lat: 51.5, lng: -0.1 },
  { lat: 38.9, lng: -77, featured: true },
]
let intersect: IntersectionObserverCallback
const disconnect = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  canvas.unavailable = false
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }

      observe = vi.fn()
      disconnect = disconnect
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setVisible(visible: boolean) {
  intersect(
    [{ isIntersecting: visible } as IntersectionObserverEntry],
    {} as IntersectionObserver
  )
}

describe("AtlasGlobePreview", () => {
  it("loads near the viewport, pauses offscreen, and resumes without remounting the globe", async () => {
    const { unmount } = render(
      <AtlasGlobePreview markers={markers} href="/map" />
    )
    expect(screen.queryByRole("img", { name: "Canvas globe" })).toBeNull()
    expect(
      screen.getByRole("link", { name: "Open the atlas" }).getAttribute("href")
    ).toBe("/map")

    act(() => setVisible(true))
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Canvas globe" }).dataset.active
      ).toBe("true")
    )
    expect(canvas.mount).toHaveBeenCalledOnce()

    act(() => setVisible(false))
    expect(
      screen.getByRole("img", { name: "Canvas globe" }).dataset.active
    ).toBe("false")
    act(() => setVisible(true))
    expect(
      screen.getByRole("img", { name: "Canvas globe" }).dataset.active
    ).toBe("true")
    expect(canvas.mount).toHaveBeenCalledOnce()

    unmount()
    expect(canvas.dispose).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it("keeps the atlas button available when the canvas cannot render", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    canvas.unavailable = true
    render(<AtlasGlobePreview markers={markers} href="/map" />)
    act(() => setVisible(true))
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Explore library locations in the atlas"
      )
    )
    expect(
      screen.getByRole("link", { name: "Open the atlas" }).getAttribute("href")
    ).toBe("/map")
  })
})

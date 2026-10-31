// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AboutCoverageChapter } from "@/components/about/AboutCoverageChapter"
import { act, cleanup, fireEvent, render, screen } from "@/test/render"

let reduced = false,
  now = 0,
  nextFrame = 0
let intersect: (visible: boolean) => void
const frames = new Map<number, FrameRequestCallback>()
const mediaListeners = new Set<() => void>()
let rowTops = [120, 240]
const box = (top: number, height = 900) => ({
  top,
  bottom: top + height,
  height,
  left: 0,
  right: 1200,
  width: 1200,
  x: 0,
  y: top,
  toJSON: () => ({}),
})
beforeEach(() => {
  reduced = false
  now = 0
  nextFrame = 0
  rowTops = [120, 240]
  frames.clear()
  mediaListeners.clear()
  vi.stubGlobal("innerHeight", 900)
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_: string, listener: () => void) =>
      mediaListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      mediaListeners.delete(listener),
  }))
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)

    return nextFrame
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (visible) =>
          callback(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          )
      }

      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const index = this.dataset.rowIndex

      return index !== undefined ? box(rowTops[Number(index)]!, 80) : box(0)
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function advance(milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
    now += 16
    act(() => {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(now))
    })
  }
}
function show() {
  const view = render(
    <div className="dashboard-page">
      <div className="dashboard-page-body" style={{ overflowY: "auto" }}>
        <AboutCoverageChapter footer={<p>Explore coverage</p>}>
          {[
            { total: 100, countries: [40, 60] },
            { total: 20, countries: [20] },
          ].map((row, index) => (
            <div
              key={row.total}
              data-coverage-row={row.total}
              data-row-index={index}
            >
              <span
                aria-hidden="true"
                data-coverage-total=""
                data-testid={`total-${index}`}
              >
                {row.total}
              </span>
              <span className="sr-only">{row.total} published records</span>
              {row.countries.map((count) => (
                <span key={count} data-coverage-segment="" />
              ))}
              {row.countries.map((count) => (
                <span key={count} data-coverage-country={count}>
                  <span data-coverage-country-count="">{count}</span>
                </span>
              ))}
            </div>
          ))}
        </AboutCoverageChapter>
      </div>
    </div>
  )

  return { ...view, root: document.querySelector(".dashboard-page-body")! }
}
const total = (index: number) =>
  Number(screen.getByTestId(`total-${index}`).textContent)

it("pauses and resumes one timeline, retains accessible totals, and cleans up snap ownership", () => {
  const view = show()
  expect(view.root.classList.contains("about-coverage-scroll-root")).toBe(true)
  expect(screen.getByText("100 published records")).toBeTruthy()
  act(() => intersect(true))
  advance(600)
  expect(total(0)).toBeGreaterThan(0)
  expect(total(1)).toBe(0)
  fireEvent.click(screen.getByRole("button", { name: "Pause animation" }))
  const paused = total(0)
  advance(1000)
  expect(total(0)).toBe(paused)
  fireEvent.click(screen.getByRole("button", { name: "Resume animation" }))
  advance(3000)
  expect([total(0), total(1)]).toEqual([100, 20])
  fireEvent.click(screen.getByRole("button", { name: "Replay animation" }))
  expect([total(0), total(1)]).toEqual([0, 0])
  view.unmount()
  expect(view.root.classList.contains("about-coverage-scroll-root")).toBe(false)
  expect(frames.size).toBe(0)
})
it("stops off screen and settles immediately when reduced motion is requested", () => {
  const view = show()
  act(() => intersect(true))
  advance(400)
  const before = total(0)
  act(() => intersect(false))
  advance(2000)
  expect(total(0)).toBe(before)
  act(() => intersect(true))
  advance(16)
  expect(total(0)).toBe(before)
  act(() => {
    reduced = true
    mediaListeners.forEach((listener) => listener())
  })
  expect([total(0), total(1)]).toEqual([100, 20])
  expect(screen.queryByRole("button", { name: "Replay animation" })).toBeNull()
  expect(view.root.classList.contains("about-coverage-scroll-root")).toBe(false)
  expect(frames.size).toBe(0)
})
it("waits for a below-the-fold row instead of finishing its reveal before it can be read", () => {
  rowTops[1] = 1000
  const view = show()
  act(() => intersect(true))
  advance(2500)
  expect([total(0), total(1)]).toEqual([100, 0])
  rowTops[1] = 300
  fireEvent.scroll(view.root)
  advance(2000)
  expect([total(0), total(1)]).toEqual([100, 20])
})

it("continues a replay if its smooth scroll is interrupted before alignment", () => {
  const view = show()
  act(() => intersect(true))
  advance(2500)
  const chapter = document.querySelector<HTMLElement>(
    ".about-coverage-chapter"
  )!
  Object.defineProperty(chapter, "getBoundingClientRect", {
    value: () => box(-200),
    configurable: true,
  })
  Object.defineProperty(view.root, "scrollTo", {
    value: vi.fn(),
    configurable: true,
  })
  fireEvent.click(screen.getByRole("button", { name: "Replay animation" }))
  advance(500)
  expect([total(0), total(1)]).toEqual([0, 0])
  fireEvent(view.root, new Event("scrollend"))
  advance(2500)
  expect([total(0), total(1)]).toEqual([100, 20])
})

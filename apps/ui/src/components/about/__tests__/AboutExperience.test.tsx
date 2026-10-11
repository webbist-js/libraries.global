// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { type AnchorHTMLAttributes, useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AboutExperience } from "@/components/about/AboutExperience"
import type { GlobeNarrativeController } from "@/components/home/knowledge-globe-narrative"

type CanvasProps = {
  active: boolean
  motionPaused: boolean
  overrides: { interactive: boolean; dprMax: number }
  narrative: GlobeNarrativeController
}

const canvas = vi.hoisted(() => ({
  mount: vi.fn(),
  dispose: vi.fn(),
  render: vi.fn(),
}))

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockCanvas(props: CanvasProps) {
      canvas.render(props)
      useEffect(() => {
        canvas.mount()

        return canvas.dispose
      }, [])

      return (
        <div
          role="img"
          aria-label="Persistent globe"
          data-active={props.active}
          data-paused={props.motionPaused}
          data-interactive={props.overrides.interactive}
        />
      )
    },
}))

vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

const chapterIds = [
  "our-purpose",
  "what-we-include",
  "how-we-build-it",
  "where-we-are",
  "open-by-design",
  "take-part",
]
const markers = [{ lat: 51.5, lng: -0.1, featured: false }]
const mediaListeners = {
  reduced: new Set<() => void>(),
  coarse: new Set<() => void>(),
}
let reducedMotion = false
let coarsePointer = false
let hidden = false
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()
const intersections: {
  callback: IntersectionObserverCallback
  disconnect: ReturnType<typeof vi.fn>
}[] = []
const resizes: {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}[] = []

beforeEach(() => {
  vi.clearAllMocks()
  reducedMotion = false
  coarsePointer = false
  hidden = false
  nextFrame = 0
  frames.clear()
  intersections.length = 0
  resizes.length = 0
  mediaListeners.reduced.clear()
  mediaListeners.coarse.clear()
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  Object.defineProperty(window, "innerHeight", {
    value: 800,
    configurable: true,
  })
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1000)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const chapter = Number(this.dataset.aboutChapter ?? 0)
      const top = chapter * 1000 - window.scrollY

      return {
        top,
        bottom: top + 1000,
        left: 0,
        right: 1200,
        width: 1200,
        height: 1000,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }
    }
  )
  vi.stubGlobal("matchMedia", (query: string) => {
    const kind = query.includes("reduced-motion") ? "reduced" : "coarse"

    return {
      get matches() {
        return kind === "reduced" ? reducedMotion : coarsePointer
      },
      addEventListener: (_event: string, listener: () => void) =>
        mediaListeners[kind].add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        mediaListeners[kind].delete(listener),
    }
  })
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrame
      frames.set(id, callback)

      return id
    })
  )
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id))
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn()
      observe = vi.fn()
      constructor(callback: IntersectionObserverCallback) {
        intersections.push({ callback, disconnect: this.disconnect })
      }
    }
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn()
      observe = vi.fn()
      constructor() {
        resizes.push(this)
      }
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function flushScrollFrame() {
  act(() => {
    const scheduled = [...frames.values()]
    frames.clear()
    scheduled.forEach((callback) => callback(performance.now()))
  })
}

function scrollTo(scrollY: number) {
  Object.defineProperty(window, "scrollY", {
    value: scrollY,
    configurable: true,
  })
  fireEvent.scroll(window)
  flushScrollFrame()
}

function setVisible(visible: boolean) {
  act(() =>
    intersections[0]!.callback(
      [{ isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  )
}

function latestCanvasProps(): CanvasProps {
  return canvas.render.mock.lastCall![0] as CanvasProps
}

function renderStory() {
  const result = render(
    <AboutExperience markers={markers} stats={null}>
      {chapterIds.map((id, index) => (
        <section key={id} id={id} data-about-chapter={index + 1}>
          <h2>{id}</h2>
        </section>
      ))}
    </AboutExperience>
  )
  flushScrollFrame()

  return result
}

describe("About persistent canvas interaction", () => {
  it("keeps one canvas mounted while scrolling forward, jumping chapters and returning", () => {
    renderStory()
    const globe = screen.getByRole("img", { name: "Persistent globe" })
    const openingSignal = latestCanvasProps().narrative
    scrollTo(1220)
    scrollTo(4020)
    expect(
      screen
        .getByRole("link", { name: "05 — The index today" })
        .getAttribute("href")
    ).toBe("#where-we-are")
    expect(
      screen
        .getByRole("link", { name: "05 — The index today" })
        .getAttribute("aria-current")
    ).toBe("step")
    scrollTo(20)
    expect(screen.getByRole("img", { name: "Persistent globe" })).toBe(globe)
    expect(latestCanvasProps().narrative).toBe(openingSignal)
    expect(canvas.mount).toHaveBeenCalledOnce()
    expect(canvas.dispose).not.toHaveBeenCalled()
  })

  it("updates fractional scene progress without rerendering the canvas for each scroll frame", () => {
    renderStory()
    const narrative = latestCanvasProps().narrative
    const changed = vi.fn()
    const unsubscribe = narrative.subscribe(changed)
    const renderCount = canvas.render.mock.calls.length
    scrollTo(220)
    const firstProgress = narrative.current.progress
    expect(firstProgress).toBeGreaterThan(0)
    expect(firstProgress).toBeLessThan(0.5)
    scrollTo(320)
    expect(narrative.current.progress).toBeGreaterThan(firstProgress)
    expect(narrative.current.progress).toBeLessThan(0.5)
    expect(changed).toHaveBeenCalledTimes(2)
    expect(canvas.render).toHaveBeenCalledTimes(renderCount)
    unsubscribe()
  })

  it("starts with ambient motion paused and a one-pixel device ratio", () => {
    renderStory()
    expect(latestCanvasProps().motionPaused).toBe(true)
    expect(latestCanvasProps().overrides.dprMax).toBe(1)
    fireEvent.click(screen.getByRole("button", { name: "Play ambient motion" }))
    expect(latestCanvasProps().motionPaused).toBe(false)
    fireEvent.click(
      screen.getByRole("button", { name: "Pause ambient motion" })
    )
    expect(latestCanvasProps().motionPaused).toBe(true)
  })

  it("responds to reduced motion and chooses complete chapter poses", () => {
    renderStory()
    fireEvent.click(screen.getByRole("button", { name: "Play ambient motion" }))
    act(() => {
      reducedMotion = true
      mediaListeners.reduced.forEach((listener) => listener())
    })
    scrollTo(2220)
    expect(latestCanvasProps().motionPaused).toBe(true)
    expect(latestCanvasProps().narrative.current.progress).toBe(2)
    expect(
      (
        screen.getByRole("button", {
          name: "Ambient motion paused by your reduced-motion preference",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("preserves coarse-pointer scrolling until exploration is explicitly enabled", () => {
    coarsePointer = true
    renderStory()
    expect(latestCanvasProps().overrides.interactive).toBe(false)
    fireEvent.click(
      screen.getByRole("button", { name: "Touch to explore the globe" })
    )
    expect(latestCanvasProps().overrides.interactive).toBe(true)
    scrollTo(1020)
    expect(latestCanvasProps().overrides.interactive).toBe(false)
    scrollTo(20)
    expect(latestCanvasProps().overrides.interactive).toBe(false)
    expect(
      screen
        .getByRole("button", { name: "Touch to explore the globe" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  it("stops offscreen and in hidden documents without remounting", () => {
    renderStory()
    setVisible(false)
    expect(latestCanvasProps().active).toBe(false)
    setVisible(true)
    expect(latestCanvasProps().active).toBe(true)
    hidden = true
    fireEvent(document, new Event("visibilitychange"))
    expect(latestCanvasProps().active).toBe(false)
    hidden = false
    fireEvent(document, new Event("visibilitychange"))
    expect(latestCanvasProps().active).toBe(true)
    expect(canvas.mount).toHaveBeenCalledOnce()
  })

  it("disconnects observers, media and scroll listeners and cancels pending work", () => {
    const { unmount } = renderStory()
    fireEvent.scroll(window)
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
    expect(intersections[0]!.disconnect).toHaveBeenCalledOnce()
    expect(resizes[0]!.disconnect).toHaveBeenCalledOnce()
    expect(resizes[0]!.observe).toHaveBeenCalledTimes(7)
    expect(mediaListeners.reduced.size).toBe(0)
    expect(mediaListeners.coarse.size).toBe(0)
    fireEvent.scroll(window)
    fireEvent.resize(window)
    expect(frames.size).toBe(0)
    expect(canvas.dispose).toHaveBeenCalledOnce()
  })
})

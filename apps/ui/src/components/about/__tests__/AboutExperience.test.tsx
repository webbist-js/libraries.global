// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { type AnchorHTMLAttributes, useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AboutExperience } from "@/components/about/AboutExperience"

type CanvasProps = {
  active: boolean
  motionPaused: boolean
  overrides: { interactive: boolean; dprMax: number }
}

const canvas = vi.hoisted(() => ({
  mount: vi.fn(),
  dispose: vi.fn(),
  render: vi.fn(),
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))

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
  formatHref: (href: string) => href,
  isAppLink: (href: string) => href.startsWith("/"),
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock("@/components/about/AboutStory", () => ({
  AboutStory: () => (
    <section id="our-purpose">
      <h2>Our purpose</h2>
      <p>The project story stays an ordinary document.</p>
    </section>
  ),
}))
const markers = [{ lat: 51.5, lng: -0.1, featured: false }]
const mediaListeners = {
  reduced: new Set<() => void>(),
  coarse: new Set<() => void>(),
  desktop: new Set<() => void>(),
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
  mediaListeners.desktop.clear()
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
    const kind = query.includes("reduced-motion")
      ? "reduced"
      : query.includes("pointer: coarse")
        ? "coarse"
        : "desktop"

    return {
      get matches() {
        return kind === "reduced"
          ? reducedMotion
          : kind === "coarse"
            ? coarsePointer
            : !coarsePointer
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
    <AboutExperience
      countries={[]}
      markers={markers}
      stats={null}
      continents={[]}
      libraries={[]}
    />
  )
  flushScrollFrame()

  return result
}

describe("About hero and ordinary document", () => {
  it("keeps one globe mounted while readers scroll to the project story and return", () => {
    renderStory()
    const globe = screen.getByRole("img", { name: "Persistent globe" })
    scrollTo(1220)
    scrollTo(4020)
    scrollTo(20)
    expect(screen.getByRole("img", { name: "Persistent globe" })).toBe(globe)
    expect(screen.getByRole("heading", { name: "Our purpose" })).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Read about the project" })
        .getAttribute("href")
    ).toBe("#our-purpose")
    expect(canvas.mount).toHaveBeenCalledOnce()
    expect(canvas.dispose).not.toHaveBeenCalled()
  })
  it("lets readers pause and resume globe motion", () => {
    renderStory()
    fireEvent.click(screen.getByRole("button", { name: "Pause globe motion" }))
    expect(latestCanvasProps().motionPaused).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Play globe motion" }))
    expect(latestCanvasProps().motionPaused).toBe(false)
  })
  it("honours a reduced-motion preference without hiding the project document", () => {
    reducedMotion = true
    renderStory()
    expect(latestCanvasProps().motionPaused).toBe(true)
    expect(
      (
        screen.getByRole("button", {
          name: "Globe motion disabled by your reduced-motion preference",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(screen.getByRole("heading", { name: "Our purpose" })).toBeTruthy()
  })
  it("preserves touch scrolling until readers choose rotation, then lets them finish", () => {
    coarsePointer = true
    renderStory()
    expect(latestCanvasProps().overrides.interactive).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }))
    expect(latestCanvasProps().overrides.interactive).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(latestCanvasProps().overrides.interactive).toBe(false)
  })
  it("stops offscreen and in hidden documents without remounting", () => {
    renderStory()
    setVisible(false)
    expect(latestCanvasProps().active).toBe(false)
    setVisible(true)
    hidden = true
    fireEvent(document, new Event("visibilitychange"))
    expect(latestCanvasProps().active).toBe(false)
    hidden = false
    fireEvent(document, new Event("visibilitychange"))
    expect(latestCanvasProps().active).toBe(true)
    expect(canvas.mount).toHaveBeenCalledOnce()
  })
  it("cleans up its observers and media listeners when unmounted", () => {
    const { unmount } = renderStory()
    unmount()
    expect(intersections[0]!.disconnect).toHaveBeenCalledOnce()
    expect(resizes[0]!.disconnect).toHaveBeenCalledOnce()
    expect(mediaListeners.reduced.size).toBe(0)
    expect(mediaListeners.coarse.size).toBe(0)
    expect(mediaListeners.desktop.size).toBe(0)
    expect(frames.size).toBe(0)
  })
})

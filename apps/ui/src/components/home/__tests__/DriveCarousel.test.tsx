// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DriveCarousel } from "@/components/home/DriveCarousel"
import { homepageContentAttributes } from "@/components/home/homepage.analytics"
import { installAnalyticsClickTracking } from "@/lib/analytics-events"

import messages from "../../../../locales/en.json"

let reduced = false
let finish: () => void
let animate: ReturnType<typeof vi.fn>
let cancel: ReturnType<typeof vi.fn>

beforeEach(() => {
  reduced = false
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }))
  cancel = vi.fn()
  animate = vi.fn(() => ({
    finished: new Promise<void>((resolve) => {
      finish = resolve
    }),
    cancel,
  }))
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  })
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.librariesGlobalAnalytics
  Reflect.deleteProperty(HTMLElement.prototype, "animate")
  Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture")
  Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture")
})
const show = (count = 3) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DriveCarousel label="Open drives">
        {Array.from({ length: count }, (_, n) => (
          <article key={`drive-${n}`}>
            <a
              href={`/drive/${n}`}
              {...homepageContentAttributes("drive", `drive-${n}`)}
              onClick={(event) => event.preventDefault()}
            >
              Drive {n + 1}
            </a>
          </article>
        ))}
      </DriveCarousel>
    </NextIntlClientProvider>
  )
const settle = async () => {
  await act(async () => {
    finish()
  })
  await act(async () => {
    finish()
  })
}

describe("homepage index card deck", () => {
  it("keeps drive selection attribution exactly once on a normal card click", () => {
    const track = vi.fn()
    window.librariesGlobalAnalytics = {
      track,
    } as unknown as Window["librariesGlobalAnalytics"]
    const remove = installAnalyticsClickTracking(window)
    try {
      show()
      fireEvent.click(screen.getByRole("link", { name: "Drive 1" }))
      expect(track.mock.calls).toEqual([
        [
          "select_content",
          {
            interaction_source: "home",
            content_type: "drive",
            content_id: "drive-0",
          },
        ],
      ])
    } finally {
      remove()
    }
  })
  it("fades content in both directions, wraps and keeps hidden cards inert", async () => {
    show()
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(
      screen
        .getByRole("link", { name: "Drive 2", hidden: true })
        .closest("[inert]")
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Next drive" }))
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0]?.[0][1]).toEqual({
      transform: "translateX(-12px)",
      opacity: 0,
    })
    expect(animate.mock.instances[0]).toBe(
      screen.getByRole("link", { name: "Drive 1" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Next drive" }))
    expect(animate).toHaveBeenCalledTimes(1)
    await settle()
    expect(animate.mock.calls[1]?.[0][0]).toEqual({
      transform: "translateX(12px)",
      opacity: 0,
    })
    expect(screen.getByRole("link", { name: "Drive 2" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Previous drive" }))
    expect(animate.mock.calls[2]?.[0][1]).toEqual({
      transform: "translateX(12px)",
      opacity: 0,
    })
    await settle()
    expect(animate.mock.calls[3]?.[0][0]).toEqual({
      transform: "translateX(-12px)",
      opacity: 0,
    })
    fireEvent.click(screen.getByRole("button", { name: "Previous drive" }))
    await settle()
    expect(screen.getByRole("link", { name: "Drive 3" })).toBeTruthy()
    expect(screen.getByText("3 of 3 drives")).toBeTruthy()
  })

  it("changes instantly under reduced motion and keeps keyboard focus out of hidden cards", () => {
    reduced = true
    show()
    const link = screen.getByRole("link", { name: "Drive 1" })
    link.focus()
    fireEvent.keyDown(link, { key: "ArrowRight" })
    expect(animate).not.toHaveBeenCalled()
    expect(screen.getByRole("link", { name: "Drive 2" })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole("region"))
  })

  it("ignores short swipes and vertical scrolling, and changes content on a deliberate swipe", async () => {
    show()
    const card = screen.getByRole("group", { name: "1 / 3" })
    Object.defineProperty(card, "offsetWidth", { value: 400 })
    const down = {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 200,
      clientY: 100,
    }
    fireEvent.pointerDown(card, down)
    fireEvent.pointerMove(card, { ...down, clientX: 185 })
    fireEvent.pointerUp(card, { ...down, clientX: 185 })
    expect(animate).not.toHaveBeenCalled()
    fireEvent.pointerDown(card, down)
    fireEvent.pointerMove(card, { ...down, clientY: 200 })
    fireEvent.pointerUp(card, { ...down, clientY: 200 })
    expect(animate).not.toHaveBeenCalled()
    fireEvent.pointerDown(card, down)
    fireEvent.pointerMove(card, { ...down, clientX: 80 })
    fireEvent.pointerUp(card, { ...down, clientX: 80 })
    expect(animate).toHaveBeenCalledTimes(1)
    await settle()
    expect(screen.getByRole("link", { name: "Drive 2" })).toBeTruthy()
  })

  it("leaves a single drive readable without redundant controls", () => {
    show(1)
    expect(screen.getByRole("link", { name: "Drive 1" })).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })
})

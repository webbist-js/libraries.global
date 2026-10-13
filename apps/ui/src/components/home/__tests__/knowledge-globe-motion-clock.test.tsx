// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useGlobeMotionClock } from "@/components/home/knowledge-globe-motion"

const frame = vi.hoisted(() => vi.fn())
vi.mock("@react-three/fiber", () => ({ useFrame: frame }))

let reducedMotion = false
const preferenceListeners = new Set<() => void>()

beforeEach(() => {
  vi.clearAllMocks()
  reducedMotion = false
  preferenceListeners.clear()
  vi.stubGlobal("matchMedia", () => ({
    matches: reducedMotion,
    addEventListener: (_event: string, listener: () => void) =>
      preferenceListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      preferenceListeners.delete(listener),
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function advance(seconds: number) {
  act(() => frame.mock.lastCall?.[0]({}, seconds))
}

describe("globe ambient motion", () => {
  it("freezes at its current phase and resumes without advancing paused time", () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useGlobeMotionClock(paused),
      { initialProps: { paused: false } }
    )
    advance(0.05)
    expect(result.current.time.current).toBe(0.05)

    rerender({ paused: true })
    advance(30)
    expect(result.current.paused).toBe(true)
    expect(result.current.time.current).toBe(0.05)

    rerender({ paused: false })
    advance(30)
    expect(result.current.time.current).toBe(0.05)
    advance(0.025)
    expect(result.current.time.current).toBeCloseTo(0.075)
  })

  it("bounds a demand-rendered transition after a long idle interval", () => {
    const { result } = renderHook(() => useGlobeMotionClock(true))
    advance(30)
    expect(result.current.frameDelta.current).toBe(0.1)
    expect(result.current.time.current).toBe(0)
  })

  it("responds to the OS motion preference and removes its listener on unmount", () => {
    const { result, unmount } = renderHook(() => useGlobeMotionClock(false))
    advance(0.05)
    act(() => {
      reducedMotion = true
      preferenceListeners.forEach((listener) => listener())
    })
    advance(2)
    expect(result.current.reducedMotion).toBe(true)
    expect(result.current.paused).toBe(true)
    expect(result.current.time.current).toBe(0.05)

    act(() => {
      reducedMotion = false
      preferenceListeners.forEach((listener) => listener())
    })
    advance(30)
    expect(result.current.time.current).toBe(0.05)
    advance(0.025)
    expect(result.current.time.current).toBeCloseTo(0.075)

    unmount()
    expect(preferenceListeners.size).toBe(0)
  })

  it("does not jump ahead by the offscreen interval when rendering resumes", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useGlobeMotionClock(false, active),
      { initialProps: { active: true } }
    )
    advance(0.05)
    rerender({ active: false })
    rerender({ active: true })

    // R3F's first clock sample may include the entire interval spent offscreen.
    advance(30)
    expect(result.current.time.current).toBe(0.05)
    expect(result.current.frameDelta.current).toBe(0)
    advance(0.025)
    expect(result.current.time.current).toBeCloseTo(0.075)
    expect(result.current.frameDelta.current).toBe(0.025)
  })
})

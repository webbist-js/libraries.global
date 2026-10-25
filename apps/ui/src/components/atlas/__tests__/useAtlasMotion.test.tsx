// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { useAtlasMotion } from "../useAtlasMotion"

const original = document.startViewTransition
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
})
afterEach(() => {
  cleanup()
  document.startViewTransition = original
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.atlasTransition
})

function browserTransition() {
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  const transition = {
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    finished,
    skipTransition: vi.fn(finish),
  } as unknown as ViewTransition

  return { transition, finish }
}

it("commits immediately without native support or when reduced motion is requested", () => {
  const native = vi.fn()
  const update = vi.fn()
  const hook = renderHook(useAtlasMotion)
  document.startViewTransition = undefined as unknown as typeof original
  act(() => hook.result.current(update))
  expect(update).toHaveBeenCalledTimes(1)
  document.startViewTransition = native
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }))
  )
  act(() => hook.result.current(update))
  expect(update).toHaveBeenCalledTimes(2)
  expect(native).not.toHaveBeenCalled()
  expect(document.querySelector("html[data-atlas-transition]")).toBeNull()
})

it("lets the latest selection win when a new action interrupts an uncaptured update", async () => {
  const first = browserTransition()
  const second = browserTransition()
  const callbacks: (() => void)[] = []
  document.startViewTransition = vi.fn((callback: () => void) => {
    callbacks.push(callback)

    return callbacks.length === 1 ? first.transition : second.transition
  }) as unknown as typeof original
  const firstUpdate = vi.fn()
  const secondUpdate = vi.fn()
  const hook = renderHook(useAtlasMotion)
  act(() => hook.result.current(firstUpdate))
  act(() => hook.result.current(secondUpdate))
  expect(first.transition.skipTransition).toHaveBeenCalledOnce()
  await act(async () => {
    callbacks[0]!()
    callbacks[1]!()
  })
  expect(firstUpdate).not.toHaveBeenCalled()
  expect(secondUpdate).toHaveBeenCalledOnce()
  // Completion of the old animation must not remove the new one's map isolation.
  expect(document.querySelector("html[data-atlas-transition]")).toBe(
    document.documentElement
  )
  await act(async () => {
    second.finish()
  })
  expect(document.querySelector("html[data-atlas-transition]")).toBeNull()
})

it("cancels a pending capture on unmount and recovers from a synchronous browser failure", () => {
  const { transition } = browserTransition()
  let callback!: () => void
  document.startViewTransition = vi.fn((update: () => void) => {
    callback = update

    return transition
  }) as unknown as typeof original
  const update = vi.fn()
  const hook = renderHook(useAtlasMotion)
  act(() => hook.result.current(update))
  hook.unmount()
  act(() => callback())
  expect(update).not.toHaveBeenCalled()
  expect(transition.skipTransition).toHaveBeenCalledOnce()
  document.startViewTransition = vi.fn(() => {
    throw new Error("Unavailable")
  })
  const fallback = renderHook(useAtlasMotion)
  act(() => fallback.result.current(update))
  expect(update).toHaveBeenCalledOnce()
  expect(document.querySelector("html[data-atlas-transition]")).toBeNull()
})

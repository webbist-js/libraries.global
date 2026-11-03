// @vitest-environment happy-dom
import { expect, it, vi } from "vitest"

import { guardHiddenViewTransitions } from "../view-transition-guard"

function fakeDocument(hidden: boolean) {
  const native = vi.fn(() => ({ native: true }))

  return {
    doc: {
      visibilityState: hidden ? "hidden" : "visible",
      startViewTransition: native,
    } as unknown as Document,
    native,
  }
}

it("applies the update without a transition while the page is hidden", async () => {
  const { doc, native } = fakeDocument(true)
  guardHiddenViewTransitions(doc)
  const update = vi.fn()
  const transition = doc.startViewTransition({ update, types: ["nav-forward"] })
  await expect(transition.finished).resolves.toBeUndefined()
  await expect(transition.ready).resolves.toBeUndefined()
  expect(update).toHaveBeenCalledOnce()
  expect(native).not.toHaveBeenCalled()
})

it("keeps the browser's transition while the page is visible, installing once", () => {
  const { doc, native } = fakeDocument(false)
  guardHiddenViewTransitions(doc)
  guardHiddenViewTransitions(doc)
  const update = vi.fn()
  expect(doc.startViewTransition(update)).toEqual({ native: true })
  expect(native).toHaveBeenCalledWith(update)
})

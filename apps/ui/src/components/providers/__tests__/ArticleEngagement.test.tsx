// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { ArticleEngagement } from "@/components/providers/ArticleEngagement"
import { act, cleanup, render } from "@/test/render"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@/lib/analytics-events", () => ({
  analyticsConsentVersion: () => 1,
  subscribeAnalyticsConsent: () => vi.fn(),
  pushAnalyticsEvent: track,
}))
beforeEach(() => {
  window.location.href = "https://libraries.global/knowledge/article"
  vi.useFakeTimers()
  track.mockReset()
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  })
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 1000,
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function setup() {
  render(
    <div style={{ overflowY: "auto" }} data-testid="canvas">
      <div id="reader-body" />
      <ArticleEngagement
        bodyId="reader-body"
        contentId="public_article"
        contentType="knowledge"
        path="/knowledge/article"
      />
    </div>
  )
  const canvas = document.querySelector('[data-testid="canvas"]')!
  const body = document.getElementById("reader-body")!
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 700, 500)
  )
  const geometry = vi
    .spyOn(body, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 600, 800))
  act(() => document.dispatchEvent(new Event("scroll")))

  return { geometry }
}
it("uses canvas height and responds to captured inner scroll, once per article", () => {
  const { geometry } = setup()
  act(() => vi.advanceTimersByTime(31_000))
  expect(track).not.toHaveBeenCalled() // 500/800, even though window is 1000px tall.
  geometry.mockReturnValue(new DOMRect(0, -200, 600, 800))
  act(() => document.dispatchEvent(new Event("scroll")))
  expect(track).toHaveBeenCalledWith("content_engaged", {
    interaction_source: "article",
    content_type: "knowledge",
    content_id: "public_article",
  })
  act(() => vi.advanceTimersByTime(31_000))
  expect(track).toHaveBeenCalledTimes(1)
})
it("does not count time while an account drawer or search modal covers the article", () => {
  const { geometry } = setup()
  geometry.mockReturnValue(new DOMRect(0, -200, 600, 800))
  const modal = document.createElement("div")
  modal.setAttribute("role", "dialog")
  modal.dataset.state = "open"
  document.body.append(modal)
  act(() => document.dispatchEvent(new Event("scroll")))
  act(() => vi.advanceTimersByTime(60_000))
  expect(track).not.toHaveBeenCalled()
  modal.remove()
  act(() => document.dispatchEvent(new Event("scroll")))
  act(() => vi.advanceTimersByTime(31_000))
  expect(track).toHaveBeenCalledTimes(1)
})

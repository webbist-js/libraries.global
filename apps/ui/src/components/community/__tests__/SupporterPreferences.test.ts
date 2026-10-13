// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: { error: mocks.error, success: mocks.success },
}))
vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}))
const { SupporterPreferences } = await import("../SupporterPreferences")
const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("SupporterPreferences", () => {
  it("saves only the listing choice and leaves the mark unchanged", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    render(React.createElement(SupporterPreferences, { visibility: "public" }))
    fireEvent.click(
      screen.getByRole("switch", { name: /Show me on the supporters page/ })
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      supporterListed: false,
    })
    expect(
      (
        screen.getByRole("switch", {
          name: /Show the Supporter mark/,
        }) as HTMLInputElement
      ).checked
    ).toBe(true)
  })
  it("does not claim success or change the preference on a failed save", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 503 }))
    render(React.createElement(SupporterPreferences, { visibility: "public" }))
    const badge = screen.getByRole("switch", {
      name: /Show the Supporter mark/,
    }) as HTMLInputElement
    fireEvent.click(badge)
    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(badge.checked).toBe(true)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it("keeps private profiles out and provides the settings link in the top panel", () => {
    render(
      React.createElement(SupporterPreferences, {
        visibility: "private",
        compact: true,
        listed: true,
      })
    )
    const listing = screen.getByRole("switch", {
      name: "Show me on this page",
    }) as HTMLInputElement
    expect(listing.disabled).toBe(true)
    expect(listing.checked).toBe(false)
    expect(
      screen
        .getByRole("link", { name: "Supporter mark settings" })
        .getAttribute("href")
    ).toBe("/profile/settings#supporter-settings")
  })
})

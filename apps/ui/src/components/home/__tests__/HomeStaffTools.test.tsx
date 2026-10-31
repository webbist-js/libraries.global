// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HOMEPAGE_DEFAULTS } from "@/components/home/homepage.content"
import { LibraryStaffSection } from "@/components/home/sections/LibraryStaffSection"
import { installAnalyticsClickTracking } from "@/lib/analytics-events"

const session = vi.hoisted(() => ({
  data: null as null | { user: { id: string } },
  isPending: false,
  error: null as Error | null,
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => session }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} onClick={(e) => e.preventDefault()} />
  ),
}))
afterEach(() => {
  cleanup()
  session.data = null
  session.isPending = false
  session.error = null
  delete window.librariesGlobalAnalytics
})
const show = () =>
  render(
    <LibraryStaffSection
      band={HOMEPAGE_DEFAULTS.libraryBand}
      tools={HOMEPAGE_DEFAULTS.libraryTools}
    />
  )

describe("homepage staff tool discovery", () => {
  it("keeps tools as descriptions for visitors, with public exploration and claim links", () => {
    show()
    expect(screen.queryByRole("link", { name: /Maintain hours/ })).toBeNull()
    expect(
      screen.getByText("Maintain hours, services and accessibility")
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Explore Teams" })).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Explore staff area" })
        .getAttribute("href")
    ).toBe("/staff")
    expect(
      screen.getByRole("link", { name: "Claim your library" })
    ).toBeTruthy()
  })
  it("restores workflow links and preserves the existing exploration attribution for signed-in users", () => {
    session.data = { user: { id: "private-user" } }
    const track = vi.fn()
    window.librariesGlobalAnalytics = {
      track,
    } as unknown as Window["librariesGlobalAnalytics"]
    const remove = installAnalyticsClickTracking(window)
    try {
      show()
      const link = screen.getByRole("link", { name: /Maintain hours/ })
      expect(link.getAttribute("href")).toBe("/staff")
      fireEvent.click(link)
      // Staff workflow links were never navigation-conversion events.
      expect(track).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("link", { name: "Explore Teams" }))
      expect(track).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(track.mock.calls)).not.toContain("private-user")
    } finally {
      remove()
    }
  })
  it.each(["pending", "error"])(
    "keeps descriptions during a %s session",
    (state) => {
      session.data = { user: { id: "private-user" } }
      session.isPending = state === "pending"
      session.error =
        state === "error" ? new Error("Session unavailable") : null
      show()
      expect(screen.queryByRole("link", { name: /Maintain hours/ })).toBeNull()
    }
  )
})

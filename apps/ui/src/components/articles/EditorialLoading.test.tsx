// @vitest-environment happy-dom
import Link from "next/link"
import { afterEach, describe, expect, it, vi } from "vitest"

import { JournalLoading } from "@/components/blog/JournalLoading"
import { DocsLoading } from "@/components/docs/DocsLoading"
import { cleanup, render, screen } from "@/test/render"

const headerState = vi.hoisted(() => ({
  suspended: false,
  pending: new Promise<void>(() => {}),
}))

vi.mock("@/components/global/GlobalHeader", () => ({
  default: () => {
    if (headerState.suspended) throw headerState.pending

    return (
      <header>
        <Link href="/">Libraries Global</Link>
      </header>
    )
  },
}))

afterEach(() => {
  cleanup()
  headerState.suspended = false
})

describe("editorial loading accessibility", () => {
  it.each([
    ["Journal landing", <JournalLoading key="journal" />],
    ["Journal article", <JournalLoading key="story" article />],
    ["Knowledge landing", <DocsLoading key="knowledge" />],
    ["Knowledge article", <DocsLoading key="guide" article />],
  ])(
    "%s announces loading once while preserving usable navigation",
    (_, fallback) => {
      render(fallback)

      const main = screen.getByRole("main")
      const status = screen.getByRole("status")
      const home = screen.getByRole("link", { name: "Libraries Global" })

      expect(status.textContent).toBe("Loading…")
      expect(screen.getAllByRole("status")).toHaveLength(1)
      expect(main.getAttribute("aria-busy")).toBe("true")
      // Announcements and the working header must not be inside the busy region.
      expect(status.closest('[aria-busy="true"]')).toBeNull()
      expect(
        home.closest('[aria-busy="true"], [aria-hidden="true"]')
      ).toBeNull()
      // Placeholder pills and fields must never become fake interactive controls.
      expect(
        main.querySelector("a, button, input, select, textarea, [tabindex]")
      ).toBeNull()
      expect(main.textContent).toBe("")
      expect(
        main.querySelectorAll('[data-slot="skeleton"]').length
      ).toBeGreaterThan(0)
      for (const placeholder of main.querySelectorAll(
        '[data-slot="skeleton"]'
      )) {
        expect(placeholder.closest('[aria-hidden="true"]')).toBeTruthy()
      }
    }
  )

  it("shows page placeholders immediately when the header's session read is pending", () => {
    headerState.suspended = true
    render(<DocsLoading />)

    expect(screen.getByRole("status").textContent).toBe("Loading…")
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true")
    expect(
      screen
        .getByRole("link", { name: "Libraries Global" })
        .getAttribute("href")
    ).toBe("/")
  })
})

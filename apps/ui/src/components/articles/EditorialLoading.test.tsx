// @vitest-environment happy-dom
import Link from "next/link"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { JournalLoading } from "@/components/blog/JournalLoading"
import { DocsLoading } from "@/components/docs/DocsLoading"
import { cleanup, render, screen } from "@/test/render"

vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/knowledge",
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@/components/dashboard/useDashboardScroll", () => ({
  useDashboardScroll: () => ({ current: null }),
}))
vi.mock("@/components/dashboard/DashboardFrame", () => ({
  useOptionalDashboardOverlay: () => ({ panel: null, handleClose: () => {} }),
  DashboardDrawer: () => null,
}))

afterEach(cleanup)

function withShell(fallback: ReactElement) {
  return (
    <>
      <header>
        <Link href="/">Libraries Global</Link>
      </header>
      {fallback}
    </>
  )
}

describe("editorial loading accessibility", () => {
  it.each([
    ["Journal landing", <JournalLoading key="journal" />],
    ["Journal article", <JournalLoading key="story" article />],
    ["Knowledge landing", <DocsLoading key="knowledge" />],
    ["Knowledge article", <DocsLoading key="guide" article />],
  ])(
    "%s announces loading once while preserving usable navigation",
    (_, fallback) => {
      render(withShell(fallback))

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
      // A pending rail must not offer a drawer containing fake navigation.
      expect(screen.queryByRole("button")).toBeNull()
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

  it("keeps the guide tree in the shared rail, with one reading column", () => {
    const { container } = render(withShell(<DocsLoading article />))
    expect(container.querySelectorAll(".dashboard-context-panel")).toHaveLength(
      1
    )
    expect(container.querySelector(".dashboard-context-footer")).toBeTruthy()
    expect(container.querySelector(".dashboard-record-overview")).toBeTruthy()
    expect(container.querySelectorAll(".dashboard-record-aside")).toHaveLength(
      1
    )
  })
})

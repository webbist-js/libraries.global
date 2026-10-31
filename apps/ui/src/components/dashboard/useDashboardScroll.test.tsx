// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { useDashboardScroll } from "./useDashboardScroll"

afterEach(cleanup)

function Page({ focusable = false }: { readonly focusable?: boolean }) {
  const root = useDashboardScroll("/knowledge")

  return (
    <div ref={root}>
      <div data-dashboard-scroll="content">
        <h1 tabIndex={focusable ? -1 : undefined}>Knowledge</h1>
      </div>
    </div>
  )
}

it("does not change streamed heading attributes before hydration", () => {
  render(
    <main id="main" tabIndex={-1}>
      <Page />
    </main>
  )

  expect(screen.getByRole("heading").hasAttribute("tabindex")).toBe(false)
  expect(document.activeElement).toBe(screen.getByRole("main"))
})

it("focuses the new page heading when its markup declares the focus target", () => {
  render(
    <main id="main" tabIndex={-1}>
      <Page focusable />
    </main>
  )

  expect(document.activeElement).toBe(screen.getByRole("heading"))
})

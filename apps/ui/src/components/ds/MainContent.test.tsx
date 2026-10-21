// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { SkipToContent } from "@/components/global/SkipToContent"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { MainContent } from "./MainContent"

afterEach(cleanup)
it("exposes one focusable main after navigation when section and page shells are composed", () => {
  render(
    <>
      <SkipToContent>Skip to content</SkipToContent>
      <header>
        <nav>Home</nav>
      </header>
      <MainContent>
        <h1>Community</h1>
        <MainContent id="main">
          <p>Drive content</p>
        </MainContent>
      </MainContent>
    </>
  )
  const main = screen.getByRole("main")
  expect(document.querySelectorAll("#main")).toHaveLength(1)
  expect(main.querySelector("header")).toBeNull()
  expect(main.textContent).toContain("Drive content")
  main.scrollIntoView = vi.fn()
  fireEvent.click(screen.getByRole("link", { name: "Skip to content" }))
  expect(document.activeElement).toBe(main)
})

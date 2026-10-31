// @vitest-environment happy-dom
import Link from "next/link"
import { afterEach, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen } from "@/test/render"

import { NavigationProgress } from "../NavigationProgress"

const route = vi.hoisted(() => ({ search: "" }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/moderation",
  useSearchParams: () => new URLSearchParams(route.search),
}))

function App() {
  return (
    <>
      <Link
        href="/?category=claims"
        onClick={(event) => event.preventDefault()}
      >
        Claims
      </Link>
      <NavigationProgress />
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  route.search = ""
})

it("finishes navigation progress when only the queue query changes", () => {
  vi.useFakeTimers()
  const view = render(<App />)
  fireEvent.click(screen.getByRole("link", { name: "Claims" }))
  expect(document.querySelector("[data-navigation-progress]")).toBeTruthy()
  route.search = "category=claims"
  view.rerender(<App />)
  act(() => vi.advanceTimersByTime(600))
  expect(document.querySelector("[data-navigation-progress]")).toBeNull()
})

it("does not start an in-page progress indicator for modified clicks", () => {
  render(<App />)
  fireEvent.click(screen.getByRole("link", { name: "Claims" }), {
    metaKey: true,
  })
  expect(document.querySelector("[data-navigation-progress]")).toBeNull()
})

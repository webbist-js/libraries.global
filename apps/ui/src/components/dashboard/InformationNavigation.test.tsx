// @vitest-environment happy-dom
import type { ComponentProps } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { InformationNavigation } from "./InformationNavigation"

vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}))

let freeTop = 100
let compareTop = 600
const links = [
  { href: "#free", label: "Free access" },
  { href: "#compare", label: "Compare plans" },
]
beforeEach(() => {
  freeTop = 100
  compareTop = 600
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top =
        this.id === "free" ? freeTop : this.id === "compare" ? compareTop : 0
      const bottom = this.classList.contains("record-toolbar") ? 60 : top + 200

      return {
        top,
        bottom,
        left: 0,
        right: 300,
        width: 300,
        height: bottom - top,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it.each([false, true])(
  "tracks desktop and mobile scroll containers when the navigation is portalled: %s",
  async (portalled) => {
    const navigation = (
      <InformationNavigation links={links} label="On this page" />
    )
    const { container } = render(
      <>
        <div className="dashboard-page">
          {!portalled ? navigation : null}
          <div className="dashboard-page-body">
            <div className="record-toolbar" />
            <section id="free" />
            <section id="compare" />
          </div>
        </div>
        {portalled ? navigation : null}
      </>
    )
    const free = screen.getByRole("link", { name: "Free access" })
    const compare = screen.getByRole("link", { name: "Compare plans" })
    expect(free.getAttribute("aria-current")).toBeNull()
    freeTop = 70
    fireEvent.scroll(container.querySelector(".dashboard-page-body")!)
    await waitFor(() =>
      expect(free.getAttribute("aria-current")).toBe("location")
    )
    freeTop = -500
    compareTop = 70
    fireEvent.scroll(container.querySelector(".dashboard-page")!)
    await waitFor(() =>
      expect(compare.getAttribute("aria-current")).toBe("location")
    )
    expect(free.getAttribute("aria-current")).toBeNull()
  }
)

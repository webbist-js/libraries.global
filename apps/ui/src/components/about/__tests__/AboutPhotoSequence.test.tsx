// @vitest-environment happy-dom
import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { AboutPhotoSequence } from "@/components/about/AboutPhotoSequence"
import { cleanup, fireEvent, render, waitFor } from "@/test/render"

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Native image fixture stands in for next/image in the DOM test.
    <img {...props} alt={props.alt ?? ""} />
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it("moves the photographs when the dashboard canvas scrolls, including anchor jumps", async () => {
  let sectionTop = 2000
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: !query.includes("reduced"),
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(el: Element) {
        this.callback(
          [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        )
      }

      disconnect() {}
    }
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal("innerHeight", 1000)
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("about-photo-content") ? 400 : 600
    }
  )
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.classList.contains("about-photo-sequence")
        ? sectionTop
        : 0

      return {
        top,
        bottom: this.classList.contains("record-toolbar") ? 61 : top + 1000,
        height: 1000,
        left: 0,
        right: 1200,
        width: 1200,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }
    }
  )
  const { container } = render(
    <div className="dashboard-page">
      <div className="dashboard-page-body" style={{ overflowY: "auto" }}>
        <div className="record-toolbar" />
        <AboutPhotoSequence
          libraries={[1, 2].map((n) => ({
            documentId: String(n),
            name: `Library ${n}`,
            place: "Country",
            image: "/photo.jpg",
            imageAlt: "Library",
            summary: null,
            href: null,
          }))}
        />
      </div>
    </div>
  )
  const track = container.querySelector<HTMLElement>(".about-photo-track")!
  expect(track.style.transform).toBe("translate3d(0px, 0, 0)")
  sectionTop = -400
  fireEvent.scroll(container.querySelector(".dashboard-page-body")!)
  await waitFor(() =>
    expect(track.style.transform).not.toBe("translate3d(0px, 0, 0)")
  )
  expect(track.style.transform).toMatch(/translate3d\(-[1-9]/)
})

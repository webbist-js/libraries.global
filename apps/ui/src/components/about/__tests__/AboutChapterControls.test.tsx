// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AboutNarrativeProvider,
  ContributionNetwork,
  CoverageExplorer,
  LibraryContexts,
  LibraryTypes,
  OpenPrinciples,
  RecordSteps,
} from "@/components/about/AboutChapterControls"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import {
  createGlobeNarrative,
  type GlobeNarrativeController,
} from "@/components/home/knowledge-globe-narrative"

vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))

afterEach(cleanup)

function renderControl(
  children: ReactNode,
  narrative: GlobeNarrativeController = createGlobeNarrative()
) {
  return {
    narrative,
    ...render(
      <AboutNarrativeProvider narrative={narrative}>
        {children}
      </AboutNarrativeProvider>
    ),
  }
}

const continents: HomepageContinentSummary[] = [
  {
    id: 1,
    documentId: "europe",
    name: "Europe",
    slug: "europe",
    code: "EU",
    libraryCount: 100,
  },
  {
    id: 2,
    documentId: "asia",
    name: "Asia",
    slug: "asia",
    code: "AS",
    libraryCount: 1,
  },
  {
    id: 3,
    documentId: "africa",
    name: "Africa",
    slug: "africa",
    code: "AF",
    libraryCount: 0,
  },
]

describe("About chapter controls", () => {
  it("restores each chapter's local choice when scrolling between different control families", () => {
    const narrative = createGlobeNarrative({ progress: 1 })
    renderControl(
      <>
        <LibraryContexts />
        <LibraryTypes />
      </>,
      narrative
    )
    const mobile = screen.getByRole("button", { name: /^Mobile A library/ })
    const publicLibraries = screen.getByRole("button", {
      name: /Public libraries/,
    })
    fireEvent.click(mobile)
    expect(narrative.current.focus).toBe(3)

    act(() => narrative.set({ progress: 1.2 }))
    expect(narrative.current.focus).toBe(3)
    act(() => narrative.set({ progress: 2 }))
    expect(narrative.current.focus).toBe(0)
    expect(publicLibraries.getAttribute("aria-pressed")).toBe("true")

    act(() => narrative.set({ progress: 1 }))
    expect(narrative.current.focus).toBe(3)
    expect(mobile.getAttribute("aria-pressed")).toBe("true")

    act(() => narrative.set({ progress: 4, focus: 5 }))
    expect(narrative.current.focus).toBe(5)
  })

  it("lets keyboard focus change the library context and canvas focus together", () => {
    const { narrative } = renderControl(<LibraryContexts />)
    const reading = screen.getByRole("button", { name: /Reading/ })
    const mobile = screen.getByRole("button", { name: /Mobile/ })
    expect(reading.getAttribute("aria-pressed")).toBe("true")

    fireEvent.focus(mobile)
    expect(narrative.current.focus).toBe(3)
    expect(mobile.getAttribute("aria-pressed")).toBe("true")
    expect(reading.getAttribute("aria-pressed")).toBe("false")
  })

  it("makes every institution type a selectable canvas focus while keeping the index link", () => {
    const { narrative } = renderControl(<LibraryTypes />)
    const mobile = screen.getByRole("button", { name: /Mobile libraries/ })
    fireEvent.click(mobile)
    expect(narrative.current.focus).toBe(5)
    expect(mobile.getAttribute("aria-pressed")).toBe("true")

    const archives = screen.getByRole("button", { name: /Archives & cultural/ })
    fireEvent.mouseEnter(archives)
    expect(narrative.current.focus).toBe(3)
    expect(archives.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen
        .getByRole("link", { name: "Browse the index" })
        .getAttribute("href")
    ).toBe("/libraries")
  })

  it("assembles a generic record on scroll and respects manual choices until progress changes", () => {
    const narrative = createGlobeNarrative({ progress: 2.6 })
    const { container, unmount } = renderControl(<RecordSteps />, narrative)
    expect(screen.getByText(/Stage 1 of 3/)).toBeTruthy()

    act(() => narrative.set({ progress: 2.9 }))
    expect(narrative.current.step).toBe(1)
    expect(screen.getByText(/Stage 2 of 3/)).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: /Review, then keep the history/ })
    )
    expect(narrative.current.step).toBe(2)
    expect(
      container.querySelectorAll('.about-record-layer[data-visible="true"]')
    ).toHaveLength(3)

    act(() => narrative.set({ focus: 4 }))
    expect(screen.getByText(/Stage 3 of 3/)).toBeTruthy()

    act(() => narrative.set({ progress: 2.55 }))
    expect(narrative.current.step).toBe(0)
    expect(screen.getByText(/Stage 1 of 3/)).toBeTruthy()
    expect(screen.getByText("An illustrative record")).toBeTruthy()
    expect(screen.queryByText(/British Library/)).toBeNull()

    unmount()
    narrative.set({ progress: 3.4 })
    expect(narrative.current.step).toBe(0)
  })

  it("changes the coverage scale without changing counts and keeps zero records honest", () => {
    const { narrative, container, rerender } = renderControl(
      <CoverageExplorer continents={continents} />
    )
    const asia = screen.getByRole("button", {
      name: /Asia 1 published libraries/,
    })
    const africa = screen.getByRole("button", {
      name: /Africa 0 published libraries/,
    })
    const asiaBar = asia.querySelector<HTMLSpanElement>(
      ".about-coverage-bar > span"
    )!
    const africaBar = africa.querySelector<HTMLSpanElement>(
      ".about-coverage-bar > span"
    )!
    expect(asiaBar.style.transform).toBe("scaleX(0.01)")
    expect(africaBar.style.transform).toBe("scaleX(0)")

    fireEvent.click(screen.getByRole("button", { name: "Log scale" }))
    expect(
      Number(asiaBar.style.transform.match(/scaleX\((.+)\)/)![1])
    ).toBeGreaterThan(0.1)
    expect(africaBar.style.transform).toBe("scaleX(0)")
    expect(asia.textContent).toContain("1")
    expect(africa.dataset.empty).toBe("true")

    fireEvent.click(asia)
    expect(narrative.current.focus).toBe(1)
    expect(asia.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("link", { name: "Explore Asia" }).getAttribute("href")
    ).toBe("/asia")

    fireEvent.focus(africa)
    expect(narrative.current.focus).toBe(2)
    expect(screen.getByText("0 published records so far.")).toBeTruthy()
    fireEvent.blur(africa)
    expect(narrative.current.focus).toBe(1)
    expect(container.textContent).toContain(
      "They do not measure how many libraries exist"
    )

    rerender(
      <AboutNarrativeProvider narrative={narrative}>
        <CoverageExplorer continents={[]} />
      </AboutNarrativeProvider>
    )
    expect(screen.getByText(/Coverage counts are unavailable/)).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Explore the atlas" })
        .getAttribute("href")
    ).toBe("/map")
  })

  it("responds to focused principles and preserves real code, methodology and licence destinations", () => {
    const { narrative } = renderControl(<OpenPrinciples />)
    const methodology = screen.getByRole("link", { name: /Methodology/ })
    fireEvent.focus(methodology)
    expect(narrative.current.focus).toBe(1)
    expect(methodology.dataset.active).toBe("true")
    expect(methodology.getAttribute("href")).toBe(
      "/knowledge/data-api/how-we-count"
    )
    fireEvent.blur(methodology)
    expect(methodology.dataset.active).toBe("false")
    expect(
      screen.getByRole("link", { name: /Source code/ }).getAttribute("href")
    ).toBe("https://github.com/webbist-js/libraries.global")
    expect(
      screen
        .getByRole("link", { name: /Data and attribution/ })
        .getAttribute("href")
    ).toBe("/legal/data-licence")
  })

  it("grows and resets the illustrative network without implying a submission", () => {
    const { narrative } = renderControl(<ContributionNetwork />)
    fireEvent.click(screen.getByRole("button", { name: "Add a point" }))
    expect(narrative.current.growth).toBe(0.5)
    expect(
      screen.getByText("Local knowledge adds to the picture.")
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "See the connections" }))
    expect(narrative.current.growth).toBe(1)
    expect(
      screen
        .getByRole("button", { name: "See the connections" })
        .getAttribute("aria-pressed")
    ).toBe("true")

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset the contribution illustration",
      })
    )
    expect(narrative.current.growth).toBe(0)
    expect(screen.getByText("It begins with one record.")).toBeTruthy()
    expect(screen.getByText(/Nothing is submitted/)).toBeTruthy()
  })
})

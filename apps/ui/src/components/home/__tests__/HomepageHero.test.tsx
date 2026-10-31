// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HOMEPAGE_DEFAULTS } from "@/components/home/homepage.content"
import HomepageHero from "@/components/home/HomepageHero"

const canvas = vi.hoisted(() => vi.fn())
vi.mock("@/components/home/KnowledgeGlobeCanvas", () => ({
  default: (props: unknown) => {
    canvas(props)

    return <div data-testid="hero-globe" />
  },
}))
vi.mock("@/components/home/HomeSearch", () => ({
  default: () => <input aria-label="Search libraries" />,
}))
vi.mock("@/components/home/sections/StatsStrip", () => ({
  default: () => null,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("homepage decorative globe", () => {
  it("retains the original effects and bottom-right pin without About-page controls or explanation", () => {
    render(
      <HomepageHero
        eyebrow={HOMEPAGE_DEFAULTS.heroEyebrow}
        title={HOMEPAGE_DEFAULTS.heroTitle}
        text={HOMEPAGE_DEFAULTS.heroText}
        markers={[{ lat: 51, lng: 0 }]}
      />
    )
    expect(
      screen.getByText("Open data · Open source · Free to use")
    ).toBeTruthy()
    expect(canvas.mock.calls[0]![0].overrides).toMatchObject({
      pin: { radius: 1.16, below: 0.15, inset: 0.4 },
      showArcs: true,
      showDust: true,
      showGlow: true,
      showHotspots: true,
      interactive: false,
      autoRotateSpeed: 0.018,
    })
    expect(canvas.mock.calls[0]![0].overrides).not.toHaveProperty("showLand")
    expect(
      screen.getByTestId("hero-globe").closest('[aria-hidden="true"]')
    ).toBeTruthy()
    expect(
      screen.queryByText(
        /Drag to rotate|How the globe lights up|Each light marks/
      )
    ).toBeNull()
  })
})

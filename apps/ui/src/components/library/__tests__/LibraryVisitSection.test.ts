// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/library/LibraryCorrection", async () => {
  const { createElement: h } = await import("react")
  const link = ({ children }: { children?: React.ReactNode }) =>
    h("a", { href: "#" }, children)

  return { OpenCorrectionLink: link, OpenVerifyLink: link }
})
vi.mock("@/components/global/GlobalLink", () => ({ default: () => null }))
vi.mock("@/lib/navigation", () => ({ Link: () => null }))
vi.mock("@/components/library/LibraryHoursTable", () => ({
  LibraryHoursTable: () => null,
  LibraryOpenStatusBadge: () => null,
}))
vi.mock("@/components/library/LibraryCopyButton", () => ({
  LibraryCopyButton: () => null,
}))

const { LibraryVisitSection } = await import("../LibrarySections")

afterEach(cleanup)

const show = (openingTimes: unknown) =>
  render(
    createElement(LibraryVisitSection, {
      library: { name: "Lib", slug: "lib", openingTimes } as never,
    })
  )

describe("LibraryVisitSection hours note", () => {
  it("asks for hours when no timeframe has both ends (the shared rule)", () => {
    show({
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [{ startTime: "09:00", endTime: "" }],
        },
      ],
    })
    expect(screen.getByText("Add the opening hours")).toBeTruthy()
  })

  it("dates real hours by their check", () => {
    show({
      days: [
        {
          day: "monday",
          enabled: true,
          timeframes: [{ startTime: "09:00", endTime: "17:00" }],
        },
      ],
    })
    expect(screen.queryByText("Add the opening hours")).toBeNull()
    expect(
      screen.getByText(
        /Not yet checked\. Temporary changes appear in the notices above/
      )
    ).toBeTruthy()
  })
})

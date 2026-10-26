// @vitest-environment happy-dom
import {
  defaultWidgetConfig,
  emptyWidgetSelection,
  type PublicWidget,
  type WidgetLibrary,
} from "@repo/shared-data"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WidgetView } from "@/components/widgets/WidgetView"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
function MockMap() {
  return null
}
vi.mock("next/dynamic", () => ({ default: () => MockMap }))
afterEach(cleanup)
const row = (
  documentId: string,
  name: string,
  answer: "yes" | "no" | "unknown",
  mapped = true
): WidgetLibrary => ({
  documentId,
  name,
  href: "/europe/uk/london/alpha",
  city: "London",
  address: "A street",
  libraryType: "Public",
  country: "UK",
  location: mapped ? { lat: 51, lng: 0 } : null,
  hours: [],
  operationalStatus: "open",
  facilities: [answer],
  why: ["From service"],
  locale: "en",
  updatedAt: null,
})
const data = (type: PublicWidget["type"] = "finder"): PublicWidget => ({
  publicId: "a".repeat(24),
  publisher: "A service",
  version: 1,
  publishedAt: "2026-10-26T00:00:00.000Z",
  branding: false,
  origins: [],
  type,
  config: defaultWidgetConfig(),
  spec: emptyWidgetSelection(),
  rows: [
    row("one", "Alpha Library", "yes"),
    row("two", "Beta Library", "no", false),
    row("three", "Gamma Library", "unknown"),
  ],
  attribution: [],
  checkedAt: "2026-10-26T00:00:00.000Z",
  diagnostics: {
    selected: 3,
    mapped: 2,
    missingCoordinates: 1,
    missingHours: 3,
    excludedIds: [],
    unresolvedIds: [],
    licenceIssues: [],
  },
})

describe("public widget states", () => {
  it("keeps unmapped libraries in lists and supports search/empty-state recovery", () => {
    render(<WidgetView data={data()} />)
    expect(screen.getByText("Beta Library")).toBeTruthy()
    expect(screen.getByText("Not on map")).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText("Search by library or town"), {
      target: { value: "Missing town" },
    })
    expect(screen.getByText("No libraries match")).toBeTruthy()
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0]!
    )
    expect(screen.getByText("Beta Library")).toBeTruthy()
  })
  it("translates visitor controls without translating stored facility values", () => {
    const d = data()
    d.config.locale = "fr"
    render(<WidgetView data={d} />)
    fireEvent.click(screen.getByLabelText("Entrée sans marches"))
    expect(screen.getByText("Alpha Library")).toBeTruthy()
    expect(screen.queryByText("Beta Library")).toBeNull()
    expect(
      screen.getByText("Contenu affiché en", { exact: false })
    ).toBeTruthy()
  })
  it("provides a table with recorded denominators and unknown values", () => {
    const d = data("chart")
    d.config.metric = "facility"
    d.config.chartMode = "percentage"
    render(<WidgetView data={d} />)
    expect(screen.getByText("50% of 2 recorded · 1 not recorded")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }))
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByText("50% of 2")).toBeTruthy()
  })
  it("retains source attribution when paid branding removes the powered-by line", () => {
    const d = data("stat")
    d.config.hidePowered = true
    d.attribution = [
      {
        label: "Original data publisher",
        url: "https://source.example",
        licence: "CC BY 4.0",
        licenceUrl: "https://source.example/licence",
      },
    ]
    render(<WidgetView data={d} />)
    expect(screen.queryByText("Powered by Libraries Global")).toBeNull()
    expect(
      screen.getByRole("link", { name: "Original data publisher" })
    ).toBeTruthy()
  })
  it("keeps geolocation opt-in and offers town search after denial", () => {
    const request = vi.fn((_success, error) => error({ code: 1 }))
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: request } })
    const d = data()
    d.config.locate = true
    render(<WidgetView data={d} />)
    expect(request).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
    expect(
      screen.getByText("Location was not shared. Search by town instead.")
    ).toBeTruthy()
    vi.unstubAllGlobals()
  })
})

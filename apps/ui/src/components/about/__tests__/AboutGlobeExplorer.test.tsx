// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  AboutGlobeCountry,
  AboutGlobeRecord,
  GlobeHover,
} from "@/components/about/about-globe.types"
import { AboutGlobeExplorer } from "@/components/about/AboutGlobeExplorer"

const countries: AboutGlobeCountry[] = [
  {
    slug: "france",
    name: "France",
    iso2: "FR",
    iso3: "FRA",
    continent: "europe",
    libraryCount: 96,
    center: { lat: 46, lng: 2 },
  },
  {
    slug: "germany",
    name: "Germany",
    iso2: "DE",
    iso3: "DEU",
    continent: "europe",
    libraryCount: 120,
    center: { lat: 51, lng: 10 },
  },
]
const record: AboutGlobeRecord = {
  summary: "Published country context.",
  capitalCity: "Paris",
  updatedAt: "2026-10-04T12:00:00Z",
  languages: "French",
  systemDescription: "A national network of libraries.",
  population: { count: 68000000, year: 2024, source: "World Bank" },
  regionCoverage: {
    total: 13,
    recorded: 4,
    label: "Regions",
    leading: { name: "Île-de-France", count: 40, slug: "ile-de-france" },
  },
  facts: [{ label: "Annual library visits", value: "2 million" }],
  libraryCount: 96,
  libraryTypeCounts: [
    { type: "Public", count: 90 },
    { type: "Academic", count: 6 },
  ],
  featuredLibraries: [
    {
      name: "A published library",
      place: "Paris",
      type: "Public",
      href: "/europe/france/paris/library",
    },
  ],
}
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) =>
    ({
      search_countries: "Search countries",
      search_countries_2: "Search countries…",
      no_results: "No results",
    })[key],
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))
vi.mock("@/components/about/AboutGlobePickingLayer", () => ({
  AboutGlobePickingLayer: function Picking({
    onHover,
    onPin,
  }: {
    onHover: (value: GlobeHover) => void
    onPin: (value: Extract<GlobeHover, { kind: "country" }>) => void
  }) {
    return (
      <>
        <button
          onMouseEnter={() =>
            onHover({
              kind: "country",
              country: countries[0]!,
              lat: 46,
              lng: 2,
            })
          }
          onMouseLeave={() => onHover(null)}
          onClick={() =>
            onPin({
              kind: "country",
              country: countries[0]!,
              lat: 46,
              lng: 2,
            })
          }
        >
          France surface
        </button>
        <button
          onMouseEnter={() =>
            onHover({
              kind: "country",
              country: countries[1]!,
              lat: 51,
              lng: 10,
            })
          }
        >
          Germany surface
        </button>
        <button
          onMouseEnter={() =>
            onHover({
              kind: "connection",
              index: 0,
              names: ["British Library", "Bibliothèque nationale de France"],
            })
          }
        >
          Connection
        </button>
      </>
    )
  },
}))
const fetcher = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetcher)
  fetcher.mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        url.endsWith("geojson") ? { features: [] } : { data: record },
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function Globe({ enabled = true }: { enabled?: boolean }) {
  return (
    <AboutGlobeExplorer
      enabled={enabled}
      allowRotation
      countries={countries}
      markers={[]}
    >
      {({
        layer,
        inspecting,
        rotationScale,
      }: {
        layer: ReactNode
        inspecting: boolean
        rotationScale: number
      }) => (
        <div
          data-testid="globe"
          data-inspecting={inspecting}
          data-rotation-scale={rotationScale}
        >
          {layer}
        </div>
      )}
    </AboutGlobeExplorer>
  )
}

async function ready() {
  render(<Globe />)
  await screen.findByRole("button", { name: "France surface" })
}

function chooseCountry(name: string) {
  fireEvent.click(screen.getByLabelText(/^Explore a country/))
  fireEvent.change(screen.getByRole("combobox"), { target: { value: name } })
  fireEvent.click(screen.getByRole("option", { name }))
}

describe("About country inspector", () => {
  it("loads CMS details on hover and keeps the card reachable across the pointer gap", async () => {
    await ready()
    fireEvent.mouseEnter(screen.getByRole("button", { name: "France surface" }))
    expect(
      screen.getByRole("complementary", { name: "France library record" })
    ).toBeTruthy()
    await screen.findByText("Published country context.")
    expect(
      screen
        .getByRole("link", { name: "A published library Paris · Public" })
        .getAttribute("href")
    ).toBe("/europe/france/paris/library")
    fireEvent.mouseLeave(screen.getByRole("button", { name: "France surface" }))
    fireEvent.pointerEnter(screen.getByRole("complementary"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 240))
    })
    expect(screen.getByRole("complementary")).toBeTruthy()
    expect(screen.queryByText(/estimated|verified by/i)).toBeNull()
  })
  it("keeps hover motion normal and slows only while a country is pinned", async () => {
    await ready()
    const globe = screen.getByTestId("globe")
    fireEvent.mouseEnter(screen.getByRole("button", { name: "France surface" }))
    expect(globe.dataset.rotationScale).toBe("1")
    fireEvent.click(screen.getByRole("button", { name: "Pin this country" }))
    expect(globe.dataset.rotationScale).toBe("0.25")
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Connection" }))
    expect(globe.dataset.rotationScale).toBe("0.25")
    fireEvent.keyDown(window, { key: "Escape" })
    expect(globe.dataset.rotationScale).toBe("1")
  })
  it("shows recorded regional coverage, type counts and sourced country context", async () => {
    await ready()
    chooseCountry("France")
    await screen.findByText("Published country context.")
    const coverage = screen.getByRole("progressbar")
    expect(coverage.getAttribute("aria-valuenow")).toBe("4")
    expect(coverage.getAttribute("aria-valuemax")).toBe("13")
    expect(coverage.getAttribute("aria-valuetext")).toBe(
      "4 of 13 listed regions have records"
    )
    expect(screen.getByText("Île-de-France")).toBeTruthy()
    expect(screen.getByText("Updated").querySelector("time")?.dateTime).toBe(
      record.updatedAt
    )
    fireEvent.click(screen.getByText("Country context"))
    expect(screen.getByText("French")).toBeTruthy()
    expect(screen.getByText("68,000,000")).toBeTruthy()
    expect(screen.getByText("World Bank")).toBeTruthy()
    expect(screen.getByText("2 million")).toBeTruthy()
  })
  it("offers three country-specific ways to contribute when no libraries are recorded", async () => {
    await ready()
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ...record,
          libraryCount: 0,
          libraryTypeCounts: [],
          featuredLibraries: [],
        },
      }),
    })
    chooseCountry("Germany")
    const add = await screen.findByRole("link", {
      name: "Add the first library",
    })
    expect(add.getAttribute("href")).toBe(
      "/contribute/index/new?continent=europe&country=germany"
    )
    expect(
      screen.getByRole("link", { name: "Propose a drive" }).getAttribute("href")
    ).toBe("/community/propose?country=germany")
    expect(
      screen
        .getByRole("link", { name: "See ways to contribute" })
        .getAttribute("href")
    ).toBe("/contribute")
    expect(screen.getByText(/gap in the index/)).toBeTruthy()
    expect(screen.queryByText("By type")).toBeNull()
    expect(screen.queryByText("Featured libraries")).toBeNull()
  })
  it("does not turn an unavailable count into an empty record", async () => {
    await ready()
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ...record, libraryCount: null } }),
    })
    chooseCountry("Germany")
    await screen.findByText("Library count unavailable")
    expect(
      screen.queryByRole("link", { name: "Add the first library" })
    ).toBeNull()
    expect(screen.getByRole("link", { name: "Country page" })).toBeTruthy()
  })
  it("searches the CMS countries by code and closes the search without unpinning", async () => {
    await ready()
    chooseCountry("France")
    fireEvent.click(screen.getByLabelText(/^Explore a country/))
    const search = screen.getByRole("combobox")
    fireEvent.change(search, { target: { value: "DE" } })
    expect(screen.queryByRole("option", { name: "France" })).toBeNull()
    expect(screen.getByRole("option", { name: "Germany" })).toBeTruthy()
    fireEvent.keyDown(search, { key: "Escape" })
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(
      screen.getByRole("complementary", { name: "France library record" })
    ).toBeTruthy()
    expect(document.activeElement).toBe(
      screen.getByLabelText(/^Explore a country/)
    )
  })
  it("keeps pinned details while another country is previewed and closes with Escape", async () => {
    await ready()
    fireEvent.click(screen.getByRole("button", { name: "France surface" }))
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Germany surface" })
    )
    expect(
      screen.getByRole("complementary", { name: "France library record" })
    ).toBeTruthy()
    expect(screen.getByText("Click to pin this country")).toBeTruthy()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByLabelText(/^Explore a country/)
    )
  })
  it("provides country navigation for keyboard and touch and discards stale responses", async () => {
    let finishFirst: ((value: unknown) => void) | undefined
    fetcher.mockImplementation((url: string) =>
      url.endsWith("geojson")
        ? Promise.resolve({ ok: true, json: async () => ({ features: [] }) })
        : url.includes("france")
          ? new Promise((resolve) => {
              finishFirst = resolve
            })
          : Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  ...record,
                  summary: "Germany's record",
                  capitalCity: "Berlin",
                  libraryCount: 120,
                },
              }),
            })
    )
    await ready()
    chooseCountry("France")
    await waitFor(() => expect(finishFirst).toBeTypeOf("function"))
    fireEvent.click(screen.getByRole("button", { name: "Next country" }))
    await screen.findByText("Germany's record")
    await act(async () => {
      finishFirst?.({ ok: true, json: async () => ({ data: record }) })
    })
    expect(screen.queryByText("Published country context.")).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "Open in the atlas" })
        .getAttribute("href")
    ).toBe("/map?v=51,10,5")
  })
  it("shows both endpoint names without directional wording", async () => {
    await ready()
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Connection" }))
    expect(screen.getByText("British Library")).toBeTruthy()
    expect(screen.getByText("Bibliothèque nationale de France")).toBeTruthy()
    expect(screen.queryByText(/^from|^to /i)).toBeNull()
    expect(screen.getByTestId("globe").dataset.inspecting).toBe("true")
  })
  it("keeps a usable country link when the CMS fails and lets the user retry", async () => {
    await ready()
    fetcher.mockImplementation((url: string) =>
      Promise.resolve({
        ok: url.endsWith("geojson"),
        json: async () => ({ data: record }),
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "France surface" }))
    await screen.findByRole("button", { name: "Try again" })
    expect(
      screen.getByRole("link", { name: "Country page" }).getAttribute("href")
    ).toBe("/europe/france")
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ data: record }),
    })
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText("Published country context.")
  })
  it("removes the interaction UI and pin when the frame leaves full view", async () => {
    const { rerender } = render(<Globe />)
    await screen.findByRole("button", { name: "France surface" })
    fireEvent.click(screen.getByRole("button", { name: "France surface" }))
    rerender(<Globe enabled={false} />)
    expect(screen.queryByRole("complementary")).toBeNull()
    expect(screen.queryByLabelText(/^Explore a country/)).toBeNull()
    rerender(<Globe />)
    expect(screen.queryByRole("complementary")).toBeNull()
  })
})

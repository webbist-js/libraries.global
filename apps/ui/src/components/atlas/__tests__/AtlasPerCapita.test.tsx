// @vitest-environment happy-dom
import {
  atlasPopulationBaseline,
  atlasPerCapitaCountry,
  emptyAtlasFilters,
  type AtlasPerCapitaResponse,
  type AtlasLibraryAccessResponse,
} from "@repo/shared-data"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { layerAccess, layerDef, toggleLayer } from "../atlas.logic"
import {
  AtlasAccessAnalysis,
  accessAreaInView,
  accessValue,
  libraryAccessCsv,
  sortAccessAreas,
} from "../AtlasAccessAnalysis"
import { AtlasPerCapitaControls, perCapitaCsv } from "../AtlasPerCapita"

afterEach(cleanup)
const { countries, ...baseline } = atlasPopulationBaseline
const country = {
  ...countries.find((row) => row.iso3 === "GBR")!,
  population: 69281000,
}
const response: AtlasPerCapitaResponse = {
  schemaVersion: 1,
  queryEpoch: "test",
  dictionaryVersion: "test",
  indexedThrough: "1",
  fingerprint: "test",
  evaluatedAt: "2026-10-09T12:00:00Z",
  scope: {
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
  baseline,
  countries: [
    atlasPerCapitaCountry(country, 6, 60),
    atlasPerCapitaCountry(
      { ...country, iso3: "NOD", name: "Not indexed" },
      0,
      0
    ),
    atlasPerCapitaCountry(
      { ...country, iso3: "ZER", name: "No filter matches" },
      0,
      10
    ),
  ],
  geometry: { type: "geojson", url: baseline.geometryUrl },
  exactTotal: 6,
  unmappedLibraries: 0,
  summary: {
    libraryCount: 6,
    population: country.population!,
    per100k: (6 / country.population!) * 100000,
    countries: 1,
  },
}
const accessResponse: AtlasLibraryAccessResponse = {
  ...response,
  level: "countries",
  geometry: { ...response.geometry, property: "iso3" },
  coverage: {
    countries: ["GBR"],
    note: "Country comparison worldwide; local data covers UK districts.",
  },
  areas: response.countries.map((area) => ({
    ...area,
    id: area.iso3,
    country: area.iso3,
    level: "countries",
    populationYear: 2024,
    populationSource: "World Bank",
    populationSourceUrl: "https://data.worldbank.org",
    populationLicence: "CC BY 4.0",
    populationRetrievedAt: response.evaluatedAt,
    peoplePerLibrary: area.libraryCount
      ? area.population! / area.libraryCount
      : null,
  })),
}
const analysis = {
  response: accessResponse,
  metric: "per100k" as const,
  selected: "GBR",
  onSelect: vi.fn(),
  onFit: vi.fn(),
  onClose: vi.fn(),
  onSettings: vi.fn(),
  collapsed: false,
  onCollapse: vi.fn(),
  onRetry: vi.fn(),
}
const controls = {
  metric: "per100k" as const,
  onMetric: vi.fn(),
  level: "auto" as const,
  onLevel: vi.fn(),
  resolvedLevel: "countries" as const,
  opacity: 0.85,
  onOpacity: vi.fn(),
  types: [],
  onTypes: vi.fn(),
  onAnalysis: vi.fn(),
}
it("enables the Pro layer and preserves pins while replacing area shading", () => {
  expect(layerAccess(layerDef("perCapita"), "pro")).toBe("available")
  expect(layerAccess(layerDef("perCapita"), "free")).toBe("pro")
  expect(layerDef("perCapita").sub).not.toContain("council")
  expect(toggleLayer(["pins", "population"], "perCapita")).toEqual({
    layers: ["pins", "perCapita"],
    replaced: "population",
  })
})
it("keeps measure, geography, types and opacity controls separate from analysis", () => {
  render(<AtlasPerCapitaControls {...controls} />)
  expect(screen.queryByText("69,281,000")).toBeNull()
  fireEvent.click(screen.getByRole("radio", { name: "People per library" }))
  expect(controls.onMetric).toHaveBeenCalledWith("peoplePerLibrary")
  fireEvent.click(screen.getByRole("radio", { name: "Local areas" }))
  expect(controls.onLevel).toHaveBeenCalledWith("local")
  fireEvent.click(screen.getByRole("button", { name: "Mobile" }))
  expect(controls.onTypes).toHaveBeenCalledWith(
    expect.not.arrayContaining(["mobile"])
  )
  fireEvent.change(
    screen.getByRole("slider", { name: "Library access opacity" }),
    { target: { value: "35" } }
  )
  expect(controls.onOpacity).toHaveBeenCalledWith(0.35)
  fireEvent.click(screen.getByRole("button", { name: "Open analysis" }))
  expect(controls.onAnalysis).toHaveBeenCalled()
})
it("separates area exploration, comparison and provenance while preserving selected context", () => {
  render(<AtlasAccessAnalysis {...analysis} />)
  expect(screen.getByText("69,281,000")).toBeTruthy()
  expect(screen.queryByRole("table")).toBeNull()
  expect(screen.queryByText(/Boundary version:/)).toBeNull()
  fireEvent.click(screen.getByRole("tab", { name: "Explore" }))
  fireEvent.change(screen.getByRole("combobox", { name: "Inspect an area" }), {
    target: { value: "NOD" },
  })
  expect(analysis.onSelect).toHaveBeenCalledWith("NOD")
  fireEvent.click(screen.getByRole("button", { name: /Zoom to/ }))
  expect(analysis.onFit).toHaveBeenCalledWith("GBR")
  fireEvent.click(screen.getByRole("tab", { name: "Compare" }))
  fireEvent.click(screen.getByRole("button", { name: "All areas as a table" }))
  expect(screen.getByRole("table")).toBeTruthy()
  expect(screen.getByRole("columnheader", { name: "Baseline" })).toBeTruthy()
  expect(screen.getByLabelText("Selected area context").textContent).toContain(
    "United Kingdom"
  )
  fireEvent.click(screen.getByRole("tab", { name: "Data" }))
  expect(screen.getByText(/library index is incomplete/)).toBeTruthy()
  expect(screen.getByText(/Boundary version:/)).toBeTruthy()
  expect(screen.queryByRole("table")).toBeNull()
  expect(
    screen.getByRole("button", { name: "Download area comparison CSV" })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Close analysis" }))
  expect(analysis.onClose).toHaveBeenCalled()
  expect(accessValue(accessResponse.areas[2]!, "peoplePerLibrary")).toBe(
    "No matching libraries"
  )
  expect(accessValue(accessResponse.areas[1]!, "peoplePerLibrary")).toBe(
    "No data"
  )
})
it("distinguishes unindexed areas, filtered zeros, loading and failure", () => {
  const { rerender } = render(
    <AtlasAccessAnalysis {...analysis} selected="NOD" />
  )
  expect(screen.getByText(/does not mean there are no libraries/)).toBeTruthy()
  rerender(
    <AtlasAccessAnalysis
      {...analysis}
      selected="ZER"
      metric="peoplePerLibrary"
    />
  )
  expect(
    screen.getByText(/No indexed libraries match these filters/)
  ).toBeTruthy()
  rerender(<AtlasAccessAnalysis {...analysis} response={undefined} />)
  expect(screen.getByRole("status").textContent).toContain("Loading")
  rerender(<AtlasAccessAnalysis {...analysis} error="Unavailable" />)
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(analysis.onRetry).toHaveBeenCalled()
})
it("exports source codes and reciprocal values without spreadsheet injection", () => {
  const csv = libraryAccessCsv({
    ...accessResponse,
    areas: [{ ...accessResponse.areas[0]!, name: "=formula" }],
  })
  expect(csv).toContain('"\'=formula"')
  expect(csv).toContain("People per library")
  expect(csv).toContain("Boundary version")
  expect(csv).toContain("Mobile services counted once")
})
it("exports missing rates as blank with definitions, dates and safe text", () => {
  const csv = perCapitaCsv({
    ...response,
    countries: [{ ...response.countries[1]!, name: "=formula" }],
  })
  expect(csv).toContain('"\'=formula"')
  expect(csv).toContain('"2024","","no_records"')
  expect(csv).toContain("2026-10-09T12:00:00Z")
  expect(csv).toContain("Filters and accessibility")
  expect(csv).toContain("Incomplete library index")
})
it("scopes analysis to visible whole areas without hiding other areas from the table", () => {
  const bounds = { west: -7, south: 49, east: 2, north: 60 }
  const other = {
    ...accessResponse.areas[0]!,
    id: "USA",
    name: "United States",
    bounds: { west: -125, south: 25, east: -66, north: 49 },
  }
  render(
    <AtlasAccessAnalysis
      {...analysis}
      viewBounds={bounds}
      response={{ ...accessResponse, areas: [accessResponse.areas[0]!, other] }}
    />
  )
  expect(screen.getByText(/1 country intersecting the map view/)).toBeTruthy()
  expect(screen.queryByRole("button", { name: /United States/ })).toBeNull()
  fireEvent.change(screen.getByRole("combobox", { name: "Analysis scope" }), {
    target: { value: "all" },
  })
  fireEvent.click(screen.getByRole("tab", { name: "Compare" }))
  expect(screen.getByText(/2 countries in the comparison/)).toBeTruthy()
  expect(screen.getByRole("button", { name: /United States/ })).toBeTruthy()
  expect(
    accessAreaInView(
      { ...other, bounds: { west: 175, east: 185, south: -20, north: 0 } },
      { west: -180, east: -170, south: -30, north: 10 }
    )
  ).toBe(true)
})

it("sorts the selected metric in both directions and keeps unknown rates after filtered zeros", () => {
  const zero = accessResponse.areas[2]!,
    missing = accessResponse.areas[1]!,
    available = accessResponse.areas[0]!
  expect(
    sortAccessAreas(
      [missing, zero, available],
      "peoplePerLibrary",
      "rate",
      "desc"
    ).map((area) => area.id)
  ).toEqual(["ZER", "GBR", "NOD"])
  expect(
    sortAccessAreas(
      [missing, zero, available],
      "peoplePerLibrary",
      "rate",
      "asc"
    ).map((area) => area.id)
  ).toEqual(["GBR", "ZER", "NOD"])
  expect(
    sortAccessAreas([missing, zero, available], "per100k", "rate", "asc").map(
      (area) => area.id
    )
  ).toEqual(["ZER", "GBR", "NOD"])
})
it("preserves table search and selected metric when switching tasks, with a bounded page", () => {
  const areas = Array.from({ length: 31 }, (_, index) => ({
    ...accessResponse.areas[0]!,
    id: `area-${index}`,
    name: `Area ${String(index).padStart(2, "0")}`,
    libraryCount: index + 1,
    per100k: index + 1,
    peoplePerLibrary: 100000 / (index + 1),
  }))
  render(
    <AtlasAccessAnalysis
      {...analysis}
      selected="area-1"
      metric="peoplePerLibrary"
      response={{ ...accessResponse, areas }}
    />
  )
  fireEvent.click(screen.getByRole("tab", { name: "Compare" }))
  fireEvent.click(screen.getByRole("button", { name: "All areas as a table" }))
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26)
  expect(
    (screen.getByRole("combobox", { name: "Direction" }) as HTMLSelectElement)
      .value
  ).toBe("desc")
  fireEvent.change(screen.getByRole("searchbox", { name: "Search areas" }), {
    target: { value: "Area 01" },
  })
  fireEvent.click(screen.getByRole("tab", { name: "Data" }))
  fireEvent.click(screen.getByRole("tab", { name: "Compare" }))
  expect(
    (
      screen.getByRole("searchbox", {
        name: "Search areas",
      }) as HTMLInputElement
    ).value
  ).toBe("Area 01")
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2)
  expect(screen.getByLabelText("Selected area context").textContent).toContain(
    "Area 01"
  )
})

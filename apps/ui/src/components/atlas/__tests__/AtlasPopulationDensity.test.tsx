// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import {
  AtlasPopulationDensityAnalysis,
  AtlasPopulationDensityControls,
} from "../AtlasPopulationDensity"

afterEach(cleanup)

const controls = {
  level: "auto" as const,
  onLevel: vi.fn(),
  opacity: 0.7,
  onOpacity: vi.fn(),
  country: "GB",
  countries: [
    { value: "GB", label: "United Kingdom" },
    { value: "SE", label: "Sweden" },
  ],
  onCountry: vi.fn(),
  resolvedLabel: "Showing country averages.",
}

it("does not present the retained UK local profile as a filter for global population", () => {
  const { rerender } = render(<AtlasPopulationDensityControls {...controls} />)
  expect(screen.getByRole("combobox", { name: "Map detail" })).toBeTruthy()
  expect(screen.queryByRole("combobox", { name: "Country" })).toBeNull()
  expect(screen.getByText("Showing country averages.")).toBeTruthy()

  rerender(<AtlasPopulationDensityControls {...controls} level="countries" />)
  expect(screen.queryByRole("combobox", { name: "Country" })).toBeNull()
})

it("keeps the supported-country picker available when choosing local detail", () => {
  const onCountry = vi.fn()
  render(
    <AtlasPopulationDensityControls
      {...controls}
      level="local"
      onCountry={onCountry}
    />
  )
  const picker = screen.getByRole("combobox", { name: "Country" })
  fireEvent.keyDown(picker, { key: "Enter" })
  fireEvent.click(screen.getByRole("option", { name: "Sweden" }))
  expect(onCountry).toHaveBeenCalledWith("SE")
})

it("shows Canada's sourced population without describing it as a UK selection", () => {
  render(
    <AtlasPopulationDensityAnalysis
      controls={controls}
      response={{
        schemaVersion: 1,
        level: "countries",
        populationVersion: "wdi-2024",
        boundaryVersion: "countries-v1",
        geometry: {
          type: "geojson",
          url: "/countries.geojson",
          property: "iso3",
        },
        areas: [
          {
            id: "CAN",
            name: "Canada",
            population: 41262329,
            year: 2024,
            areaKm2: 9872084.8,
            peoplePerKm2: 4.2,
            source: "World Bank WDI",
            sourceUrl: "https://data.worldbank.org",
            licence: "CC BY 4.0",
            bounds: null,
          },
        ],
        areaMethod: "Approximate boundary area",
        note: "Country averages",
      }}
      selected="CAN"
      onSelect={vi.fn()}
      error={null}
      retry={vi.fn()}
      onClose={vi.fn()}
      collapsed={false}
      onCollapse={vi.fn()}
    />
  )
  expect(screen.getByRole("heading", { name: "Canada" })).toBeTruthy()
  expect(screen.getByText("41,262,329 residents · 2024")).toBeTruthy()
  expect(
    screen.getByRole("region", { name: "Settings" }).textContent
  ).not.toContain(" · GB")
})

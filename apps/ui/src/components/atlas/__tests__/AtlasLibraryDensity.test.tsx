// @vitest-environment happy-dom
import {
  atlasCellId,
  atlasDensityCell,
  DEFAULT_ATLAS_DENSITY,
  type AtlasLibraryDensity as Density,
} from "@repo/shared-data"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import {
  AtlasLibraryDensity,
  AtlasLibraryDensityLegend,
} from "../AtlasLibraryDensity"

afterEach(cleanup)
const data: Density = {
  mode: "cells",
  resolution: 14,
  requestedResolution: 14,
  coarsened: false,
  exactTotal: 17,
  cells: [],
  maxPer100Km2: 2,
}
it("provides density settings, numeric inspection and independent shading", () => {
  const onSettings = vi.fn(),
    onPins = vi.fn(),
    onResults = vi.fn()
  const selected = atlasDensityCell(
    atlasCellId({ lat: 51.5, lng: -0.1 }, 14),
    3
  )
  render(
    <AtlasLibraryDensity
      data={data}
      settings={DEFAULT_ATLAS_DENSITY}
      onSettings={onSettings}
      selected={selected}
      pins={false}
      onPins={onPins}
      onResults={onResults}
      centre={{ lat: 51.5, lng: -0.1 }}
      retry={vi.fn()}
    />
  )
  expect(screen.getByText("17")).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Presentation" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Map detail" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Colour scale" })).toBeTruthy()
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show library locations" })
  )
  expect(onPins).toHaveBeenCalledOnce()
  fireEvent.change(screen.getByRole("slider"), { target: { value: "45" } })
  expect(onSettings).toHaveBeenCalledWith({
    ...DEFAULT_ATLAS_DENSITY,
    opacity: 0.45,
  })
  fireEvent.click(screen.getByRole("button", { name: "Zoom to this cell" }))
  expect(onResults).toHaveBeenCalledWith(selected)
})
it("labels smooth concentration as relative and local numeric contrast with its actual scale", () => {
  const { rerender } = render(
    <AtlasLibraryDensityLegend
      data={data}
      settings={{ ...DEFAULT_ATLAS_DENSITY, view: "smooth" }}
    />
  )
  expect(screen.getByText("Relative concentration")).toBeTruthy()
  expect(screen.queryByText("Libraries per 100 km²")).toBeNull()
  rerender(
    <AtlasLibraryDensityLegend
      data={data}
      settings={{ ...DEFAULT_ATLAS_DENSITY, scale: "local" }}
    />
  )
  expect(screen.getByText("2+")).toBeTruthy()
  expect(
    screen.getByText("Colours stretch to the highest cell value in this view.")
  ).toBeTruthy()
})

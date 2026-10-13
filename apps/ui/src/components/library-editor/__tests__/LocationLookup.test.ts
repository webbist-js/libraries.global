// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Place } from "@/lib/geocode/place"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const place = (id: string, label: string, kind: string): Place => ({
  id,
  label,
  detail: "Euston Road, London, England, United Kingdom",
  kind,
  lat: 51.53,
  lng: -0.127,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
})
const LIBRARY = place("W1", "British Library", "Library")
const INSTITUTE = place("N2", "The Alan Turing Institute", "Research")

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
  Response.json({ data: [LIBRARY, INSTITUTE] })
)

const { LocationLookup } = await import("../LocationLookup")

const onPick = vi.fn()
const onLocate = vi.fn()
const show = (initialQuery = "") =>
  render(createElement(LocationLookup, { initialQuery, onPick, onLocate }))
const box = () => screen.getByRole("combobox") as HTMLInputElement

function geolocation(value: unknown) {
  Object.defineProperty(navigator, "geolocation", {
    value,
    configurable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  geolocation(undefined)
})
afterEach(cleanup)

describe("LocationLookup search", () => {
  it("waits for three characters and a pause before searching", async () => {
    show()
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: "Br" } })
    await new Promise((r) => setTimeout(r, 400))
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(box(), { target: { value: "Bri" } })
    expect(
      await screen.findByRole("option", { name: /^British Library/ })
    ).toBeTruthy()
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/geocode/search?q=Bri")
    expect(box().getAttribute("aria-expanded")).toBe("true")
  })

  it("picks a result with the arrow keys and Enter", async () => {
    show("British Library")
    fireEvent.focus(box())
    await screen.findByRole("option", { name: /^British Library/ })

    fireEvent.keyDown(box(), { key: "ArrowDown" })
    fireEvent.keyDown(box(), { key: "ArrowDown" })
    const second = screen.getByRole("option", { name: /^The Alan Turing/ })
    expect(box().getAttribute("aria-activedescendant")).toBe(second.id)

    fireEvent.keyDown(box(), { key: "Enter" })
    expect(onPick).toHaveBeenCalledWith(INSTITUTE)
    expect(box().value).toBe("The Alan Turing Institute")
    expect(screen.queryByRole("option")).toBeNull()
    expect(screen.getByText(/Filled in from OpenStreetMap/)).toBeTruthy()
  })

  it("picks a result with the mouse", async () => {
    show("British Library")
    fireEvent.focus(box())
    fireEvent.click(
      await screen.findByRole("option", { name: /^British Library/ })
    )
    expect(onPick).toHaveBeenCalledWith(LIBRARY)
  })

  it("says when nothing matches", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }))
    show("Nowhere at all")
    fireEvent.focus(box())
    expect(await screen.findByText(/No matches/)).toBeTruthy()
  })

  it("says when search is unavailable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 502 }))
    show("Haworth")
    fireEvent.focus(box())
    expect(
      await screen.findByText(/Search isn.t available right now/)
    ).toBeTruthy()
  })
})

describe("LocationLookup, Use my location", () => {
  const position = (accuracy: number) => ({
    getCurrentPosition: (ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 53.83, longitude: -1.957, accuracy } }),
  })

  it("isn't offered without geolocation", () => {
    show()
    expect(screen.queryByRole("button", { name: /Use my location/ })).toBeNull()
  })

  it("reports where the device is", async () => {
    geolocation(position(35))
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    expect(onLocate).toHaveBeenCalledWith(53.83, -1.957)
    expect(screen.getByText(/within 35 m/)).toBeTruthy()
  })

  it("warns when the position is approximate", async () => {
    geolocation(position(1200))
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    expect(screen.getByText("Your location is approximate")).toBeTruthy()
  })

  it("explains a refusal", async () => {
    geolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) =>
        fail({ code: 1 }),
    })
    show()
    fireEvent.click(
      await screen.findByRole("button", { name: /Use my location/ })
    )
    await waitFor(() =>
      expect(screen.getByText("Location access is off")).toBeTruthy()
    )
    expect(onLocate).not.toHaveBeenCalled()
  })
})

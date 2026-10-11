// @vitest-environment happy-dom
import * as React from "react"
import { createElement, useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Place } from "@/lib/geocode/place"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import type { FormData } from "../wizard.types"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
// The map has its own tests; here a button stands in for a dropped pin.
vi.mock("../LocationPinMap", async () => {
  const { createElement: h } = await import("react")

  return {
    LocationPinMap: ({
      onMove,
    }: {
      onMove: (lat: number, lng: number) => void
    }) =>
      h(
        "button",
        { type: "button", onClick: () => onMove(53.8311966, -1.9574451) },
        "Drop pin"
      ),
  }
})

const LIBRARY: Place = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "Somers Town",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
}
const CHURCHYARD: Place = {
  id: "W120289822",
  label: "Haworth Churchyard",
  detail:
    "Haworth and Stanbury, Bradford, West Yorkshire, England, United Kingdom",
  kind: "Cemetery",
  lat: 53.8309287,
  lng: -1.9566318,
  precise: false,
  address: {
    streetAddress: "",
    district: "Haworth and Stanbury",
    city: "Bradford",
    postalCode: "",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "West Yorkshire",
  },
}

const DATA: Record<string, unknown> = {
  "/api/geocode/search?q=British%20Library": [LIBRARY],
  "/api/geocode/reverse?lat=53.8311966&lng=-1.9574451": CHURCHYARD,
  "/api/relations/countries?iso2=GB-ENG%2CGB": [
    {
      documentId: "eng",
      name: "England",
      iso2: "GB-ENG",
      continentDocumentId: "eu",
    },
  ],
  "/api/relations/continents": [{ documentId: "eu", name: "Europe" }],
  "/api/relations/countries?continentDocumentId=eu": [
    { documentId: "eng", name: "England" },
  ],
  "/api/relations/regions?countryDocumentId=eng": [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ],
}
const fetchMock = vi.fn(async (url: string) =>
  Response.json({ data: DATA[url] ?? [] })
)

const { StepLocation } = await import("../StepLocation")
const { EMPTY_FORM } = await import("../wizard.types")
const { EditableFieldsContext } = await import("../WizardFields")
const { editableFields } = await import("../translation-mode")

const seen = vi.fn<(form: FormData) => void>()
const lastForm = () => seen.mock.lastCall?.[0]

function Harness({
  initial,
  improving = false,
}: {
  initial: FormData
  improving?: boolean
}) {
  const [f, setFormData] = useState(initial)
  useEffect(() => seen(f))

  return createElement(StepLocation, {
    f,
    setFormData,
    improving,
    set: (k: keyof FormData, v: string) =>
      setFormData((prev) => ({ ...prev, [k]: v })),
  })
}

const show = (initial: FormData, improving = false) =>
  render(createElement(Harness, { initial, improving }))
const value = (id: string) =>
  (document.getElementById(id) as HTMLInputElement).value

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("StepLocation", () => {
  it("fills the address, the pin and the atlas from a picked result", async () => {
    show(EMPTY_FORM)
    // Scoped by name: the hierarchy selects (LocationHierarchySelector)
    // are native <select>s, which also carry an implicit "combobox" role.
    const box = screen.getByRole("combobox", {
      name: "Find the library or its address",
    })
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: "British Library" } })
    fireEvent.click(
      await screen.findByRole("option", { name: /^British Library/ })
    )

    expect(value("streetAddress")).toBe("96 Euston Road")
    expect(value("city")).toBe("London")
    expect(value("district")).toBe("Somers Town")
    expect(value("postalCode")).toBe("NW1 2DB")
    expect(value("lat")).toBe("51.529912")
    expect(value("lng")).toBe("-0.127692")
    await waitFor(() =>
      expect(lastForm()).toMatchObject({
        continentDocumentId: "eu",
        countryDocumentId: "eng",
        regionDocumentId: "gl",
        country: "England",
      })
    )
    expect(screen.getByText("Set from the address. Check these.")).toBeTruthy()
  })

  it("fills an empty address from a dropped pin", async () => {
    show(EMPTY_FORM)
    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    expect(value("lat")).toBe("53.831197")
    expect(value("lng")).toBe("-1.957445")
    await waitFor(() => expect(value("city")).toBe("Bradford"))
    expect(value("district")).toBe("Haworth and Stanbury")
    await waitFor(() => expect(lastForm()?.regionDocumentId).toBe("wy"))
  })

  it("offers the nearest address instead of overwriting one", async () => {
    show({ ...EMPTY_FORM, city: "Haworth" })
    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    expect(await screen.findByText(/Nearest address to the pin/)).toBeTruthy()
    expect(value("city")).toBe("Haworth")

    // Editing the address withdraws the offer.
    fireEvent.change(document.getElementById("streetAddress")!, {
      target: { value: "Church Street" },
    })
    expect(screen.queryByText(/Nearest address to the pin/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Drop pin" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Use this address" })
    )
    expect(value("city")).toBe("Bradford")
    expect(value("streetAddress")).toBe("Church Street")
    expect(screen.queryByText(/Nearest address to the pin/)).toBeNull()
  })

  it("starts a new library's search from its name", async () => {
    show({ ...EMPTY_FORM, name: "Radlett Library" })
    expect(
      (
        screen.getByRole("combobox", {
          name: "Find the library or its address",
        }) as HTMLInputElement
      ).value
    ).toBe("Radlett Library")
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/relations/continents")
    )
  })

  it("starts empty when improving a record", async () => {
    show({ ...EMPTY_FORM, name: "Radlett Library" }, true)
    expect(
      (
        screen.getByRole("combobox", {
          name: "Find the library or its address",
        }) as HTMLInputElement
      ).value
    ).toBe("")
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/relations/continents")
    )
  })

  it("leaves out the search and the map while translating", async () => {
    const editable = new Set(editableFields(true, Object.keys(EMPTY_FORM)))
    render(
      createElement(
        EditableFieldsContext.Provider,
        { value: editable },
        createElement(Harness, { initial: EMPTY_FORM })
      )
    )
    expect(
      screen.queryByRole("combobox", {
        name: "Find the library or its address",
      })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Drop pin" })).toBeNull()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/relations/continents")
    )
  })
})

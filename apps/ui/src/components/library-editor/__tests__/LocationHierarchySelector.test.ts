// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))

import { LocationHierarchySelector } from "../LocationHierarchySelector"
import { EMPTY_FORM } from "../wizard.types"

const LISTS: Record<string, unknown[]> = {
  continents: [{ documentId: "eu", name: "Europe" }],
  countries: [
    {
      documentId: "ch",
      name: "Switzerland",
      regionTypeLabel: "Canton",
      areaTypeLabel: "District",
    },
    { documentId: "xx", name: "Nowhere" },
  ],
  regions: [
    { documentId: "bern", name: "Bern" },
    {
      documentId: "geneva",
      name: "Geneva",
      areaTypeLabel: "Commune",
      areasSectionLabel: "Communes",
    },
  ],
  areas: [],
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const type = /\/api\/relations\/([a-z]+)/.exec(url)?.[1] ?? ""
      if (type === "areas" && /regionDocumentId=bern(?:&|$)/.test(url))
        return Response.json({
          data: [{ documentId: "a1", name: "Bern-Mittelland" }],
        })

      return Response.json({ data: LISTS[type] ?? [] })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderWith = (countryDocumentId: string, regionDocumentId = "") =>
  render(
    createElement(LocationHierarchySelector, {
      f: {
        ...EMPTY_FORM,
        continentDocumentId: "eu",
        countryDocumentId,
        regionDocumentId,
      },
      setFormData: () => {},
    })
  )

const areaSelect = () =>
  screen.getByLabelText(/District/) as unknown as HTMLSelectElement

describe("LocationHierarchySelector", () => {
  it("names the Region and Area selects as the country does", async () => {
    renderWith("ch")
    await waitFor(() => expect(screen.getByLabelText("Canton")).toBeTruthy())
    expect(screen.getByLabelText(/District/)).toBeTruthy()
  })

  it("says Region and Area for a country without labels", async () => {
    renderWith("xx")
    await waitFor(() => expect(screen.getByLabelText("Region")).toBeTruthy())
    expect(screen.getByLabelText(/^Area/)).toBeTruthy()
  })

  it("disables the Area select when the Region has no Areas", async () => {
    renderWith("ch", "bern-empty")
    await waitFor(() => expect(screen.getByText("No districts listed")))
    expect(areaSelect().disabled).toBe(true)
  })

  it("names the Area select as the Region does, over the country", async () => {
    renderWith("ch", "geneva")
    await waitFor(() => expect(screen.getByLabelText(/Commune/)).toBeTruthy())
    expect(screen.getByText("No communes listed")).toBeTruthy()
    expect(screen.queryByLabelText(/District/)).toBeNull()
  })

  it("keeps the Area select open when the Region has Areas", async () => {
    renderWith("ch", "bern")
    await waitFor(() =>
      expect(screen.getByText("Bern-Mittelland")).toBeTruthy()
    )
    expect(areaSelect().disabled).toBe(false)
    expect(screen.queryByText("No districts listed")).toBeNull()
  })

  it("offers no Location Request", async () => {
    renderWith("ch")
    await waitFor(() => expect(screen.getByLabelText("Canton")).toBeTruthy())
    expect(screen.queryByText("Not listed?")).toBeNull()
  })
})

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
  regions: [],
  areas: [],
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const type = /\/api\/relations\/([a-z]+)/.exec(url)?.[1] ?? ""

      return Response.json({ data: LISTS[type] ?? [] })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderWith = (countryDocumentId: string) =>
  render(
    createElement(LocationHierarchySelector, {
      f: { ...EMPTY_FORM, continentDocumentId: "eu", countryDocumentId },
      setFormData: () => {},
    })
  )

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

  it("offers no Location Request", async () => {
    renderWith("ch")
    await waitFor(() => expect(screen.getByLabelText("Canton")).toBeTruthy())
    expect(screen.queryByText("Not listed?")).toBeNull()
  })
})

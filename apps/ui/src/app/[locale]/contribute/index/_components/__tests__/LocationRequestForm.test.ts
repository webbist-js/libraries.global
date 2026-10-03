// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const COUNTRY = "k00000000000000000000001"
const REGION = "r00000000000000000000001"

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
  url === "/api/submissions"
    ? Response.json({ data: { documentId: "req0000000000000000000001" } })
    : Response.json({ data: [] })
)

const { LocationRequestForm, LOCATION_REQUEST_SENT, locationRequestFields } =
  await import("../LocationRequestForm")
const { LocationHierarchySelector, LocationRequestsContext } = await import(
  "../LocationHierarchySelector"
)
const { EMPTY_FORM } = await import("../wizard.types")
type FormData = import("../wizard.types").FormData

const posted = () => {
  const call = fetchMock.mock.calls.find(([u]) => u === "/api/submissions")

  return call ? JSON.parse(String(call[1]?.body)) : null
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("locationRequestFields", () => {
  const base = {
    kind: "area" as const,
    name: " Dover ",
    typeLabel: "",
    evidenceUrl: "https://example.org/dover",
    note: "",
    countryDocumentId: COUNTRY,
    regionDocumentId: REGION,
  }

  it("builds Strapi's fields, dropping empty optional ones", () => {
    expect(locationRequestFields(base)).toEqual({
      ok: true,
      fields: {
        kind: "area",
        name: "Dover",
        countryDocumentId: COUNTRY,
        regionDocumentId: REGION,
        evidenceUrl: "https://example.org/dover",
      },
    })
  })

  it("refuses a short name, a bad link and an area without a region", () => {
    expect(locationRequestFields({ ...base, name: "x" }).ok).toBe(false)
    expect(
      locationRequestFields({ ...base, evidenceUrl: "example.org" }).ok
    ).toBe(false)
    expect(
      locationRequestFields({ ...base, regionDocumentId: undefined }).ok
    ).toBe(false)
  })
})

describe("LocationRequestForm", () => {
  it("creates the location request and reports it", async () => {
    const onCreated = vi.fn()
    render(
      createElement(LocationRequestForm, {
        kind: "region",
        countryDocumentId: COUNTRY,
        parentName: "United Kingdom",
        onCreated,
        onCancel: () => {},
      })
    )
    fill(/^Name/, "Somerset")
    fill(/^Type/, "County")
    fill(/^Evidence link/, "https://example.org/somerset")
    fireEvent.click(screen.getByRole("button", { name: "Ask for this region" }))

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({
        documentId: "req0000000000000000000001",
        name: "Somerset",
      })
    )
    expect(posted()).toEqual({
      submissionType: "location_request",
      targetEntityType: "region",
      fields: {
        kind: "region",
        name: "Somerset",
        typeLabel: "County",
        countryDocumentId: COUNTRY,
        evidenceUrl: "https://example.org/somerset",
      },
    })
  })

  it("shows the problem and sends nothing without an evidence link", async () => {
    render(
      createElement(LocationRequestForm, {
        kind: "region",
        countryDocumentId: COUNTRY,
        onCreated: () => {},
        onCancel: () => {},
      })
    )
    fill(/^Name/, "Somerset")
    fireEvent.click(screen.getByRole("button", { name: "Ask for this region" }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/link/)
    expect(posted()).toBeNull()
  })
})

describe("Not listed? in the hierarchy selector", () => {
  it("stores the proposal on the wizard form", async () => {
    let latest: FormData | null = null
    function Harness() {
      const [f, setFormData] = useState<FormData>({
        ...EMPTY_FORM,
        continentDocumentId: "c00000000000000000000001",
        countryDocumentId: COUNTRY,
      })
      latest = f

      return createElement(
        LocationRequestsContext.Provider,
        { value: true },
        createElement(LocationHierarchySelector, { f, setFormData })
      )
    }
    render(createElement(Harness))
    fireEvent.click(screen.getByRole("button", { name: "Not listed?" }))
    fill(/^Name/, "Somerset")
    fill(/^Evidence link/, "https://example.org/somerset")
    fireEvent.click(screen.getByRole("button", { name: "Ask for this region" }))

    expect(
      (await screen.findByRole("status")).textContent?.includes(
        LOCATION_REQUEST_SENT
      )
    ).toBe(true)
    expect(latest).toMatchObject({
      proposedRegionName: "Somerset",
      proposedAreaName: "",
      locationRequestDocumentId: "req0000000000000000000001",
    })
  })

  it("isn't offered without the Index editor's new mode", () => {
    render(
      createElement(LocationHierarchySelector, {
        f: { ...EMPTY_FORM, countryDocumentId: COUNTRY },
        setFormData: () => {},
      })
    )
    expect(screen.queryByRole("button", { name: "Not listed?" })).toBeNull()
  })
})

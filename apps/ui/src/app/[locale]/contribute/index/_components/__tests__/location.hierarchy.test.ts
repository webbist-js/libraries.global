import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PlaceAddress } from "@/lib/geocode/place"

import { resolveHierarchy } from "../location.hierarchy"
import { EMPTY_FORM } from "../wizard.types"

const HAWORTH: PlaceAddress = {
  streetAddress: "Church Street",
  district: "Haworth and Stanbury",
  city: "Bradford",
  postalCode: "BD22 8DR",
  country: "United Kingdom",
  countryCode: "GB",
  state: "England",
  county: "West Yorkshire",
}

const ROUTES: Record<string, unknown[]> = {
  "/api/relations/countries?iso2=GB-ENG%2CGB": [
    {
      documentId: "eng",
      name: "England",
      iso2: "GB-ENG",
      continentDocumentId: "eu",
    },
  ],
  "/api/relations/regions?countryDocumentId=eng": [
    { documentId: "gl", name: "Greater London" },
    { documentId: "wy", name: "West Yorkshire" },
  ],
  "/api/relations/areas?regionDocumentId=wy": [
    { documentId: "brad", name: "Bradford" },
    { documentId: "leeds", name: "Leeds" },
  ],
}

const fetchMock = vi.fn(async (url: string) =>
  Response.json({ data: ROUTES[url] ?? [] })
)
const asked = () => fetchMock.mock.calls.map(([url]) => url)

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

describe("resolveHierarchy", () => {
  it("fills every level for an empty form", async () => {
    expect(await resolveHierarchy(EMPTY_FORM, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "wy",
      areaDocumentId: "brad",
      country: "England",
      proposedRegionName: "",
      proposedAreaName: "",
      locationRequestDocumentId: "",
    })
  })

  it("keeps a region already chosen in the same country", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "gl",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "gl",
      areaDocumentId: "",
      country: "England",
    })
    expect(asked()).not.toContain(
      "/api/relations/regions?countryDocumentId=eng"
    )
  })

  it("replaces another country, with its requested region or area", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "na",
      countryDocumentId: "us",
      regionDocumentId: "ca",
      proposedAreaName: "Sunnyvale",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toMatchObject({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "wy",
      areaDocumentId: "brad",
      proposedAreaName: "",
    })
  })

  it("leaves a requested region alone", async () => {
    const form = {
      ...EMPTY_FORM,
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      proposedRegionName: "Calderdale",
    }
    expect(await resolveHierarchy(form, HAWORTH)).toEqual({
      continentDocumentId: "eu",
      countryDocumentId: "eng",
      regionDocumentId: "",
      areaDocumentId: "",
      country: "England",
    })
    expect(asked()).not.toContain(
      "/api/relations/regions?countryDocumentId=eng"
    )
  })

  it("is null outside the atlas or without a country code", async () => {
    expect(
      await resolveHierarchy(EMPTY_FORM, {
        ...HAWORTH,
        countryCode: "JP",
        state: "Tokyo",
      })
    ).toBeNull()
    fetchMock.mockClear()
    expect(
      await resolveHierarchy(EMPTY_FORM, { ...HAWORTH, countryCode: "" })
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is null when the lookup fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    expect(await resolveHierarchy(EMPTY_FORM, HAWORTH)).toBeNull()
  })
})

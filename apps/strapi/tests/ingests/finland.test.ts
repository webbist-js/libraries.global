import { describe, expect, it, vi } from "vitest"

import { finlandFixture } from "./fixtures/finland"
import {
  buildGeography,
  observationFor,
} from "../../scripts/ingests/finland/kirjastot-fi/geography"
import { mapLibrary } from "../../scripts/ingests/finland/kirjastot-fi/map"
import { planPlaces } from "../../scripts/ingests/finland/kirjastot-fi/places"

describe("Finland geography and population", () => {
  it("partitions Finland and Åland without double counting, and keeps the boundary vintage", () => {
    const source = finlandFixture()
    const places = buildGeography(source)
    expect(places.find((place) => place.key === "FI")).toMatchObject({
      population: 1000,
      method: "sum_complete_children",
      coverage: { excludedCountryIso2: ["AX"] },
    })
    expect(places.find((place) => place.key === "AX")).toMatchObject({
      population: 100,
      method: "direct",
    })
    expect(places.find((place) => place.key === "AX:KU478")).toMatchObject({
      parent: "AX:SK211",
      name: "Mariehamn",
    })
    expect(
      observationFor(places.find((place) => place.key === "FI:MK19")!, source)
    ).toMatchObject({
      year: 2025,
      boundaryVersion: "statfin-20260101",
      population: 200,
      licence: "CC BY 4.0",
    })
  })

  it("rejects partial, duplicate, mismatched and non-reconciling population inputs", () => {
    const missing = finlandFixture()
    missing.population.value[1] = null
    expect(() => buildGeography(missing)).toThrow("population")
    const wrongYear = finlandFixture()
    wrongYear.year = 2024
    expect(() => buildGeography(wrongYear)).toThrow("year or measure")
    const partial = finlandFixture()
    partial.classifications[0].pop()
    expect(() => buildGeography(partial)).toThrow("coverage mismatch")
    const duplicate = finlandFixture()
    duplicate.classifications[0].push(duplicate.classifications[0][0])
    expect(() => buildGeography(duplicate)).toThrow("duplicate classification")
    const totals = finlandFixture()
    totals.population.value[0]++
    expect(() => buildGeography(totals)).toThrow("reconcile")
  })
})

describe("Kirjastot.fi mapping", () => {
  const places = buildGeography(finlandFixture())
  const row = {
    id: 123,
    name: "Helsingin yliopiston kirjasto",
    type: "university",
    city: 10,
    address: { street: "Unioninkatu 36", city: "Helsinki", zipcode: "00170" },
    coordinates: { lat: 60.17, lon: 24.95 },
    primaryContactInfo: {
      homepage: { url: "https://example.fi" },
      email: { email: "library@example.fi" },
      phone: { number: "+358 123" },
    },
  }
  it("preserves native names, uses stable IDs and does not infer permanent status from opening hours", () => {
    expect(
      mapLibrary(
        { ...row, liveStatus: 0 },
        { "10": { name: "Helsinki" } },
        places
      )
    ).toMatchObject({
      recordId: "123",
      areaKey: "FI:KU091",
      data: {
        name: row.name,
        slug: "helsingin-yliopiston-kirjasto-fi-123",
        libraryType: "University",
        operationalStatus: "unknown",
        website: "https://example.fi/",
        email: "library@example.fi",
        location: { lat: 60.17, lng: 24.95 },
        source: "kirjastot-fi",
      },
    })
  })
  it("uses bilingual official names to route Maarianhamina to Åland", () => {
    expect(
      mapLibrary(
        { ...row, city: 20 },
        { "20": { name: "Maarianhamina" } },
        places
      )
    ).toMatchObject({ areaKey: "AX:KU478" })
  })
  it("skips home delivery, flags missing mobile pins and refuses unresolved municipalities or types", () => {
    expect(
      mapLibrary({ ...row, type: "home_service" }, {}, places)
    ).toHaveProperty("reason")
    const mobile = mapLibrary(
      { ...row, type: "mobile", coordinates: null },
      { "10": { name: "Helsinki" } },
      places
    )
    expect(mobile).toMatchObject({
      data: { libraryType: "Mobile" },
      warnings: expect.arrayContaining([
        expect.stringContaining("no timetable"),
      ]),
    })
    expect(() =>
      mapLibrary(row, { "10": { name: "Unknown" } }, places)
    ).toThrow("matches 0 Areas")
    expect(() => mapLibrary({ ...row, type: "new_type" }, {}, places)).toThrow(
      "Unknown library type"
    )
  })
})

it("keeps legacy Rovaniemi subregion separate from the municipality and matches renamed places by code", async () => {
  const source = buildGeography(finlandFixture())
  const existing = {
    continents: [{ documentId: "eu", slug: "europe" }],
    countries: [
      {
        documentId: "fi",
        iso2: "FI",
        name: "Finland",
        slug: "finland",
        continent: { documentId: "eu" },
      },
      {
        documentId: "ax",
        iso2: "AX",
        name: "Åland",
        slug: "aland",
        continent: { documentId: "eu" },
      },
    ],
    regions: [
      {
        documentId: "lapland",
        name: "Contributor's name",
        slug: "lapland",
        country: { documentId: "fi" },
      },
    ],
    areas: [
      {
        documentId: "legacy",
        name: "Rovaniemi",
        slug: "rovaniemi",
        country: { documentId: "fi" },
        region: { documentId: "lapland" },
      },
    ],
  }
  const client = {
    findAll: vi.fn(async (collection, options) =>
      options.filters?.slug?.$in ? [] : existing[collection]
    ),
  }
  const plan = await planPlaces(
    client as never,
    source,
    new Map([["lapland", "MK19"]])
  )
  expect(
    plan.actions.find((action) => action.source.key === "FI:MK19")?.existing
      ?.documentId
  ).toBe("lapland")
  expect(
    plan.actions.find((action) => action.source.key === "FI:KU698")?.existing
  ).toBeUndefined()
  expect(plan.legacy).toContainEqual({
    collection: "areas",
    documentId: "legacy",
    name: "Rovaniemi",
  })
})

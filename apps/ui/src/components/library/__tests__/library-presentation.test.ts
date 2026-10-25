import { describe, expect, it } from "vitest"

import {
  hasLibraryAbout,
  libraryChecklist,
  libraryPresentation,
} from "@/components/library/library-presentation"
import type { LibraryAreaData } from "@/lib/strapi-api/content/library-area"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

const emptyArea: LibraryAreaData = {
  neighbours: [],
  regionTotal: 1,
  withinRadius: 0,
  sundays: null,
}
const library = (values: Record<string, unknown> = {}) =>
  ({
    documentId: "library",
    name: "Library",
    libraryType: "Public",
    country: { slug: "wales" },
    location: { lat: 52, lng: -3 },
    ...values,
  }) as unknown as PopulatedLibraryData

describe("library page presentation", () => {
  it("consolidates missing sections without treating an operator or catalogue link as an About section", () => {
    const record = library({
      operatorName: "Council",
      operatorType: "Municipality",
      catalogueUrl: "https://example.org/catalogue",
      amenities: [{ name: "Wi-Fi" }],
    })
    const result = libraryPresentation(record, emptyArea)
    expect(result.hasAbout).toBe(false)
    expect(result.hasNearby).toBe(false)
    expect(result.hasEvents).toBe(false)
    expect(result.missing).toEqual([
      "about",
      "events",
      "transport",
      "admission",
      "nearby",
    ])
    expect(result.unanswered).toBeGreaterThan(0)
    expect(result.checklist).toEqual(libraryChecklist(record))
  })
  it("shows fuller sections only when their own recorded data is available", () => {
    const result = libraryPresentation(
      library({
        summary: "Local collections.",
        hasActiveFeed: true,
        transitInfo: "Bus 2",
        admissionInfo: "Free entry",
        services: [{ name: "Book lending" }],
      }),
      { ...emptyArea, neighbours: [{ id: "other", name: "Other" } as never] }
    )
    expect(result).toMatchObject({
      hasAbout: true,
      hasEvents: true,
      hasServices: true,
      hasNearby: true,
      missing: [],
    })
  })
  it("keeps failed nearby reads distinct from an empty index result", () => {
    const result = libraryPresentation(library(), {
      ...emptyArea,
      neighboursUnavailable: true,
      withinRadius: null,
    })
    expect(result.hasNearby).toBe(true)
    expect(result.missing).not.toContain("nearby")
  })
  it("does not offer static travel reach for mobile or digital libraries", () => {
    for (const type of ["Mobile", "Digital"]) {
      const result = libraryPresentation(
        library({ libraryType: type }),
        emptyArea
      )
      expect(result.hasReach).toBe(false)
      expect(result.hasNearby).toBe(false)
      expect(result.missing).not.toContain("transport")
      expect(result.missing).not.toContain("nearby")
    }
  })
  it("preserves recorded absences and does not treat unanswered services as content", () => {
    const unknown = libraryPresentation(library(), emptyArea)
    const absent = libraryPresentation(
      library({ absentFacilities: ["Hearing loop", "Café"] }),
      emptyArea
    )
    expect(unknown.hasServices).toBe(false)
    expect(absent.hasServices).toBe(true)
    expect(absent.unanswered).toBe(unknown.unanswered - 1)
  })
  it("keeps empty text and unfinished figure entries out of the About section", () => {
    expect(
      hasLibraryAbout(
        library({
          summary: " ",
          buildingInfo: " ",
          description: [{ type: "paragraph", children: [{ text: "" }] }],
          collectionStats: [{ value: "" }],
          libraryStats: [{ value: "12", label: "" }],
        })
      )
    ).toBe(false)
  })
  it("recognises dates, descriptions and figures as About content", () => {
    for (const values of [
      { closedYear: "2020" },
      { libraryStats: [{ value: "20", label: "Members" }] },
      { description: [{ type: "paragraph", children: [{ text: "History" }] }] },
    ]) {
      expect(hasLibraryAbout(library(values))).toBe(true)
    }
  })
  it("offers Reach only for the supported UK countries with a map location", () => {
    for (const slug of [
      "england",
      "wales",
      "scotland",
      "northern-ireland",
      "united-kingdom",
    ])
      expect(
        libraryPresentation(library({ country: { slug } }), emptyArea).hasReach
      ).toBe(true)
    expect(
      libraryPresentation(library({ country: { slug: "spain" } }), emptyArea)
        .hasReach
    ).toBe(false)
    expect(
      libraryPresentation(library({ location: null }), emptyArea).hasReach
    ).toBe(false)
  })
})

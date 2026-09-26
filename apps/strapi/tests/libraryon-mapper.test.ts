import { describe, expect, it } from "vitest"

import {
  ACCESSIBILITY_TAXONOMY,
  AMENITY_TAXONOMY,
  SERVICE_TAXONOMY,
  mapLibraryOnRecord,
  type LibraryOnRecord,
} from "../scripts/field-mapper"

import fixtures from "./fixtures/libraryon-records.json"

const records = fixtures as unknown as Record<string, LibraryOnRecord>
const clone = (r: LibraryOnRecord): LibraryOnRecord => structuredClone(r)

describe("libraryOn mapper: status and operator", () => {
  it("maps a Local Authority Run library as open / Municipality", () => {
    const { data } = mapLibraryOnRecord(records.laRun)

    expect(data.operationalStatus).toBe("open")
    expect(data.operatorType).toBe("Municipality")
    expect(data.libraryType).toBe("Public")
  })

  it("does not rely on the private isOpen flag", () => {
    const r = clone(records.laRun)
    delete (r.attributes as Record<string, unknown>).isOpen

    expect(mapLibraryOnRecord(r).data.operationalStatus).toBe("open")
  })

  it("treats 'Facility Not Open' as an unknown operator, open when it has hours", () => {
    expect(mapLibraryOnRecord(records.notOpenWithHours).data).toMatchObject({
      operationalStatus: "open",
      operatorType: "Other",
    })
    expect(mapLibraryOnRecord(records.notOpenNoHours).data).toMatchObject({
      operationalStatus: "unknown",
      operatorType: "Other",
    })
  })

  it("maps closures", () => {
    expect(mapLibraryOnRecord(records.closed).data.operationalStatus).toBe(
      "permanently_closed"
    )
    expect(mapLibraryOnRecord(records.tempClosure).data.operationalStatus).toBe(
      "temporarily_closed"
    )
    expect(
      mapLibraryOnRecord(records.permClosedFlag).data.operationalStatus
    ).toBe("permanently_closed")
  })

  it("maps community-run libraries", () => {
    expect(mapLibraryOnRecord(records.communityRun).data.operatorType).toBe(
      "Community Managed"
    )
  })
})

describe("libraryOn mapper: location and geography", () => {
  it("reads [lng, lat] from geometry and swaps the order", () => {
    const r = records.laRun
    const [lng, lat] = (
      r.attributes.location as { geometry: { coordinates: number[] } }
    ).geometry.coordinates

    expect(mapLibraryOnRecord(r).data.location).toEqual({ lat, lng })
  })

  it("falls back to the Mapbox center when geometry is missing", () => {
    const r = clone(records.laRun)
    const loc = r.attributes.location as Record<string, unknown>
    delete loc.geometry
    loc.center = [-4.3, 55.8]

    expect(mapLibraryOnRecord(r).data.location).toEqual({
      lat: 55.8,
      lng: -4.3,
    })
  })

  it("uses the authority segment of the ref as the region", () => {
    const { meta } = mapLibraryOnRecord(records.laRun)

    expect(meta.countrySlug).toBe("scotland")
    expect(meta.regionSlug).toBe("glasgow-city")
    expect(meta.areaSlug).toBeNull()
  })

  it("does not invent an area when the Mapbox district disagrees with the ref", () => {
    const r = clone(records.laRun)
    const ctx = (
      r.attributes.location as { context: { id: string; text: string }[] }
    ).context
    ctx.push({ id: "district.123", text: "Somewhere Else" })

    const { meta } = mapLibraryOnRecord(r)
    expect(meta.regionSlug).toBe("glasgow-city")
    expect(meta.areaSlug).toBeNull()
  })

  it("puts London boroughs under greater-london as an area", () => {
    const r = clone(records.laRun)
    r.attributes.ref = "gb:eng:wandsworth:battersea-library"

    const { meta } = mapLibraryOnRecord(r)
    expect(meta.countrySlug).toBe("england")
    expect(meta.regionSlug).toBe("greater-london")
    expect(meta.areaSlug).toBe("wandsworth")
    expect(meta.areaName).toBe("Wandsworth")
  })
})

describe("libraryOn mapper: taxonomy and contact data", () => {
  it("maps every libraryOn accessibility slug to a taxonomy entry", () => {
    const r = clone(records.laRun)
    r.attributes.accessibility = [
      "hearing-loop-system",
      "accessible-restrooms",
      "service-dog-friendly",
      "guide-dog-friendly",
      "quiet-room",
    ]

    expect(mapLibraryOnRecord(r).meta.accessibilityNames).toEqual([
      "Hearing loop",
      "Accessible toilets",
      "Assistance dogs welcome",
      "Quiet room",
    ])
    for (const name of mapLibraryOnRecord(r).meta.accessibilityNames) {
      expect(ACCESSIBILITY_TAXONOMY.some((t) => t.name === name)).toBe(true)
    }
  })

  it("splits libraryOn services into amenities and services", () => {
    const r = clone(records.laRun)
    r.attributes.services = [
      { service: "Free Wi-Fi" },
      { service: "Computers" },
      { service: "Books" },
      { service: "Findmypast" },
      { service: null },
      { service: "Something new" },
    ]

    const { meta } = mapLibraryOnRecord(r)
    expect(meta.amenityNames).toEqual(["Wi-Fi", "Public computers"])
    expect(meta.serviceNames).toEqual(["Book lending", "Findmypast"])
    expect(meta.unmappedServices).toEqual(["Something new"])
    for (const n of meta.amenityNames)
      expect(AMENITY_TAXONOMY.some((t) => t.name === n)).toBe(true)
    for (const n of meta.serviceNames)
      expect(SERVICE_TAXONOMY.some((t) => t.name === n)).toBe(true)
  })

  it("maps social channels, renaming twitter to x", () => {
    expect(mapLibraryOnRecord(records.laRun).data.socialLinks).toEqual([
      {
        platform: "facebook",
        label: "GlasgowLibraries",
        url: "https://www.facebook.com/GlasgowLibraries/",
      },
      { platform: "x", label: "GlasgowLib", url: "https://x.com/GlasgowLib" },
    ])
  })

  it("drops invalid emails and trims names", () => {
    const { data } = mapLibraryOnRecord(records.badEmail)

    expect(data.email).toBeUndefined()
    expect(data.name).toBe("Fettercairn Library")
  })

  it("records provenance", () => {
    const { data } = mapLibraryOnRecord(records.laRun)

    expect(data.source).toBe("libraryon")
    expect(data.sourceUrl).toBe(
      "https://libraryon.org/libraries/glasgow-city/pollokshields-library"
    )
    expect(data.contentUpdatedAt).toBe(
      records.laRun.attributes.contentUpdatedAt
    )
  })

  it("produces opening times on 15-minute steps", () => {
    const { data } = mapLibraryOnRecord(records.laRun)
    const days = (
      data.openingTimes as { days: { timeframes: { startTime: string }[] }[] }
    ).days

    expect(days).toHaveLength(7)
    expect(days.flatMap((d) => d.timeframes).length).toBeGreaterThan(0)
  })
})

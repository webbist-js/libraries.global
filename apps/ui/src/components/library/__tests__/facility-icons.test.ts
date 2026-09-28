import { describe, expect, it } from "vitest"

import { facilityIcon, sameFacility } from "../facility-icons"

describe("facilityIcon", () => {
  it("uses the icon an editor chose in the CMS", () => {
    expect(
      facilityIcon("Hearing loop", "accessibility", "mdi:ear-hearing")
    ).toBe("mdi:ear-hearing")
  })

  it("ignores a CMS value that isn't an iconify name", () => {
    expect(facilityIcon("Wi-Fi", "amenity", "wifi")).toBe("mdi:wifi")
    expect(facilityIcon("Wi-Fi", "amenity", "")).toBe("mdi:wifi")
  })

  it.each([
    ["Accessible parking", "mdi:parking"],
    ["Wheelchair access", "mdi:wheelchair"],
    ["Step-free access", "mdi:wheelchair-accessibility"],
    ["Step-free entrance", "mdi:wheelchair-accessibility"],
    ["Assistive technology", "mdi:monitor-eye"],
    ["Assistance dogs welcome", "mdi:dog-service"],
    ["Book lending", "mdi:book-open-page-variant-outline"],
    ["Printing", "mdi:printer-outline"],
    ["Large-print materials", "mdi:format-size"],
    ["Accessible toilets", "mdi:toilet"],
    ["Hearing loop", "mdi:ear-hearing-loop"],
    ["Quiet study space", "mdi:volume-off"],
    ["Public computers", "mdi:desktop-classic"],
    ["Café", "mdi:coffee-outline"],
    ["Cafes & restaurant", "mdi:coffee-outline"],
    ["Baby changing facilities", "mdi:human-baby-changing-table"],
    ["Lift access", "mdi:elevator"],
    ["Braille signage", "mdi:braille"],
    ["Sign language interpretation", "mdi:sign-language"],
    ["Bike parking", "mdi:bike"],
    ["Accessible public transport", "mdi:bus"],
  ])("gives %s a matching icon", (name, icon) => {
    expect(facilityIcon(name, "accessibility")).toBe(icon)
  })

  it("falls back by kind when nothing matches", () => {
    expect(facilityIcon("Something new", "accessibility")).toBe("mdi:human")
    expect(facilityIcon("Something new", "service")).toBe(
      "mdi:room-service-outline"
    )
    expect(facilityIcon("Something new", "amenity")).toBe(
      "mdi:star-four-points-outline"
    )
  })
})

describe("sameFacility", () => {
  it("matches names in the same keyword group", () => {
    expect(sameFacility("Step-free entrance", "Step-free access")).toBe(true)
    expect(sameFacility("Café", "Cafes & restaurant")).toBe(true)
  })

  it("doesn't match different facilities, or two unmatched names", () => {
    expect(sameFacility("Wi-Fi", "Printing")).toBe(false)
    expect(sameFacility("Something new", "Another thing")).toBe(false)
  })
})

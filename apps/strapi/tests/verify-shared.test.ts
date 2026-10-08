import {
  isValidStamp,
  SECTION_FIELDS,
  sectionCheckedAt,
  VERIFY_SECTIONS,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

const MARCH = "2026-03-01T00:00:00.000Z"
const JANUARY = "2026-01-01T00:00:00.000Z"

describe("shared verification module", () => {
  it("names the four sections and the fields each covers", () => {
    expect(VERIFY_SECTIONS).toEqual(["hours", "status", "address", "contact"])
    expect(SECTION_FIELDS).toEqual({
      hours: ["openingTimes", "mobileTimetable"],
      status: ["operationalStatus"],
      address: ["streetAddress", "city", "postalCode", "district"],
      contact: ["website", "phone", "email"],
    })
  })

  it("accepts a stamp only when it's a string Date.parse reads", () => {
    expect(isValidStamp(MARCH)).toBe(true)
    expect(isValidStamp("5 October 2026")).toBe(true)
    expect(isValidStamp("junk")).toBe(false)
    expect(isValidStamp(new Date())).toBe(false)
    expect(isValidStamp(null)).toBe(false)
  })

  describe("sectionCheckedAt", () => {
    it("dates a section by its own stamp", () => {
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: MARCH, verifiedSections: { hours: JANUARY } },
          "hours"
        )
      ).toBe(JANUARY)
    })

    it("falls back to lastVerifiedAt when no section is stamped (legacy rows)", () => {
      expect(sectionCheckedAt({ lastVerifiedAt: MARCH }, "hours")).toBe(MARCH)
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: MARCH, verifiedSections: null },
          "status"
        )
      ).toBe(MARCH)
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: MARCH, verifiedSections: {} },
          "hours"
        )
      ).toBe(MARCH)
    })

    it("never borrows another section's date", () => {
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: MARCH, verifiedSections: { contact: MARCH } },
          "hours"
        )
      ).toBeNull()
    })

    it("treats invalid stamps as none, so the legacy fallback applies", () => {
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: MARCH, verifiedSections: { hours: "junk" } },
          "hours"
        )
      ).toBe(MARCH)
    })

    it("is null without a stamp or a valid lastVerifiedAt", () => {
      expect(sectionCheckedAt({}, "hours")).toBeNull()
      expect(sectionCheckedAt({ lastVerifiedAt: "junk" }, "hours")).toBeNull()
      expect(
        sectionCheckedAt(
          { lastVerifiedAt: null, verifiedSections: [] },
          "hours"
        )
      ).toBeNull()
    })
  })
})

import { describe, expect, it } from "vitest"

import {
  availableSections,
  sectionCheckedAt,
  sectionSummary,
  verifyPayload,
  verifyProblem,
  verifyProblemField,
} from "../verify.logic"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

describe("verify logic", () => {
  it("offers only sections the record has", () => {
    expect(
      availableSections({
        openingTimes: hours,
        operationalStatus: "open",
        phone: "1",
      })
    ).toEqual(["hours", "status", "contact"])
    expect(availableSections({ operationalStatus: "unknown" })).toEqual([])
    expect(
      availableSections({ streetAddress: "1 High St", email: "a@b.c" })
    ).toEqual(["address", "contact"])
  })

  it("needs a section and a source or an in-person check", () => {
    expect(verifyProblem({ sections: [], source: "", inPerson: false })).toBe(
      "Choose at least one section to confirm."
    )
    expect(
      verifyProblem({ sections: ["hours"], source: "", inPerson: false })
    ).toBe("Add the page you checked, or tick “I checked in person”.")
    expect(
      verifyProblem({
        sections: ["hours"],
        source: "not a url",
        inPerson: false,
      })
    ).toBe("The source must be a web address.")
    expect(
      verifyProblem({ sections: ["hours"], source: "", inPerson: true })
    ).toBeNull()
    expect(
      verifyProblem({
        sections: ["hours"],
        source: " https://lib.example ",
        inPerson: false,
      })
    ).toBeNull()
  })

  it("says which field a problem is about", () => {
    const hoursOnly = ["hours"] as const
    expect(
      verifyProblemField({ sections: [], source: "", inPerson: false })
    ).toBe("sections")
    expect(
      verifyProblemField({ sections: hoursOnly, source: "", inPerson: false })
    ).toBe("source")
    expect(
      verifyProblemField({
        sections: hoursOnly,
        source: "not a url",
        inPerson: true,
      })
    ).toBe("source")
    expect(
      verifyProblemField({ sections: hoursOnly, source: "", inPerson: true })
    ).toBeNull()
    expect(
      verifyProblemField({
        sections: hoursOnly,
        source: "https://lib.example",
        inPerson: false,
      })
    ).toBeNull()
  })

  it("builds the verify correction", () => {
    expect(
      verifyPayload({
        slug: "lib",
        name: "Library",
        sections: ["hours"],
        source: "https://lib.example/hours",
        inPerson: false,
      })
    ).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "lib",
      fields: {
        kind: "verify",
        sections: ["hours"],
        libraryName: "Library",
        sourceRecords: [
          {
            url: "https://lib.example/hours",
            role: "reference",
            fields: ["hours"],
          },
        ],
      },
      evidenceType: "other",
      evidenceUrl: "https://lib.example/hours",
    })
    expect(
      verifyPayload({
        slug: "lib",
        name: "Library",
        sections: ["status"],
        source: "",
        inPerson: true,
      })
    ).toMatchObject({ evidenceType: "on_site_visit" })
    expect(
      verifyPayload({
        slug: "lib",
        name: "Library",
        sections: ["status"],
        source: "",
        inPerson: true,
      })
    ).not.toHaveProperty("evidenceUrl")
  })

  it("sums up each section in a line", () => {
    const week = {
      days: ["monday", "tuesday", "wednesday"].map((day) => ({
        day,
        enabled: true,
        timeframes: [{ startTime: "09:00", endTime: "17:00" }],
      })),
    }
    expect(sectionSummary("hours", { openingTimes: hours })).toBe(
      "Mon 09:00–17:00"
    )
    expect(sectionSummary("hours", { openingTimes: week })).toBe(
      "Mon 09:00–17:00, Tue 09:00–17:00 …"
    )
    expect(
      sectionSummary("status", { operationalStatus: "temporarily_closed" })
    ).toBe("Temporarily closed")
    expect(
      sectionSummary("address", { streetAddress: "1 High St", city: "Bath" })
    ).toBe("1 High St, Bath")
    expect(
      sectionSummary("contact", {
        website: "https://www.lib.example/visit",
        phone: "01",
      })
    ).toBe("lib.example")
    expect(sectionSummary("contact", { phone: "01", email: "a@b.c" })).toBe(
      "01"
    )
  })

  it("dates a section by its own stamp, else the record's last check", () => {
    const record = {
      lastVerifiedAt: "2026-03-01T00:00:00.000Z",
      verifiedSections: { contact: "2026-03-01T00:00:00.000Z" },
    }
    expect(
      sectionCheckedAt(
        { ...record, verifiedSections: { hours: "2026-01-01T00:00:00.000Z" } },
        "hours"
      )
    ).toBe("2026-01-01T00:00:00.000Z")
    // A valid stamp exists (contact), but not for hours: no borrowing another
    // section's date, and no legacy fallback either.
    expect(sectionCheckedAt(record, "hours")).toBeNull()
    expect(sectionCheckedAt({}, "hours")).toBeNull()
    // verifiedSections missing entirely (null, not an object): legacy
    // fallback to lastVerifiedAt.
    expect(
      sectionCheckedAt(
        {
          lastVerifiedAt: "2026-03-01T00:00:00.000Z",
          verifiedSections: null,
        },
        "hours"
      )
    ).toBe("2026-03-01T00:00:00.000Z")
    // hours has its own valid stamp: use it.
    expect(
      sectionCheckedAt(
        { verifiedSections: { hours: "2026-01-01T00:00:00.000Z" } },
        "hours"
      )
    ).toBe("2026-01-01T00:00:00.000Z")
    // verifiedSections.hours isn't a valid date and nothing else is valid
    // either: that's the legacy case, so fall back to lastVerifiedAt.
    expect(
      sectionCheckedAt(
        {
          lastVerifiedAt: "2026-03-01T00:00:00.000Z",
          verifiedSections: { hours: "junk" },
        },
        "hours"
      )
    ).toBe("2026-03-01T00:00:00.000Z")
    // The shared rule: a lastVerifiedAt that isn't a date dates nothing.
    expect(sectionCheckedAt({ lastVerifiedAt: "junk" }, "hours")).toBeNull()
  })
})

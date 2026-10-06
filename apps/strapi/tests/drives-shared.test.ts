import {
  driveDateLabel,
  driveFilters,
  driveProgress,
  focusFilter,
  focusMatches,
  libraryInScope,
  scopeFilter,
  validateDrive,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

const OPENED = "2026-10-05T00:00:00.000Z"
const OPENED_TS = Date.parse(OPENED) / 1000

describe("scopeFilter", () => {
  it("joins places with OR and the rest with AND, excluding closed libraries", () => {
    expect(
      scopeFilter(
        {
          places: { region: ["ohio"], area: ["schuyler-county-ny"] },
          libraryTypes: ["Public"],
          source: "imls-pls",
          completenessBelow: 60,
        },
        { openedAt: OPENED }
      )
    ).toBe(
      `(region_slug IN ["ohio"] OR area_slug IN ["schuyler-county-ny"]) AND libraryType IN ["Public"] AND source = "imls-pls" AND completeness < 60 AND created_ts <= ${OPENED_TS} AND operationalStatus != "permanently_closed"`
    )
  })

  it("uses an explicit library list instead of places", () => {
    expect(
      scopeFilter({ libraries: ["a1", "b2"], places: { country: ["france"] } })
    ).toBe(
      `documentId IN ["a1", "b2"] AND operationalStatus != "permanently_closed"`
    )
  })
})

describe("focusFilter", () => {
  it("covers gaps, verification and whole records", () => {
    expect(focusFilter({ kind: "gaps", gaps: ["hours", "contact"] })).toBe(
      `needs IN ["hours", "contact"]`
    )
    expect(focusFilter({ kind: "record", target: 75 })).toBe(
      "completeness < 75"
    )
    expect(
      focusFilter({ kind: "verify", sections: ["hours"], before: OPENED })
    ).toBe(
      `((verified_hours_ts < ${OPENED_TS} OR verified_hours_ts NOT EXISTS))`
    )
  })

  it("gives the scope and the to-do filter together", () => {
    const f = driveFilters({
      scope: { places: { region: ["ohio"] } },
      focus: { kind: "gaps", gaps: ["hours"] },
    })
    expect(f.todo).toBe(`${f.scope} AND needs IN ["hours"]`)
  })
})

describe("libraryInScope", () => {
  const lib = {
    documentId: "lib1",
    country: "united-states",
    region: "ohio",
    area: "franklin-county-oh",
    libraryType: "Public",
    source: "imls-pls",
    completeness: 38,
    createdAt: "2026-10-01T00:00:00.000Z",
    operationalStatus: "open",
  }

  it("matches the same rules as scopeFilter", () => {
    expect(libraryInScope(lib, { places: { region: ["ohio"] } }, OPENED)).toBe(
      true
    )
    expect(libraryInScope(lib, { places: { region: ["texas"] } })).toBe(false)
    expect(
      libraryInScope(lib, {
        places: { country: ["united-states"] },
        libraryTypes: ["Academic"],
      })
    ).toBe(false)
    expect(
      libraryInScope(lib, { places: { region: ["ohio"] }, source: "other" })
    ).toBe(false)
    expect(
      libraryInScope(lib, {
        places: { region: ["ohio"] },
        completenessBelow: 30,
      })
    ).toBe(false)
    expect(
      libraryInScope(
        { ...lib, createdAt: "2026-10-06T00:00:00.000Z" },
        { places: { region: ["ohio"] } },
        OPENED
      )
    ).toBe(false)
    expect(
      libraryInScope(
        { ...lib, operationalStatus: "permanently_closed" },
        { places: { region: ["ohio"] } }
      )
    ).toBe(false)
    expect(libraryInScope(lib, { libraries: ["lib1"] })).toBe(true)
    expect(
      libraryInScope(lib, {
        libraries: ["other"],
        places: { region: ["ohio"] },
      })
    ).toBe(false)
  })
})

describe("focusMatches", () => {
  const hours = { kind: "gaps", gaps: ["hours"] } as const
  it("accepts work that fills the focus, or reports a closure", () => {
    expect(
      focusMatches(hours, {
        submissionType: "correction",
        fields: { kind: "record", openingTimes: {} },
      })
    ).toBe(true)
    expect(
      focusMatches(hours, {
        submissionType: "library_edit",
        fields: { openingTimes: {} },
      })
    ).toBe(true)
    expect(
      focusMatches(hours, {
        submissionType: "correction",
        fields: { kind: "record", operationalStatus: "permanently_closed" },
      })
    ).toBe(true)
    expect(
      focusMatches(hours, {
        submissionType: "correction",
        fields: { kind: "record", city: "York" },
      })
    ).toBe(false)
    expect(
      focusMatches(
        { kind: "gaps", gaps: ["photo"] },
        { submissionType: "correction", fields: { kind: "photo" } }
      )
    ).toBe(true)
    expect(
      focusMatches(
        { kind: "gaps", gaps: ["accessibility"] },
        {
          submissionType: "correction",
          fields: { kind: "facilities", answers: {} },
        }
      )
    ).toBe(true)
    expect(
      focusMatches(
        { kind: "gaps", gaps: ["contact"] },
        { submissionType: "correction", fields: { kind: "record", phone: "1" } }
      )
    ).toBe(true)
    expect(
      focusMatches(
        { kind: "verify", sections: ["hours"], before: OPENED },
        {
          submissionType: "correction",
          fields: { kind: "verify", sections: ["hours"] },
        }
      )
    ).toBe(true)
    expect(
      focusMatches(hours, { submissionType: "new_library", fields: {} })
    ).toBe(false)
  })
})

describe("validateDrive", () => {
  const ok = {
    title: "Ohio’s public libraries need opening hours",
    summary: "Branches imported from the IMLS survey arrived without hours.",
    steps: ["Open its website", "Enter the hours with a link"],
    focus: { kind: "gaps", gaps: ["hours"] },
    scope: { places: { region: ["ohio"] } },
    unit: "branch",
    startsAt: "2026-10-06T00:00:00.000Z",
    endsAt: "2026-10-31T00:00:00.000Z",
    goalPercent: 100,
    whereToLook: {
      name: "Library websites",
      url: "",
      licenceNote: "Facts from a library’s own site.",
    },
  } as const

  it("accepts a sound drive", () => {
    expect(validateDrive(ok as never, new Date(OPENED))).toEqual([])
  })

  it("names every problem", () => {
    const errs = validateDrive(
      {
        ...ok,
        title: "x",
        focus: { kind: "gaps", gaps: [] },
        scope: {},
        endsAt: "2027-03-01T00:00:00.000Z",
        goalPercent: 0,
      } as never,
      new Date(OPENED)
    )
    expect(errs).toEqual([
      "Give the drive a title of 3 to 120 characters.",
      "Choose one to three gaps to fill.",
      "Limit the drive to places or to a list of libraries.",
      "A drive can run for at most 90 days.",
      "Set a goal between 1% and 100%.",
    ])
  })

  it("rejects an unrecognised focus kind instead of crashing", () => {
    expect(
      validateDrive(
        { ...ok, focus: { kind: "something-else" } } as never,
        new Date(OPENED)
      )
    ).toContain("Choose what the drive is for.")
  })

  it("survives a missing focus or scope instead of throwing", () => {
    const withoutFocus = { ...ok } as Record<string, unknown>
    delete withoutFocus.focus
    expect(validateDrive(withoutFocus as never, new Date(OPENED))).toContain(
      "Choose what the drive is for."
    )

    const withoutScope = { ...ok } as Record<string, unknown>
    delete withoutScope.scope
    expect(validateDrive(withoutScope as never, new Date(OPENED))).toContain(
      "Limit the drive to places or to a list of libraries."
    )
  })

  it("names an unparseable start or end date", () => {
    expect(
      validateDrive(
        { ...ok, startsAt: "not-a-date" } as never,
        new Date(OPENED)
      )
    ).toContain("Give a valid start date.")
    expect(
      validateDrive({ ...ok, endsAt: "" } as never, new Date(OPENED))
    ).toContain("Give a valid end date.")
  })
})

describe("driveDateLabel", () => {
  const now = new Date("2026-10-05T12:00:00.000Z")
  it("follows the date rule", () => {
    expect(
      driveDateLabel(
        {
          status: "open",
          startsAt: OPENED,
          endsAt: "2026-10-31T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "Ends 31 Oct", tone: "plain" })
    expect(
      driveDateLabel(
        {
          status: "open",
          startsAt: OPENED,
          endsAt: "2026-10-15T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "10 days left", tone: "plain" })
    expect(
      driveDateLabel(
        {
          status: "open",
          startsAt: OPENED,
          endsAt: "2026-10-10T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "5 days left", tone: "warn" })
    expect(
      driveDateLabel(
        {
          status: "open",
          startsAt: OPENED,
          endsAt: "2026-10-06T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "1 day left", tone: "warn" })
    expect(
      driveDateLabel(
        {
          status: "scheduled",
          startsAt: "2026-10-20T00:00:00.000Z",
          endsAt: "2026-11-20T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "Opens 20 Oct", tone: "plain" })
    expect(
      driveDateLabel(
        {
          status: "closed",
          startsAt: OPENED,
          endsAt: "2026-10-31T00:00:00.000Z",
          closedAt: "2026-09-12T00:00:00.000Z",
        },
        now
      )
    ).toEqual({ text: "Closed 12 Sep", tone: "plain" })
  })
})

describe("driveProgress", () => {
  it("counts coverage and the goal", () => {
    expect(driveProgress({ total: 251, todo: 109, inReview: 9 }, 100)).toEqual({
      total: 251,
      done: 142,
      todo: 109,
      inReview: 9,
      percent: 57,
      goalMet: false,
    })
    expect(
      driveProgress({ total: 10, todo: 1, inReview: 0 }, 90)
    ).toMatchObject({ percent: 90, goalMet: true })
    expect(
      driveProgress({ total: 0, todo: 0, inReview: 0 }, 100)
    ).toMatchObject({ percent: 0, goalMet: false })
  })
})

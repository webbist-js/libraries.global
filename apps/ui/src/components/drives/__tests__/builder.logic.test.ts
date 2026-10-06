import { validateDrive } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import type { Drive } from "@/lib/drives/types"

import {
  type BuilderState,
  builderErrors,
  builderStateFromDrive,
  countsLine,
  emptyBuilderState,
  errorsFromResponse,
  fieldId,
  fieldOfMessage,
  isTooBig,
  parseLibraryList,
  previewRequest,
  textOnlyInput,
  toDriveInput,
} from "../builder.logic"

const NOW = new Date("2026-10-06T10:30:00Z")
const ID_A = "i4ufvks2vsdq2qctu74bwq6p"
const ID_B = "mhlkts1bdddmmvm2pmn3euki"

/** A state that passes every rule: Vermont public libraries' hours. */
const valid = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...emptyBuilderState(NOW),
  gaps: ["hours"],
  places: [{ level: "region", slug: "vermont", name: "Vermont" }],
  libraryTypes: ["Public"],
  title: "Opening hours for *Vermont*",
  summary: "Add opening hours to every public library in Vermont.",
  steps: ["Open the library's own website.", "Copy the weekly hours."],
  whereName: "Each library's own website",
  whereUrl: "https://libraries.vermont.gov/",
  whereLicence: "Facts from a library's own site are fine to use.",
  ...over,
})

describe("emptyBuilderState", () => {
  it("starts today (UTC) and runs 30 days, aiming for 100%", () => {
    const s = emptyBuilderState(NOW)
    expect(s.startsOn).toBe("2026-10-06")
    expect(s.endsOn).toBe("2026-11-04")
    expect(s.goalPercent).toBe("100")
    expect(s.unit).toBe("library")
    expect(s.steps).toEqual([""])
    expect(s.gaps).toEqual([])
  })
})

describe("parseLibraryList", () => {
  it("reads one ref per line, trimming, lower-casing and dropping blanks and repeats", () => {
    const list = parseLibraryList(
      `  Montour-Falls-Memorial-Library-NY \n\n${ID_A}\nmontour-falls-memorial-library-ny\n`
    )
    expect(list.refs).toEqual(["montour-falls-memorial-library-ny", ID_A])
    expect(list.slugs).toEqual(["montour-falls-memorial-library-ny"])
    expect(list.documentIds).toEqual([ID_A])
    expect(list.invalid).toEqual([])
    expect(list.overLimit).toBe(false)
  })

  it("takes the last path segment of a pasted library link", () => {
    const list = parseLibraryList(
      "https://libraries.global/north-america/united-states/vermont/brooks-memorial-library/?tab=hours#hours\n/north-america/united-states/vermont/aldrich-public-library"
    )
    expect(list.refs).toEqual([
      "brooks-memorial-library",
      "aldrich-public-library",
    ])
  })

  it("accepts commas and spaces between refs too", () => {
    expect(parseLibraryList(`${ID_A}, ${ID_B} kellogg-hubbard`).refs).toEqual([
      ID_A,
      ID_B,
      "kellogg-hubbard",
    ])
  })

  it("keeps lines that are neither a slug nor a documentId apart", () => {
    const list = parseLibraryList("good-slug\nnot_a slug!\n<b>\nnot_a")
    expect(list.refs).toEqual(["good-slug"])
    expect(list.invalid).toEqual(["not_a", "slug!", "<b>"])
  })

  it("flags a list over 500", () => {
    const text = Array.from({ length: 501 }, (_, i) => `library-${i}`).join(
      "\n"
    )
    const list = parseLibraryList(text)
    expect(list.refs).toHaveLength(501)
    expect(list.overLimit).toBe(true)
    expect(
      parseLibraryList(text.split("\n").slice(0, 500).join("\n")).overLimit
    ).toBe(false)
  })

  it("is empty for blank text", () => {
    expect(parseLibraryList("  \n ").refs).toEqual([])
  })
})

describe("toDriveInput", () => {
  it("maps the builder to a DriveInput that validateDrive accepts", () => {
    const input = toDriveInput(valid())
    expect(input).toEqual({
      title: "Opening hours for *Vermont*",
      summary: "Add opening hours to every public library in Vermont.",
      steps: ["Open the library's own website.", "Copy the weekly hours."],
      focus: { kind: "gaps", gaps: ["hours"] },
      scope: { places: { region: ["vermont"] }, libraryTypes: ["Public"] },
      unit: "library",
      startsAt: "2026-10-06T00:00:00.000Z",
      endsAt: "2026-11-04T23:59:59.000Z",
      goalPercent: 100,
      whereToLook: {
        name: "Each library's own website",
        url: "https://libraries.vermont.gov/",
        licenceNote: "Facts from a library's own site are fine to use.",
      },
    })
    expect(validateDrive(input, NOW)).toEqual([])
  })

  it("groups places by level, broadest first, without repeats", () => {
    const input = toDriveInput(
      valid({
        places: [
          { level: "area", slug: "chittenden", name: "Chittenden" },
          { level: "region", slug: "vermont", name: "Vermont" },
          { level: "region", slug: "maine", name: "Maine" },
          { level: "region", slug: "vermont", name: "Vermont" },
        ],
      })
    )
    expect(Object.keys(input.scope.places ?? {})).toEqual(["region", "area"])
    expect(input.scope.places).toEqual({
      region: ["vermont", "maine"],
      area: ["chittenden"],
    })
  })

  it("lets a pasted list replace the places", () => {
    const input = toDriveInput(valid({ libraryList: `${ID_A}\n${ID_B}` }))
    expect(input.scope).toEqual({
      libraries: [ID_A, ID_B],
      libraryTypes: ["Public"],
    })
  })

  it("uses resolved documentIds for the list when it has them", () => {
    const input = toDriveInput(valid({ libraryList: "some-slug" }), {
      libraries: [ID_A],
    })
    expect(input.scope.libraries).toEqual([ID_A])
  })

  it("adds the dataset and completeness ceiling only when set", () => {
    expect(toDriveInput(valid()).scope).not.toHaveProperty("source")
    expect(toDriveInput(valid()).scope).not.toHaveProperty("completenessBelow")
    const scope = toDriveInput(
      valid({
        source: "  imls-pls ",
        completenessBelow: "40",
        libraryTypes: [],
      })
    ).scope
    expect(scope).toEqual({
      places: { region: ["vermont"] },
      source: "imls-pls",
      completenessBelow: 40,
    })
  })

  it("drops blank steps and trims the words", () => {
    const input = toDriveInput(
      valid({ title: "  Vermont hours  ", steps: [" One ", "", "  "] })
    )
    expect(input.title).toBe("Vermont hours")
    expect(input.steps).toEqual(["One"])
  })

  it("reads a goal that isn't a whole number as 0, so the goal rule refuses it", () => {
    expect(toDriveInput(valid({ goalPercent: "abc" })).goalPercent).toBe(0)
    expect(toDriveInput(valid({ goalPercent: "90" })).goalPercent).toBe(90)
  })

  it("leaves a missing date empty, so the date rule refuses it", () => {
    const input = toDriveInput(valid({ startsOn: "" }))
    expect(input.startsAt).toBe("")
    expect(validateDrive(input, NOW)).toContain("Give a valid start date.")
  })
})

describe("textOnlyInput", () => {
  it("keeps only what an open drive may still change", () => {
    expect(Object.keys(textOnlyInput(toDriveInput(valid()))).sort()).toEqual([
      "steps",
      "summary",
      "title",
      "whereToLook",
    ])
  })
})

describe("builderErrors", () => {
  it("is empty for a valid drive", () => {
    expect(builderErrors(valid(), NOW)).toEqual([])
  })

  it("links every validateDrive message to its field, in form order", () => {
    const errors = builderErrors(
      valid({
        gaps: [],
        places: [],
        title: "x",
        summary: "",
        steps: [""],
        endsOn: "2026-10-01",
        goalPercent: "0",
        whereUrl: "ftp://example.org",
      }),
      NOW
    )
    expect(errors.map((e) => e.field)).toEqual([
      "focus",
      "places",
      "whereUrl",
      "title",
      "summary",
      "steps",
      "endsOn",
      "goalPercent",
    ])
    expect(errors[0]?.message).toBe("Choose one to three gaps to fill.")
    expect(errors.find((e) => e.field === "endsOn")?.message).toBe(
      "The drive must end after it starts."
    )
  })

  it("refuses a run longer than 90 days", () => {
    expect(builderErrors(valid({ endsOn: "2027-01-05" }), NOW)).toEqual([
      { field: "endsOn", message: "A drive can run for at most 90 days." },
    ])
    // 90 days, counting both ends.
    expect(builderErrors(valid({ endsOn: "2027-01-03" }), NOW)).toEqual([])
  })

  it("checks the completeness ceiling", () => {
    expect(builderErrors(valid({ completenessBelow: "101" }), NOW)).toEqual([
      {
        field: "completenessBelow",
        message: "Give a completeness between 1% and 100%.",
      },
    ])
    expect(
      builderErrors(valid({ completenessBelow: "4.5" }), NOW)
    ).toHaveLength(1)
  })

  it("refuses a list over 500 and lines that aren't libraries", () => {
    const long = Array.from({ length: 501 }, (_, i) => `l-${i}`).join("\n")
    expect(builderErrors(valid({ libraryList: long }), NOW)).toEqual([
      { field: "libraries", message: "A list can hold at most 500 libraries." },
    ])
    expect(
      builderErrors(valid({ libraryList: "ok-slug\nnot_ok" }), NOW)
    ).toEqual([
      {
        field: "libraries",
        message: "These lines aren’t library slugs or documentIds: not_ok.",
      },
    ])
  })

  it("names libraries the preview couldn't find", () => {
    expect(
      builderErrors(valid({ libraryList: "gone-library" }), NOW, {
        unknownLibraries: ["gone-library"],
      })
    ).toEqual([
      {
        field: "libraries",
        message: "These libraries weren’t found: gone-library.",
      },
    ])
  })

  it("runs the content-safety matcher on the words", () => {
    const errors = builderErrors(
      valid({ summary: "Find the fucking hours for every library." }),
      NOW
    )
    expect(errors).toEqual([
      {
        field: "summary",
        message: "Please remove the offensive language before sending.",
      },
    ])
  })

  it("checks the source link against the link rules", () => {
    expect(
      builderErrors(valid({ whereUrl: "https://bit.ly/abc" }), NOW)
    ).toEqual([
      {
        field: "whereUrl",
        message: "Please use the full link rather than a shortened one.",
      },
    ])
  })
})

describe("fieldOfMessage and errorsFromResponse", () => {
  it("maps Strapi's messages back to fields, and unknown ones to none", () => {
    expect(fieldOfMessage("Give a valid end date.")).toBe("endsOn")
    expect(fieldOfMessage("A list can hold at most 500 libraries.")).toBe(
      "libraries"
    )
    expect(fieldOfMessage("Six drives are already pinned.")).toBeNull()
  })

  it("reads error.details.errors, else the message", () => {
    expect(
      errorsFromResponse({
        data: null,
        error: {
          status: 400,
          message: "Invalid drive",
          details: { errors: ["Write a summary of 10 to 280 characters."] },
        },
      })
    ).toEqual([
      { field: "summary", message: "Write a summary of 10 to 280 characters." },
    ])
    expect(
      errorsFromResponse({
        error: { status: 409, message: "Six drives are already pinned." },
      })
    ).toEqual([{ field: null, message: "Six drives are already pinned." }])
    expect(errorsFromResponse({ error: "Forbidden" })).toEqual([
      { field: null, message: "Forbidden" },
    ])
    expect(errorsFromResponse(null)).toEqual([
      { field: null, message: "The drive couldn’t be saved. Try again." },
    ])
  })

  it("gives each field a stable anchor id", () => {
    expect(fieldId("endsOn")).toBe("drive-endsOn")
  })
})

describe("previewRequest", () => {
  it("is the scope and focus once there's a gap and somewhere to look", () => {
    expect(previewRequest(valid())).toEqual({
      scope: { places: { region: ["vermont"] }, libraryTypes: ["Public"] },
      focus: { kind: "gaps", gaps: ["hours"] },
    })
  })

  it("is null with no gap, no place or list, or a bad ceiling or list", () => {
    expect(previewRequest(valid({ gaps: [] }))).toBeNull()
    expect(previewRequest(valid({ places: [] }))).toBeNull()
    expect(previewRequest(valid({ completenessBelow: "abc" }))).toBeNull()
    expect(previewRequest(valid({ libraryList: "bad_line" }))).toBeNull()
  })

  it("sends a pasted list as it was typed: the server resolves slugs", () => {
    expect(
      previewRequest(valid({ places: [], libraryList: `a-slug\n${ID_A}` }))
        ?.scope
    ).toEqual({ libraries: ["a-slug", ID_A], libraryTypes: ["Public"] })
  })
})

describe("countsLine and isTooBig", () => {
  it("reads the live counts", () => {
    expect(countsLine({ total: 2510, todo: 109 })).toBe(
      "2,510 in scope, 109 to do"
    )
  })

  it("is too big past 2,000 to do", () => {
    expect(isTooBig({ total: 5000, todo: 2000 })).toBe(false)
    expect(isTooBig({ total: 5000, todo: 2001 })).toBe(true)
  })
})

describe("builderStateFromDrive", () => {
  const drive = {
    documentId: "drv00000000000000000001",
    slug: "vermont-hours",
    title: "Opening hours for *Vermont*",
    summary: "Add opening hours to every public library in Vermont.",
    steps: [{ id: 1, text: "Open the website." }],
    focus: { kind: "gaps", gaps: ["hours", "contact"] },
    scope: {
      places: { country: ["united-states"], region: ["vermont"] },
      libraryTypes: ["Public"],
      source: "imls-pls",
      completenessBelow: 60,
    },
    unit: "branch",
    startsAt: "2026-10-06T00:00:00.000Z",
    endsAt: "2026-11-04T23:59:59.000Z",
    goalPercent: 90,
    whereToLook: { name: "Sites", url: "https://x.org", licenceNote: null },
    status: "scheduled",
  } as unknown as Drive

  it("fills the builder from a saved drive, naming places it knows", () => {
    const s = builderStateFromDrive(
      drive,
      new Map([["region:vermont", "Vermont"]])
    )
    expect(s).toMatchObject({
      gaps: ["hours", "contact"],
      places: [
        { level: "country", slug: "united-states", name: "United States" },
        { level: "region", slug: "vermont", name: "Vermont" },
      ],
      libraryTypes: ["Public"],
      source: "imls-pls",
      completenessBelow: "60",
      libraryList: "",
      steps: ["Open the website."],
      startsOn: "2026-10-06",
      endsOn: "2026-11-04",
      goalPercent: "90",
      unit: "branch",
      whereName: "Sites",
      whereUrl: "https://x.org",
      whereLicence: "",
    })
  })

  it("round-trips through toDriveInput", () => {
    const input = toDriveInput(builderStateFromDrive(drive))
    expect(input.scope).toEqual(drive.scope)
    expect(input.focus).toEqual(drive.focus)
    expect(input.startsAt).toBe(drive.startsAt)
    expect(input.endsAt).toBe(drive.endsAt)
  })

  it("shows an explicit list one per line", () => {
    const s = builderStateFromDrive({
      ...drive,
      scope: { libraries: [ID_A, ID_B] },
    } as Drive)
    expect(s.libraryList).toBe(`${ID_A}\n${ID_B}`)
    expect(s.places).toEqual([])
  })
})

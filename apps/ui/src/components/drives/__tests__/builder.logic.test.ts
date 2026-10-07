import { validateDrive } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import type { Drive } from "@/lib/drives/types"

import {
  type BuilderState,
  builderErrors,
  builderStateFromDrive,
  CLEAN_WORDS,
  countsLine,
  DEFAULT_DRIVE_DAYS,
  dirtyOf,
  draftStorageKey,
  draftWords,
  emptyBuilderState,
  endsOnFor,
  errorsFromResponse,
  fieldId,
  fieldOfMessage,
  GOAL_CHOICES,
  goalCount,
  isTooBig,
  parseLibraryList,
  parseSavedDraft,
  previewDriveView,
  previewPlaceLine,
  previewRequest,
  RUN_CHOICES,
  runDaysOf,
  serializeDraft,
  stepsDone,
  textOnlyInput,
  toDriveInput,
  WEBSITE_SOURCE,
  whereFieldsFor,
  whereKindOf,
  withDraftedWords,
  withStartsOn,
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
  it("starts today (UTC) and runs 4 weeks, aiming for all of them", () => {
    const s = emptyBuilderState(NOW)
    expect(s.startsOn).toBe("2026-10-06")
    expect(s.endsOn).toBe("2026-11-02")
    expect(runDaysOf(s)).toBe(DEFAULT_DRIVE_DAYS)
    expect(DEFAULT_DRIVE_DAYS).toBe(28)
    expect(s.goalPercent).toBe("100")
    expect(s.unit).toBe("library")
    expect(s.steps).toEqual([""])
    expect(s.gaps).toEqual([])
  })

  it("sends helpers to each library's own website, with no link", () => {
    const s = emptyBuilderState(NOW)
    expect(s.whereKind).toBe("website")
    expect(toDriveInput(s).whereToLook).toEqual({
      name: WEBSITE_SOURCE,
      url: "",
      licenceNote: "",
    })
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
      endsAt: "2026-11-02T23:59:59.000Z",
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

  it("counts the scope alone while no gap is chosen, for the gap chips", () => {
    expect(previewRequest(valid({ gaps: [] }))).toEqual({
      scope: { places: { region: ["vermont"] }, libraryTypes: ["Public"] },
      focus: { kind: "gaps", gaps: [] },
    })
  })

  it("is null with no place or list, an unfinished focus, or a bad ceiling or list", () => {
    expect(previewRequest(valid({ places: [] }))).toBeNull()
    expect(
      previewRequest(valid({ focusKind: "verify", verifySections: [] }))
    ).toBeNull()
    expect(
      previewRequest(valid({ focusKind: "record", recordTarget: "40" }))
    ).toBeNull()
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
    expect(isTooBig({ todo: 2000 })).toBe(false)
    expect(isTooBig({ todo: 2001 })).toBe(true)
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

// ── The v2 builder: drafted words, runs for, goal, where, steps, drafts ──────

const EALING = { level: "area" as const, slug: "ealing", name: "Ealing" }
const CAMDEN = { level: "area" as const, slug: "camden", name: "Camden" }
const CROYDON = { level: "area" as const, slug: "croydon", name: "Croydon" }
const BROMLEY = { level: "area" as const, slug: "bromley", name: "Bromley" }
const HACKNEY = { level: "area" as const, slug: "hackney", name: "Hackney" }

/** A new proposal's form with only its choices made: no words yet. */
const chosen = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...emptyBuilderState(NOW),
  gaps: ["hours"],
  places: [EALING, CAMDEN, CROYDON],
  ...over,
})

describe("draftWords", () => {
  it("drafts a one-gap drive as the mockup: italic gap, places, three steps", () => {
    expect(draftWords(chosen())).toEqual({
      title: "*Opening hours* for Ealing, Camden and Croydon",
      summary:
        "Help us add opening hours for libraries in Ealing, Camden and Croydon. Each task takes a few minutes.",
      steps: [
        "Open a library from the list",
        "Find the details on the library’s own website",
        "Add them with the source link",
      ],
    })
  })

  it("joins several gaps with 'and', in the order chosen, with their phrases", () => {
    const words = draftWords(
      chosen({ gaps: ["photo", "accessibility"], places: [EALING] })
    )
    expect(words.title).toBe("*Photos and accessibility* for Ealing")
    expect(words.summary).toBe(
      "Help us add photos and accessibility details for libraries in Ealing. Each task takes a few minutes."
    )
    expect(
      draftWords(chosen({ gaps: ["hours", "photo", "contact"] })).summary
    ).toContain(
      "add opening hours, photos and contact details for libraries in"
    )
  })

  it("drafts a confirm-details drive from its sections, in the shared order", () => {
    const words = draftWords(
      chosen({
        focusKind: "verify",
        verifySections: ["status", "hours"],
        places: [CAMDEN],
      })
    )
    expect(words.title).toBe(
      "Still right? *Opening hours and open or closed* in Camden"
    )
    expect(words.summary).toBe(
      "Help us confirm opening hours and open or closed are still right for libraries in Camden. Check the library’s website and mark what you checked."
    )
    expect(words.steps).toEqual([
      "Open a library from the list",
      "Check its website for the details",
      "Mark what you confirmed, with the link",
    ])
  })

  it("drafts a complete-records drive with its target", () => {
    const words = draftWords(
      chosen({ focusKind: "record", recordTarget: "90", places: [CROYDON] })
    )
    expect(words.title).toBe("Complete the records for Croydon")
    expect(words.summary).toBe(
      "Help us bring every library in Croydon to 90% complete. Each task fills what’s missing."
    )
    expect(words.steps).toEqual([
      "Open a library from the list",
      "Fill in whatever the checklist shows",
      "Save with a source link",
    ])
  })

  it("names up to three places, then two and a count", () => {
    expect(draftWords(chosen({ places: [EALING] })).title).toBe(
      "*Opening hours* for Ealing"
    )
    expect(draftWords(chosen({ places: [EALING, CAMDEN] })).title).toBe(
      "*Opening hours* for Ealing and Camden"
    )
    expect(
      draftWords(
        chosen({ places: [EALING, CAMDEN, CROYDON, BROMLEY, HACKNEY] })
      ).title
    ).toBe("*Opening hours* for Ealing, Camden and 3 more places")
  })

  it("says 'your chosen places' before any place, and counts a pasted list", () => {
    expect(draftWords(chosen({ places: [] })).title).toBe(
      "*Opening hours* for your chosen places"
    )
    const listed = draftWords(
      chosen({ libraryList: `${ID_A}\n${ID_B}\nsome-library` })
    )
    expect(listed.title).toBe("*Opening hours* for 3 libraries")
    expect(listed.summary).toBe(
      "Help us add opening hours for these 3 libraries. Each task takes a few minutes."
    )
    expect(
      draftWords(chosen({ focusKind: "record", libraryList: ID_A })).summary
    ).toBe(
      "Help us bring each of these 1 library to 75% complete. Each task fills what’s missing."
    )
  })

  it("names fewer places when the title would pass 120 characters", () => {
    const long = (slug: string) => ({
      level: "region" as const,
      slug,
      name: `The Very Long Metropolitan Borough of ${slug}`,
    })
    const words = draftWords(
      chosen({ places: [long("a"), long("b"), long("c")] })
    )
    expect(words.title.length).toBeLessThanOrEqual(120)
    expect(words.title).toBe(
      "*Opening hours* for The Very Long Metropolitan Borough of a and 2 more places"
    )
    expect(words.summary.length).toBeLessThanOrEqual(280)
  })

  it("always drafts words validateDrive accepts once there's a gap and a place", () => {
    const state = withDraftedWords(chosen(), CLEAN_WORDS)
    expect(builderErrors(state, NOW)).toEqual([])
  })
})

describe("dirty tracking", () => {
  it("treats words already there as hand-written, and blanks as draftable", () => {
    expect(dirtyOf(emptyBuilderState(NOW))).toEqual(CLEAN_WORDS)
    expect(dirtyOf(valid())).toEqual({
      title: true,
      summary: true,
      steps: true,
    })
    expect(dirtyOf({ title: " ", summary: "", steps: ["", " "] })).toEqual(
      CLEAN_WORDS
    )
  })

  it("redrafts only the fields not written by hand", () => {
    const state = chosen({
      title: "My own title",
      summary: "old",
      steps: ["old"],
    })
    const next = withDraftedWords(state, {
      title: true,
      summary: false,
      steps: false,
    })
    expect(next.title).toBe("My own title")
    expect(next.summary).toContain("Ealing, Camden and Croydon")
    expect(next.steps).toHaveLength(3)
  })

  it("follows the choices while clean, and stops once a field is edited", () => {
    let dirty = CLEAN_WORDS
    let state = withDraftedWords(chosen({ places: [EALING] }), dirty)
    expect(state.title).toBe("*Opening hours* for Ealing")

    state = withDraftedWords({ ...state, places: [EALING, CAMDEN] }, dirty)
    expect(state.title).toBe("*Opening hours* for Ealing and Camden")

    dirty = { ...dirty, title: true }
    state = withDraftedWords(
      { ...state, title: "Hours in *west London*" },
      dirty
    )
    state = withDraftedWords({ ...state, places: [CROYDON] }, dirty)
    expect(state.title).toBe("Hours in *west London*")
    expect(state.summary).toContain("libraries in Croydon")
  })

  it("leaves a fully hand-written state alone", () => {
    const state = valid()
    expect(
      withDraftedWords(state, { title: true, summary: true, steps: true })
    ).toBe(state)
  })

  it("redrafts everything after 'Redraft from my choices' (all clean)", () => {
    const state = withDraftedWords(valid({ places: [EALING] }), CLEAN_WORDS)
    expect(state.title).toBe("*Opening hours* for Ealing")
    expect(state.steps[0]).toBe("Open a library from the list")
  })
})

describe("runs for", () => {
  it("offers 2 weeks, 4 weeks, 60 and 90 days", () => {
    expect(RUN_CHOICES.map((c) => [c.label, c.days])).toEqual([
      ["2 weeks", 14],
      ["4 weeks", 28],
      ["60 days", 60],
      ["90 days", 90],
    ])
  })

  it("sets the last day as the start plus the days, less one", () => {
    expect(endsOnFor("2026-10-13", 28)).toBe("2026-11-09")
    expect(endsOnFor("2026-10-13", 14)).toBe("2026-10-26")
    expect(endsOnFor("2026-12-20", 14)).toBe("2027-01-02")
    expect(endsOnFor("", 14)).toBe("")
    expect(endsOnFor("13/10/2026", 14)).toBe("")
  })

  it("reads how long a drive runs, counting both ends", () => {
    expect(runDaysOf({ startsOn: "2026-10-13", endsOn: "2026-11-09" })).toBe(28)
    expect(runDaysOf({ startsOn: "2026-10-13", endsOn: "2026-10-13" })).toBe(1)
    expect(runDaysOf({ startsOn: "2026-10-13", endsOn: "2026-10-12" })).toBe(
      null
    )
    expect(runDaysOf({ startsOn: "", endsOn: "2026-10-12" })).toBe(null)
  })

  it("keeps the length when the start moves, and 4 weeks when it can't be read", () => {
    expect(
      withStartsOn(
        { startsOn: "2026-10-13", endsOn: "2026-10-26" },
        "2026-11-01"
      )
    ).toEqual({ startsOn: "2026-11-01", endsOn: "2026-11-14" })
    expect(withStartsOn({ startsOn: "", endsOn: "" }, "2026-11-01")).toEqual({
      startsOn: "2026-11-01",
      endsOn: "2026-11-28",
    })
  })

  it("every pill gives a drive validateDrive accepts, 90 days included", () => {
    for (const { days } of RUN_CHOICES) {
      const s = valid({
        startsOn: "2026-10-13",
        endsOn: endsOnFor("2026-10-13", days),
      })
      expect(builderErrors(s, NOW)).toEqual([])
    }
  })
})

describe("goal", () => {
  it("offers 50%, 75% and all of them, which send that percent", () => {
    expect(GOAL_CHOICES.map((g) => g.label)).toEqual([
      "50%",
      "75%",
      "All of them",
    ])
    expect(
      GOAL_CHOICES.map(
        (g) =>
          toDriveInput(valid({ goalPercent: String(g.percent) })).goalPercent
      )
    ).toEqual([50, 75, 100])
  })

  it("counts how many of the to-do meet the goal, counting libraries already done", () => {
    expect(goalCount({ total: 40, todo: 40 }, 100)).toBe(40)
    expect(goalCount({ total: 40, todo: 40 }, 75)).toBe(30)
    expect(goalCount({ total: 40, todo: 40 }, 50)).toBe(20)
    // 30 of 40 are already done: 75% needs 30, so it's met before it opens.
    expect(goalCount({ total: 40, todo: 10 }, 75)).toBe(0)
    expect(goalCount({ total: 33, todo: 1 }, 100)).toBe(1)
    expect(goalCount({ total: 3, todo: 3 }, 50)).toBe(2)
  })
})

describe("where to look", () => {
  it("reads a saved source as the website choice or another source", () => {
    expect(whereKindOf({})).toBe("website")
    expect(whereKindOf({ name: WEBSITE_SOURCE })).toBe("website")
    expect(whereKindOf({ name: "Each library's own website" })).toBe("website")
    expect(whereKindOf({ name: WEBSITE_SOURCE, url: "https://x.org" })).toBe(
      "other"
    )
    expect(whereKindOf({ name: "Council list" })).toBe("other")
  })

  it("names the website with no link or note, and clears it on leaving", () => {
    const website = whereFieldsFor(
      {
        whereKind: "other",
        whereName: "Council list",
        whereUrl: "https://x.org",
        whereLicence: "OGL",
      },
      "website"
    )
    expect(website).toEqual({
      whereKind: "website",
      whereName: WEBSITE_SOURCE,
      whereUrl: "",
      whereLicence: "",
    })
    expect(whereFieldsFor(website, "dataset")).toEqual({
      whereKind: "dataset",
      whereName: "",
      whereUrl: "",
      whereLicence: "",
    })
    expect(
      whereFieldsFor(
        {
          whereKind: "dataset",
          whereName: "Survey",
          whereUrl: "https://x.org",
          whereLicence: "",
        },
        "other"
      )
    ).toEqual({
      whereKind: "other",
      whereName: "Survey",
      whereUrl: "https://x.org",
      whereLicence: "",
    })
  })

  it("fills the choice from a saved drive", () => {
    const s = builderStateFromDrive({
      title: "t",
      summary: "s",
      steps: [],
      focus: { kind: "gaps", gaps: ["hours"] },
      scope: {},
      whereToLook: { name: "Sites", url: "https://x.org" },
    } as unknown as Drive)
    expect(s.whereKind).toBe("other")
  })
})

describe("stepsDone", () => {
  it("is every card for a valid drive", () => {
    const s = valid({ whereKind: "website" })
    expect(stepsDone(s, builderErrors(s, NOW))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it("marks the cards whose fields have problems", () => {
    const s = valid({ gaps: [], places: [], title: "", endsOn: "" })
    expect(stepsDone(s, builderErrors(s, NOW))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it("wants a name or link for a dataset or another source", () => {
    const s = valid({ whereKind: "dataset", whereName: "", whereUrl: "" })
    expect(stepsDone(s, builderErrors(s, NOW))[2]).toBe(false)
    const named = { ...s, whereName: "Council list" }
    expect(stepsDone(named, builderErrors(named, NOW))[2]).toBe(true)
  })
})

describe("saved drafts", () => {
  it("has one key per user and mode", () => {
    expect(draftStorageKey("propose", "u1")).toBe("drive-proposal-draft:u1")
    expect(draftStorageKey("board", "u1")).toBe("drive-board-draft:u1")
  })

  it("round-trips the form, the note and which words were hand-written", () => {
    const draft = {
      state: valid({ places: [{ ...EALING, kind: "Borough" }] }),
      note: "Councils publish these.",
      dirty: { title: true, summary: false, steps: false },
    }
    expect(parseSavedDraft(serializeDraft(draft), NOW)).toEqual(draft)
  })

  it("is null for nothing, broken JSON or another shape", () => {
    expect(parseSavedDraft(null, NOW)).toBeNull()
    expect(parseSavedDraft("{", NOW)).toBeNull()
    expect(parseSavedDraft(JSON.stringify({ state: {} }), NOW)).toBeNull()
    expect(parseSavedDraft(JSON.stringify({ v: 1 }), NOW)).toBeNull()
  })

  it("keeps a new drive's value for every field that doesn't fit", () => {
    const saved = parseSavedDraft(
      JSON.stringify({
        v: 1,
        state: {
          focusKind: "explode",
          gaps: ["hours", "nope", 3],
          places: [{ level: "planet", slug: "x", name: "X" }],
          unit: "furlong",
          whereKind: "carrier-pigeon",
          title: 42,
          steps: [],
          startsOn: "2026-10-20",
        },
        dirty: { title: "yes" },
      }),
      NOW
    )!
    const fresh = emptyBuilderState(NOW)
    expect(saved.state.focusKind).toBe("gaps")
    expect(saved.state.gaps).toEqual(["hours"])
    expect(saved.state.places).toEqual([])
    expect(saved.state.unit).toBe("library")
    expect(saved.state.whereKind).toBe("other")
    expect(saved.state.title).toBe(fresh.title)
    expect(saved.state.steps).toEqual([""])
    expect(saved.state.startsOn).toBe("2026-10-20")
    expect(saved.dirty).toEqual(CLEAN_WORDS)
    expect(saved.note).toBe("")
  })
})

describe("the live preview", () => {
  it("lists up to three places, then counts the rest, or a list's size", () => {
    expect(
      previewPlaceLine({ places: [EALING, CAMDEN, CROYDON], libraryList: "" })
    ).toBe("Ealing · Camden · Croydon")
    expect(
      previewPlaceLine({
        places: [EALING, CAMDEN, CROYDON, BROMLEY, HACKNEY],
        libraryList: "",
      })
    ).toBe("Ealing · Camden · Croydon · 2 more")
    expect(
      previewPlaceLine({ places: [], libraryList: `${ID_A}\n${ID_B}` })
    ).toBe("2 chosen libraries")
    expect(previewPlaceLine({ places: [], libraryList: "" })).toBeNull()
  })

  it("is a scheduled DriveView at 0 of the to-do, from the form", () => {
    const state = withDraftedWords(
      chosen({ startsOn: "2026-10-13", endsOn: "2026-11-09" }),
      CLEAN_WORDS
    )
    const view = previewDriveView(state, 12)
    expect(view.drive).toMatchObject({
      title: "*Opening hours* for Ealing, Camden and Croydon",
      status: "scheduled",
      startsAt: "2026-10-13T00:00:00.000Z",
      focus: { kind: "gaps", gaps: ["hours"] },
      unit: "library",
    })
    expect(view.place).toBe("Ealing · Camden · Croydon")
    expect(view.progress).toMatchObject({ done: 0, total: 12, percent: 0 })
    expect(view.helpers).toBeNull()
  })

  it("isn't counted until the to-do count is known, and has a stand-in title", () => {
    const view = previewDriveView(emptyBuilderState(NOW), null)
    expect(view.progress).toBeNull()
    expect(view.drive.title).toBe("Your drive’s title")
  })
})

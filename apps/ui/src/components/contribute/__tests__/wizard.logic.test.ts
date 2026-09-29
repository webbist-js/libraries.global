import { describe, expect, it } from "vitest"

import {
  blockerFor,
  buildSubmission,
  CATEGORIES,
  CATEGORY_OPTIONS,
  DRAWER_STEPS,
  draftKey,
  EMPTY_DRAFT,
  hubHref,
  parseHubParams,
  STEP_LABELS,
  type WizardDraft,
} from "../wizard.logic"

const library = { slug: "epworth-library", name: "Epworth Library" }
const draft = (patch: Partial<WizardDraft>): WizardDraft => ({
  ...EMPTY_DRAFT,
  ...patch,
})

describe("STEP_LABELS", () => {
  it("names three steps for every action", () => {
    for (const labels of Object.values(STEP_LABELS))
      expect(labels).toHaveLength(3)
  })
})

describe("DRAWER_STEPS", () => {
  it("has a label, hint, title and lead for each of the three steps", () => {
    for (const copy of Object.values(DRAWER_STEPS)) expect(copy).toHaveLength(3)
  })
})

describe("CATEGORY_OPTIONS", () => {
  it("gives every category an icon and a placeholder, with no repeats", () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORY_OPTIONS.length)
    for (const c of CATEGORY_OPTIONS) {
      expect(c.icon).toMatch(/^mdi:/)
      expect(c.placeholder.length).toBeGreaterThan(0)
    }
  })

  it("keeps the categories the library page links to", () => {
    for (const linked of [
      "Opening hours",
      "Address or location",
      "Accessibility",
      "Collections",
      "Something else",
    ])
      expect(CATEGORIES).toContain(linked)
  })
})

describe("blockerFor", () => {
  it("asks the drawer for a category first, not a library", () => {
    const none = draft({ category: "" })
    expect(blockerFor("correction", 1, library, none, true)).toBe(
      "Pick what needs changing to continue."
    )
    expect(
      blockerFor("correction", 1, library, draft({ category: "Name" }), true)
    ).toBeNull()
    expect(blockerFor("correction", 2, library, none, true)).toBe(
      "Describe what’s correct to continue."
    )
  })

  it("asks for a library first", () => {
    expect(blockerFor("correction", 1, null, EMPTY_DRAFT)).toBe(
      "Choose a library to continue."
    )
    expect(blockerFor("correction", 1, library, EMPTY_DRAFT)).toBeNull()
  })

  it("needs the correct detail before a correction goes on", () => {
    expect(blockerFor("correction", 2, library, EMPTY_DRAFT)).toBe(
      "Describe what’s correct to continue."
    )
    expect(
      blockerFor("correction", 2, library, draft({ text: "Open 9 to 5" }))
    ).toBeNull()
  })

  it("makes the link optional for a correction and required for a source", () => {
    const filled = draft({ text: "Closes at 6pm" })
    expect(blockerFor("correction", 3, library, filled)).toBeNull()
    expect(blockerFor("source", 3, library, filled)).toBe(
      "Add a link or reference to send."
    )
    expect(
      blockerFor(
        "source",
        3,
        library,
        draft({ ...filled, source: "https://x.org" })
      )
    ).toBeNull()
  })

  it("needs a photo, then the licence confirmation", () => {
    expect(blockerFor("photo", 2, library, EMPTY_DRAFT)).toBe(
      "Upload a photo to continue."
    )
    const withPhoto = draft({ photo: { id: 7, url: "/uploads/a.jpg" } })
    expect(blockerFor("photo", 2, library, withPhoto)).toBeNull()
    expect(blockerFor("photo", 3, library, withPhoto)).toBe(
      "Confirm you can share it under CC BY-SA 4.0."
    )
    expect(
      blockerFor("photo", 3, library, draft({ ...withPhoto, licence: true }))
    ).toBeNull()
  })
})

describe("buildSubmission", () => {
  it("sends a correction in the shape the moderation API expects", () => {
    expect(
      buildSubmission(
        "correction",
        library,
        draft({
          category: "Opening hours",
          text: "  Open until 8pm on Thursdays  ",
          source: "https://epworth.example/hours",
        })
      )
    ).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "epworth-library",
      fields: {
        category: "Opening hours",
        libraryName: "Epworth Library",
        sourceUrl: "https://epworth.example/hours",
      },
      note: "Open until 8pm on Thursdays",
      evidenceType: "other",
      evidenceUrl: "https://epworth.example/hours",
    })
  })

  it("keeps a non-link source as a reference, not a URL", () => {
    const body = buildSubmission(
      "correction",
      library,
      draft({ text: "Closed on Mondays", source: "Sign on the door, May 2026" })
    )
    expect(body.fields).toMatchObject({
      sourceReference: "Sign on the door, May 2026",
    })
    expect(body).not.toHaveProperty("evidenceUrl")
  })

  it("tags a source and a photo so reviewers can tell them apart", () => {
    expect(
      buildSubmission(
        "source",
        library,
        draft({ category: "Address or location", source: "https://x.org" })
      ).fields
    ).toMatchObject({ kind: "source", category: "Address or location" })

    const photo = buildSubmission(
      "photo",
      library,
      draft({
        photo: { id: 7, url: "/uploads/a.jpg" },
        text: "Main entrance",
        credit: "Sam Lee",
        licence: true,
      })
    )
    expect(photo).toMatchObject({
      submissionType: "correction",
      evidenceType: "on_site_photo",
      fields: {
        kind: "photo",
        category: "Photo",
        photoId: 7,
        photoUrl: "/uploads/a.jpg",
        credit: "Sam Lee",
        licence: "CC BY-SA 4.0",
      },
      note: "Main entrance",
    })
  })
})

describe("draftKey", () => {
  it("is per action and library", () => {
    expect(draftKey("correction", "epworth-library")).toBe(
      "contribute.draft.correction.epworth-library"
    )
  })
})

describe("hub prefill", () => {
  it("round-trips an action and library through the URL", () => {
    const href = hubHref("correction", library, "Accessibility")
    expect(href).toBe(
      "/contribute?action=correction&library=epworth-library&name=Epworth+Library&category=Accessibility#start"
    )
    const params = new URLSearchParams(href.split("?")[1]!.split("#")[0])
    expect(parseHubParams(params)).toEqual({
      action: "correction",
      library,
      category: "Accessibility",
    })
  })

  it("ignores unknown actions and a library without a name", () => {
    expect(
      parseHubParams(new URLSearchParams("action=delete&library=x"))
    ).toEqual({ action: null, library: null, category: null })
  })
})

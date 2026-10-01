import { describe, expect, it } from "vitest"

import {
  draftMatchesLocale,
  editableFields,
  LOCALIZED_LIBRARY_FIELDS,
  resolveEditLocale,
  restrictToEditable,
  translationMode,
  withSubmissionLocale,
} from "./translation-mode"
import { EMPTY_FORM, type FormData, SUBMISSION_META_KEYS } from "./wizard.types"

const LOCALES = [
  { code: "en", name: "English", isDefault: true },
  { code: "cs", name: "Czech", isDefault: false },
]

describe("translationMode", () => {
  it("is off for the default locale", () => {
    expect(translationMode("en", "en")).toBe(false)
  })

  it("is on for any other locale", () => {
    expect(translationMode("cs", "en")).toBe(true)
  })

  it("is off without a locale", () => {
    expect(translationMode("", "en")).toBe(false)
  })
})

describe("editableFields", () => {
  const all = Object.keys(EMPTY_FORM)

  it("leaves every field editable outside translation mode", () => {
    expect(editableFields(false, all)).toEqual(all)
  })

  it("keeps only localized fields and the submission's own fields", () => {
    const editable = editableFields(true, all)
    expect(editable).toContain("name")
    expect(editable).toContain("summary")
    expect(editable).toContain("city")
    expect(editable).toContain("visitNotes")
    for (const k of SUBMISSION_META_KEYS) expect(editable).toContain(k)
    expect(editable).not.toContain("libraryType")
    expect(editable).not.toContain("lat")
    expect(editable).not.toContain("website")
    expect(editable).not.toContain("openingTimes")
    expect(editable).not.toContain("services")
    expect(editable).not.toContain("postalCode")
  })

  it("only returns keys it was given", () => {
    expect(editableFields(true, ["name", "website"])).toEqual(["name"])
  })

  it("uses exactly the Task 7 localized field list", () => {
    expect([...LOCALIZED_LIBRARY_FIELDS]).toEqual([
      "name",
      "shortName",
      "summary",
      "description",
      "city",
      "district",
      "streetAddress",
      "closureReason",
      "visitNotes",
      "admissionInfo",
      "accessibilityNotes",
      "buildingInfo",
      "transitInfo",
    ])
  })
})

describe("resolveEditLocale", () => {
  it("defaults to the default locale without ?locale", () => {
    expect(resolveEditLocale(undefined, LOCALES, "en")).toBe("en")
  })

  it("accepts a configured locale", () => {
    expect(resolveEditLocale("cs", LOCALES, "en")).toBe("cs")
  })

  it("ignores an unknown locale", () => {
    expect(resolveEditLocale("xx", LOCALES, "en")).toBe("en")
  })

  it("takes the first value of a repeated parameter", () => {
    expect(resolveEditLocale(["cs", "en"], LOCALES, "en")).toBe("cs")
  })
})

describe("restrictToEditable", () => {
  it("resets fields that can't be edited to the record's value", () => {
    const initial: FormData = { ...EMPTY_FORM, name: "A", website: "x" }
    const current: FormData = {
      ...initial,
      name: "B",
      website: "y",
      editSummary: "s",
    }
    const out = restrictToEditable(
      initial,
      current,
      new Set(editableFields(true, Object.keys(EMPTY_FORM)))
    )
    expect(out.name).toBe("B")
    expect(out.website).toBe("x")
    expect(out.editSummary).toBe("s")
  })

  it("returns the form unchanged when every field is editable", () => {
    const initial: FormData = { ...EMPTY_FORM }
    const current: FormData = { ...EMPTY_FORM, website: "y" }
    expect(restrictToEditable(initial, current, null)).toBe(current)
  })
})

describe("withSubmissionLocale", () => {
  const body = { submissionType: "correction", fields: { kind: "record" } }

  it("adds locale in translation mode", () => {
    expect(withSubmissionLocale(body, "cs")).toEqual({ ...body, locale: "cs" })
  })

  it("sends no locale outside translation mode", () => {
    expect(withSubmissionLocale(body, null)).toEqual(body)
    expect(withSubmissionLocale(body, null)).not.toHaveProperty("locale")
  })
})

describe("draftMatchesLocale", () => {
  it("matches a draft without a locale to the default locale", () => {
    expect(draftMatchesLocale({}, "en", "en")).toBe(true)
    expect(draftMatchesLocale({ locale: null }, "cs", "en")).toBe(false)
  })

  it("matches a draft in the same locale", () => {
    expect(draftMatchesLocale({ locale: "cs" }, "cs", "en")).toBe(true)
    expect(draftMatchesLocale({ locale: "cs" }, "en", "en")).toBe(false)
  })
})

describe("TranslationBanner copy", async () => {
  const { translationBannerText } = await import("./TranslationBanner")

  it("names the language and what can change", () => {
    expect(translationBannerText("Czech")).toBe(
      "Translating into Czech. Only text that differs by language can be changed here."
    )
  })
})

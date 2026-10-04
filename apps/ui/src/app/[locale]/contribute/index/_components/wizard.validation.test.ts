import { describe, expect, it } from "vitest"

import { editableFields } from "./translation-mode"
import { EMPTY_FORM, type FormData } from "./wizard.types"
import {
  firstIncompleteStep,
  missingFields,
  type ValidationScope,
} from "./wizard.validation"

const adding: ValidationScope = { record: null, editable: null }

const complete: FormData = {
  ...EMPTY_FORM,
  name: "Radlett Library",
  libraryType: "Public",
  operationalStatus: "open",
  city: "Radlett",
  country: "United Kingdom",
  evidenceType: "official_website",
  evidenceUrl: "https://example.org",
}

describe("missingFields", () => {
  it("lists a step's empty required fields", () => {
    expect(missingFields(1, EMPTY_FORM, adding)).toEqual([
      "name",
      "libraryType",
      "operationalStatus",
    ])
    expect(missingFields(2, { ...EMPTY_FORM, city: "  " }, adding)).toEqual([
      "city",
      "country",
    ])
    expect(missingFields(3, EMPTY_FORM, adding)).toEqual([])
    expect(missingFields(1, complete, adding)).toEqual([])
  })

  it("only blocks an improvement on fields the edit emptied", () => {
    const record = { ...complete, city: "", evidenceType: "", evidenceUrl: "" }
    const scope = { record, editable: null }

    expect(missingFields(2, record, scope)).toEqual([])
    expect(missingFields(2, { ...record, country: "" }, scope)).toEqual([
      "country",
    ])
    expect(missingFields(1, { ...record, name: "" }, scope)).toEqual(["name"])
  })

  it("always asks an improvement for evidence and a summary", () => {
    const scope = { record: complete, editable: null }
    const form = { ...complete, evidenceType: "", evidenceUrl: "" }

    expect(missingFields(7, form, scope)).toEqual([
      "evidenceType",
      "evidenceUrl",
      "editSummary",
    ])
    expect(missingFields(7, form, adding)).toEqual([
      "evidenceType",
      "evidenceUrl",
    ])
  })

  it("ignores fields shared across languages while translating", () => {
    const editable = new Set(editableFields(true, Object.keys(EMPTY_FORM)))
    const scope = { record: complete, editable }
    const form = { ...complete, name: "", libraryType: "" }

    expect(missingFields(1, form, scope)).toEqual(["name"])
  })
})

describe("firstIncompleteStep", () => {
  it("finds the earliest step with a missing field", () => {
    expect(firstIncompleteStep(EMPTY_FORM, adding)).toBe(1)
    expect(firstIncompleteStep({ ...complete, city: "" }, adding)).toBe(2)
    expect(firstIncompleteStep({ ...complete, evidenceUrl: "" }, adding)).toBe(
      7
    )
    expect(firstIncompleteStep(complete, adding)).toBeNull()
  })
})

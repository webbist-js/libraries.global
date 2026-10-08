import { hasErrors, validateMobileTimetable } from "@repo/shared-data"

import { coordIsValid } from "@/lib/geocode/coordinates"

import { type FormData, SUBMISSION_META_KEYS } from "./wizard.types"

/** The fields each step marks "required". A test holds WizardSteps to it. */
const REQUIRED_BY_STEP: Readonly<Record<number, readonly (keyof FormData)[]>> =
  {
    1: ["name", "libraryType", "operationalStatus"],
    2: ["city", "country"],
    7: ["evidenceType", "evidenceUrl"],
  }

/** Fields a step checks the format of once they're filled in. */
const FORMATTED_BY_STEP: Readonly<Record<number, readonly ("lat" | "lng")[]>> =
  {
    2: ["lat", "lng"],
  }

const STEPS_CHECKED = [
  ...new Set(
    [...Object.keys(REQUIRED_BY_STEP), ...Object.keys(FORMATTED_BY_STEP)].map(
      Number
    )
  ),
].sort((a, b) => a - b)

const META = new Set<string>(SUBMISSION_META_KEYS)

export interface ValidationScope {
  /** Improve mode: the record's current values. Null when adding a library. */
  record: FormData | null
  /** The keys that may change (translation mode), or null when all may. */
  editable: ReadonlySet<string> | null
}

const blank = (v: unknown) => typeof v !== "string" || !v.trim()

/** The fields `step` requires. Improving a record also needs a summary. */
export function requiredFields(
  step: number,
  improving: boolean
): (keyof FormData)[] {
  const keys = [...(REQUIRED_BY_STEP[step] ?? [])]
  if (improving && step === 7) keys.push("editSummary")

  return keys
}

/**
 * The fields that stop `step` being left: required ones still empty, then
 * coordinates that aren't a number in range. Fields the contributor can't
 * fill here don't count: one shared across languages while translating, or
 * one the record already lacks, so fixing the hours never waits on a city
 * nobody has sourced.
 */
export function missingFields(
  step: number,
  form: FormData,
  scope: ValidationScope
): (keyof FormData)[] {
  const { record, editable } = scope
  const required =
    step === 2 && form.libraryType === "Mobile"
      ? (["country", "regionDocumentId"] as (keyof FormData)[])
      : requiredFields(step, !!record)
  const empty = required.filter((key) => {
    if (editable && !editable.has(key)) return false
    if (record && !META.has(key) && blank(record[key])) return false

    return blank(form[key])
  })
  const malformed = (FORMATTED_BY_STEP[step] ?? []).filter(
    (key) => (!editable || editable.has(key)) && !coordIsValid(key, form[key])
  )

  if (
    step === 3 &&
    form.libraryType === "Mobile" &&
    form.mobileTimetable &&
    hasErrors(validateMobileTimetable(form.mobileTimetable))
  )
    return [...empty, ...malformed, "mobileTimetable"]

  return [...empty, ...malformed]
}

/** The first step with a missing field, or null when the form can be sent. */
export function firstIncompleteStep(
  form: FormData,
  scope: ValidationScope
): number | null {
  return (
    [...new Set([...STEPS_CHECKED, 3])]
      .sort((a, b) => a - b)
      .find((step) => missingFields(step, form, scope).length > 0) ?? null
  )
}

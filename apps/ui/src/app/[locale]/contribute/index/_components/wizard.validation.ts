import { type FormData, SUBMISSION_META_KEYS } from "./wizard.types"

/** The fields each step marks "required". A test holds WizardSteps to it. */
const REQUIRED_BY_STEP: Readonly<Record<number, readonly (keyof FormData)[]>> =
  {
    1: ["name", "libraryType", "operationalStatus"],
    2: ["city", "country"],
    7: ["evidenceType", "evidenceUrl"],
  }

const STEPS_WITH_REQUIRED = Object.keys(REQUIRED_BY_STEP)
  .map(Number)
  .sort((a, b) => a - b)

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
 * The required fields on `step` that are still empty. Fields the
 * contributor can't fill here don't count: one shared across languages
 * while translating, or one the record already lacks, so fixing the hours
 * never waits on a city nobody has sourced.
 */
export function missingFields(
  step: number,
  form: FormData,
  scope: ValidationScope
): (keyof FormData)[] {
  const { record, editable } = scope

  return requiredFields(step, !!record).filter((key) => {
    if (editable && !editable.has(key)) return false
    if (record && !META.has(key) && blank(record[key])) return false

    return blank(form[key])
  })
}

/** The first step with a missing field, or null when the form can be sent. */
export function firstIncompleteStep(
  form: FormData,
  scope: ValidationScope
): number | null {
  return (
    STEPS_WITH_REQUIRED.find(
      (step) => missingFields(step, form, scope).length > 0
    ) ?? null
  )
}

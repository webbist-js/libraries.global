import type { FormData } from "./wizard.types"
import { requiredFields } from "./wizard.validation"

export interface StepProgress {
  n: number
  required: boolean
  done: boolean
}

const filled = (v: unknown) => typeof v === "string" && !!v.trim()

function hasOpeningHours(f: FormData): boolean {
  return !!f.openingTimes?.days?.some(
    (d) => d.enabled && d.timeframes.length > 0
  )
}

/** What an optional step needs before it counts as having something in it. */
const OPTIONAL_DONE: Readonly<Record<number, (f: FormData) => boolean>> = {
  3: (f) =>
    filled(f.website) ||
    filled(f.catalogueUrl) ||
    hasOpeningHours(f) ||
    filled(f.admissionInfo) ||
    filled(f.visitNotes),
  4: (f) => filled(f.collectionSize),
  5: (f) => filled(f.foundedYear),
  6: (f) => (f.uploadedImages?.length ?? 0) > 0,
}

export const STEP_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const

/**
 * How far each of the seven steps is. A required step is done once every
 * field the validation requires is filled; an optional one once its main
 * field has something.
 */
export function stepProgress(f: FormData, improving: boolean): StepProgress[] {
  return STEP_NUMBERS.map((n) => {
    const required = requiredFields(n, improving)
    if (required.length > 0) {
      return { n, required: true, done: required.every((k) => filled(f[k])) }
    }

    return { n, required: false, done: OPTIONAL_DONE[n]?.(f) ?? false }
  })
}

import { wizardSteps } from "./wizard.steps"
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
const hasVisitDetails = (f: FormData) =>
  filled(f.website) ||
  filled(f.catalogueUrl) ||
  filled(f.admissionInfo) ||
  filled(f.visitNotes) ||
  filled(f.phone) ||
  filled(f.email) ||
  filled(f.accessibilityNotes) ||
  f.services.length > 0 ||
  f.amenities.length > 0 ||
  f.accessibility.length > 0

const OPTIONAL_DONE: Readonly<Record<number, (f: FormData) => boolean>> = {
  3: (f) => hasVisitDetails(f) || hasOpeningHours(f),
  8: hasVisitDetails,
  4: (f) => filled(f.collectionSize),
  5: (f) => filled(f.foundedYear),
  6: (f) => (f.uploadedImages?.length ?? 0) > 0,
}

/**
 * Completeness in the current library's step order. A required step is done once every
 * field the validation requires is filled; an optional one once its main
 * field has something.
 */
export function stepProgress(f: FormData, improving: boolean): StepProgress[] {
  const mobile = f.libraryType === "Mobile"

  return wizardSteps(mobile)
    .filter(({ n }) => n > 0)
    .map(({ n }) => {
      const required = requiredFields(n, improving, mobile)
      if (required.length > 0) {
        return { n, required: true, done: required.every((k) => filled(f[k])) }
      }

      const done =
        mobile && n === 3
          ? !!(
              f.mobileTimetable?.stops.length && f.mobileTimetable.visits.length
            ) || filled(f.timetableUrl)
          : (OPTIONAL_DONE[n]?.(f) ?? false)

      return { n, required: false, done }
    })
}

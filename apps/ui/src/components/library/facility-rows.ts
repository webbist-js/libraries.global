import {
  facilityChecklistFor,
  type FacilityAnswer,
  type LibraryTypeValue,
} from "@repo/shared-data"
// Rows for the library page's accessibility & facilities grid. Pure, so
// the page and the tests share it.

import {
  facilityIcon,
  type FacilityKind,
  sameFacility,
} from "@/components/library/facility-icons"

export type FacilityState = "yes" | "no" | "unknown"

export type FacilityRow = {
  label: string
  question?: string
  category?: FacilityKind
  icon: string
  /** yes: on the record; no: confirmed absent; unknown: ask the reader. */
  state: FacilityState
  summary?: string | null
  description?: unknown
  detailCategory?: string | null
}

type TagItem = {
  name?: string | null
  summary?: string | null
  description?: unknown
  category?: string | null
  icon?: { iconName?: string | null } | null
}

/**
 * Documented facilities first (the record's own names), then each checklist
 * question the record doesn't answer yet: "no" when it's confirmed absent,
 * otherwise "unknown". A question counts as answered by its mapped CMS
 * entry (FACILITY_CHECKLIST) or by a documented name that clearly means it.
 */
export function facilityRows(library: {
  libraryType?: LibraryTypeValue
  accessibility?: unknown
  services?: unknown
  amenities?: unknown
  absentFacilities?: unknown
}): FacilityRow[] {
  const checklist = facilityChecklistFor(library.libraryType)
  const tagged = (items: unknown, kind: FacilityKind): FacilityRow[] =>
    ((items ?? []) as TagItem[]).flatMap((item) =>
      item.name
        ? [
            {
              question: checklist.find(
                (question) =>
                  question.collection === kind &&
                  sameFacility(question.name, item.name!)
              )?.label,
              label: item.name,
              category: kind,
              icon: facilityIcon(item.name, kind, item.icon?.iconName),
              state: "yes" as const,
              summary: item.summary,
              description: item.description,
              detailCategory: item.category,
            },
          ]
        : []
    )
  const documented = [
    ...tagged(library.accessibility, "accessibility"),
    ...tagged(library.services, "service"),
    ...tagged(library.amenities, "amenity"),
  ]
  const names = (collection: FacilityKind) =>
    documented
      .filter((d) => d.category === collection)
      .map((d) => d.label.toLowerCase())
  const absent = new Set(
    Array.isArray(library.absentFacilities)
      ? library.absentFacilities.filter(
          (x): x is string => typeof x === "string"
        )
      : []
  )

  const open = facilityChecklistFor(library.libraryType)
    .filter(({ label, name, collection }) => {
      const lower = label.toLowerCase()

      return !names(collection).some(
        (doc) =>
          doc === name.toLowerCase() ||
          doc.includes(lower) ||
          lower.includes(doc) ||
          sameFacility(label, doc)
      )
    })
    .map(({ label, collection }) => ({
      category: collection,
      question: label,
      label,
      icon: facilityIcon(label, "accessibility"),
      state: absent.has(label) ? ("no" as const) : ("unknown" as const),
    }))

  return [...documented, ...open]
}

export type FacilityAnswersBody = {
  submissionType: "correction"
  targetEntityType: "library"
  targetSlug: string
  targetDocumentId?: string
  editSummary: string
  fields: {
    kind: "facilities"
    category: "Accessibility"
    libraryName: string
    answers: Record<string, FacilityAnswer>
  }
  driveDocumentId?: string
}

/**
 * The /api/submissions body for a reader's Yes/No answers: one
 * `kind: "facilities"` correction for a reviewer. A drive's task panel
 * names the library and the drive at the top level too.
 */
export function facilityAnswersBody({
  slug,
  name,
  answers,
  documentId,
  driveDocumentId,
}: {
  readonly slug: string
  readonly name: string
  readonly answers: readonly (readonly [string, FacilityAnswer])[]
  readonly documentId?: string
  readonly driveDocumentId?: string
}): FacilityAnswersBody {
  return {
    submissionType: "correction",
    targetEntityType: "library",
    targetSlug: slug,
    ...(documentId ? { targetDocumentId: documentId } : {}),
    editSummary: `Accessibility: ${answers.map(([k, v]) => `${k} ${v}`).join(", ")}`,
    fields: {
      kind: "facilities",
      category: "Accessibility",
      libraryName: name,
      answers: Object.fromEntries(answers),
    },
    ...(driveDocumentId ? { driveDocumentId } : {}),
  }
}

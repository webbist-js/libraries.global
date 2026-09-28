// Rows for the library page's accessibility & facilities grid. Pure, so
// the page and the tests share it.

import { FACILITY_CHECKLIST } from "@repo/shared-data"

import {
  facilityIcon,
  type FacilityKind,
  sameFacility,
} from "@/components/library/facility-icons"

export type FacilityState = "yes" | "no" | "unknown"

export type FacilityRow = {
  label: string
  icon: string
  /** yes: on the record; no: confirmed absent; unknown: ask the reader. */
  state: FacilityState
}

type TagItem = {
  name?: string | null
  icon?: { iconName?: string | null } | null
}

/**
 * Documented facilities first (the record's own names), then each checklist
 * question the record doesn't answer yet: "no" when it's confirmed absent,
 * otherwise "unknown". A question counts as answered by its mapped CMS
 * entry (FACILITY_CHECKLIST) or by a documented name that clearly means it.
 */
export function facilityRows(library: {
  accessibility?: unknown
  services?: unknown
  amenities?: unknown
  absentFacilities?: unknown
}): FacilityRow[] {
  const tagged = (items: unknown, kind: FacilityKind): FacilityRow[] =>
    ((items ?? []) as TagItem[]).flatMap((item) =>
      item.name
        ? [
            {
              label: item.name,
              icon: facilityIcon(item.name, kind, item.icon?.iconName),
              state: "yes" as const,
            },
          ]
        : []
    )
  const documented = [
    ...tagged(library.accessibility, "accessibility"),
    ...tagged(library.services, "service"),
    ...tagged(library.amenities, "amenity"),
  ]
  const names = documented.map((d) => d.label.toLowerCase())
  const absent = new Set(
    Array.isArray(library.absentFacilities)
      ? library.absentFacilities.filter(
          (x): x is string => typeof x === "string"
        )
      : []
  )

  const open = FACILITY_CHECKLIST.filter(({ label, name }) => {
    const lower = label.toLowerCase()

    return !names.some(
      (doc) =>
        doc === name.toLowerCase() ||
        doc.includes(lower) ||
        lower.includes(doc) ||
        sameFacility(label, doc)
    )
  }).map(({ label }) => ({
    label,
    icon: facilityIcon(label, "accessibility"),
    state: absent.has(label) ? ("no" as const) : ("unknown" as const),
  }))

  return [...documented, ...open]
}

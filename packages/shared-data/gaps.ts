// ── Gaps ──────────────────────────────────────────────────────────────────────
// The record sections a Library can lack: one definition for the stored
// completeness score, the search index's `needs`, the library page's
// checklist, location pages, Find libraries and drives. Eight count toward
// completeness; `accessibility` and `services` are the narrower gaps that
// filters and drives use.

import {
  FACILITY_CHECKLIST,
  MOBILE_FACILITY_CHECKLIST,
} from "./facility-checklist"
import { normalizeMobileTimetable } from "./mobile-timetable/normalize"

export type GapKey =
  | "photo"
  | "hours"
  | "address"
  | "location"
  | "facilities"
  | "about"
  | "history"
  | "contact"
  | "accessibility"
  | "services"

/** The library fields gaps read. Relations may be ids or full entries. */
export interface GapRecord {
  heroImage?: unknown
  openingTimes?: unknown
  libraryType?: string | null
  mobileTimetable?: unknown
  homeLibrary?: unknown
  streetAddress?: string | null
  location?: unknown
  accessibility?: unknown[] | null
  services?: unknown[] | null
  amenities?: unknown[] | null
  absentFacilities?: unknown
  summary?: string | null
  description?: unknown
  collectionStats?: unknown[] | null
  foundedYear?: string | null
  openedYear?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
}

export interface GapDefinition {
  key: GapKey
  /** Checklist and chip label. */
  label: string
  /** Lower-case phrase for sentences: "opening hours", "a photo". */
  phrase: string
  /** One of the eight sections the stored completeness score counts. */
  completeness: boolean
  /** True when the record has this section. */
  filled: (r: GapRecord) => boolean
}

const text = (v: unknown) => typeof v === "string" && v.trim() !== ""
const some = (v: unknown) => Array.isArray(v) && v.length > 0

/** An enabled day with at least one timeframe that has both ends. */
export function hasOpeningHours(openingTimes: unknown): boolean {
  const days = (openingTimes as { days?: unknown } | null | undefined)?.days
  if (!Array.isArray(days)) return false

  return days.some((d) => {
    const day = d as { enabled?: unknown; timeframes?: unknown } | null

    return (
      Boolean(day?.enabled) &&
      Array.isArray(day?.timeframes) &&
      day.timeframes.some((tf) => {
        const t = tf as { startTime?: unknown; endTime?: unknown } | null

        return text(t?.startTime) && text(t?.endTime)
      })
    )
  })
}

const ACCESSIBILITY_QUESTIONS: Set<string> = new Set(
  [...FACILITY_CHECKLIST, ...MOBILE_FACILITY_CHECKLIST]
    .filter((c) => c.collection === "accessibility")
    .map((c) => c.label)
)

/** A confirmed "No" to an accessibility question is an answer (OD-3). */
const answeredAccessibility = (absent: unknown) =>
  Array.isArray(absent) &&
  absent.some((x) => typeof x === "string" && ACCESSIBILITY_QUESTIONS.has(x))

export const GAPS: readonly GapDefinition[] = [
  {
    key: "photo",
    label: "Photo",
    phrase: "a photo",
    completeness: true,
    filled: (r) => Boolean(r.heroImage),
  },
  {
    key: "hours",
    label: "Opening hours",
    phrase: "opening hours",
    completeness: true,
    filled: (r) =>
      r.libraryType === "Mobile"
        ? Boolean(normalizeMobileTimetable(r.mobileTimetable)?.visits.length)
        : hasOpeningHours(r.openingTimes),
  },
  {
    key: "address",
    label: "Address",
    phrase: "an address",
    completeness: true,
    filled: (r) =>
      r.libraryType === "Mobile"
        ? Boolean(r.homeLibrary) || text(r.streetAddress)
        : text(r.streetAddress),
  },
  {
    key: "location",
    label: "Map location",
    phrase: "a map location",
    completeness: true,
    filled: (r) =>
      Boolean(r.location) ||
      (r.libraryType === "Mobile" &&
        Boolean(
          normalizeMobileTimetable(r.mobileTimetable)?.stops.some(
            (s) => s.location
          )
        )),
  },
  {
    key: "facilities",
    label: "Facilities",
    phrase: "facilities",
    completeness: true,
    filled: (r) =>
      some(r.accessibility) ||
      some(r.services) ||
      some(r.amenities) ||
      answeredAccessibility(r.absentFacilities),
  },
  {
    key: "about",
    label: "About",
    phrase: "a description",
    completeness: true,
    filled: (r) =>
      text(r.summary) || some(r.description) || some(r.collectionStats),
  },
  {
    key: "history",
    label: "History",
    phrase: "a date from its history",
    completeness: true,
    filled: (r) => text(r.foundedYear) || text(r.openedYear),
  },
  {
    key: "contact",
    label: "Contact details",
    phrase: "contact details",
    completeness: true,
    filled: (r) => text(r.website) || text(r.phone) || text(r.email),
  },
  {
    key: "accessibility",
    label: "Accessibility",
    phrase: "accessibility details",
    completeness: false,
    filled: (r) =>
      some(r.accessibility) || answeredAccessibility(r.absentFacilities),
  },
  {
    key: "services",
    label: "Services",
    phrase: "services and amenities",
    completeness: false,
    filled: (r) => some(r.services) || some(r.amenities),
  },
]

export const GAP_KEYS: readonly GapKey[] = GAPS.map((g) => g.key)

export const COMPLETENESS_GAP_KEYS: readonly GapKey[] = GAPS.filter(
  (g) => g.completeness
).map((g) => g.key)

export const isGapKey = (v: unknown): v is GapKey =>
  typeof v === "string" && (GAP_KEYS as readonly string[]).includes(v)

export const gapDefinition = (
  key: GapKey,
  libraryType?: string | null
): GapDefinition => {
  const definition = GAPS.find((g) => g.key === key)!

  return key === "hours" && libraryType === "Mobile"
    ? { ...definition, label: "Stops & times", phrase: "stops and times" }
    : definition
}

export function applicableGap(
  key: GapKey,
  libraryType?: string | null
): boolean {
  return (
    libraryType !== "Digital" ||
    ![
      "hours",
      "address",
      "location",
      "facilities",
      "accessibility",
      "services",
    ].includes(key)
  )
}

/** The record's gaps, in registry order. */
export function gapsOf(r: GapRecord): GapKey[] {
  return GAPS.filter(
    (g) => applicableGap(g.key, r.libraryType) && !g.filled(r)
  ).map((g) => g.key)
}

export interface CompletenessSection {
  key: GapKey
  label: string
  filled: boolean
}

/** The eight completeness sections and the 0–100 score stored on a library. */
export function completenessOf(r: GapRecord): {
  filled: number
  total: number
  percent: number
  sections: CompletenessSection[]
} {
  const sections = GAPS.filter(
    (g) => g.completeness && applicableGap(g.key, r.libraryType)
  ).map((g) => ({
    key: g.key,
    label: gapDefinition(g.key, r.libraryType).label,
    filled: g.filled(r),
  }))
  const filled = sections.filter((s) => s.filled).length

  return {
    filled,
    total: sections.length,
    percent: Math.round((filled / sections.length) * 100),
    sections,
  }
}

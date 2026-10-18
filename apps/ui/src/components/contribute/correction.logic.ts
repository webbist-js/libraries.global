import {
  libraryTypeName,
  diffTimetable,
  normalizeMobileTimetable,
  summarizeDiff,
  timetableHash,
  type MobileTimetable,
} from "@repo/shared-data"

import {
  DAY_LABELS,
  DAY_ORDER,
  emptyOpeningTimes,
  type OpeningTimesData,
} from "@/components/library-editor/opening-times.types"
import { OPERATIONAL_STATUSES } from "@/components/library-editor/wizard.constants"

/**
 * Structured corrections: which editor each category opens, and the change
 * set a correction carries (`fields.kind: "record"`), in the library
 * schema's own field names, so an approved correction is written straight
 * to the record by the moderation plugin.
 */

export type OptionRef = { documentId: string; name: string }

export type OptionKey = "accessibility" | "amenities" | "services"

/** The library's published values, as the correction editors need them. */
export type CorrectionRecord = {
  documentId: string
  name: string
  shortName: string
  streetAddress: string
  district: string
  city: string
  postalCode: string
  website: string
  phone: string
  email: string
  catalogueUrl: string
  operationalStatus: string
  closureReason: string
  openingTimes: OpeningTimesData | null
  libraryType?: string
  mobileTimetable?: MobileTimetable | null
  accessibility: OptionRef[]
  amenities: OptionRef[]
  services: OptionRef[]
  /** Facility questions confirmed "No" (the library page's Yes/No answers). */
  absentFacilities: string[]
}

export const TEXT_KEYS = [
  "name",
  "shortName",
  "streetAddress",
  "district",
  "city",
  "postalCode",
  "website",
  "phone",
  "email",
  "catalogueUrl",
  "operationalStatus",
  "closureReason",
] as const

export type TextKey = (typeof TEXT_KEYS)[number]

/** What the contributor changed. Absent keys mean "as the record has it". */
export type RecordEdit = Partial<Record<TextKey, string>> & {
  openingTimes?: OpeningTimesData
  mobileTimetable?: MobileTimetable | null
  accessibility?: string[]
  amenities?: string[]
  services?: string[]
  /** New options to add to the list ("suggest a new one"). */
  suggested?: Partial<Record<OptionKey, string[]>>
}

export type EditorKind =
  | "hours"
  | "timetable"
  | "address"
  | "name"
  | "links"
  | "status"
  | "accessibility"
  | "facilities"
  | "text"

const EDITORS: Record<string, EditorKind> = {
  "Opening hours": "hours",
  "Stops & times": "timetable",
  "Address or location": "address",
  Accessibility: "accessibility",
  Name: "name",
  "Website or catalogue": "links",
  "Open or closed": "status",
  "Services and facilities": "facilities",
}

export const editorFor = (
  category: string,
  libraryType?: string
): EditorKind =>
  category === "Opening hours" && libraryType === "Mobile"
    ? "timetable"
    : (EDITORS[category] ?? "text")

/** The keys each structured editor may change. */
const KEYS: Record<EditorKind, readonly string[]> = {
  hours: ["openingTimes"],
  timetable: ["mobileTimetable"],
  address: ["streetAddress", "district", "city", "postalCode"],
  name: ["name", "shortName"],
  links: ["website", "phone", "email", "catalogueUrl"],
  status: ["operationalStatus", "closureReason"],
  accessibility: ["accessibility"],
  facilities: ["services", "amenities"],
  text: [],
}

export const OPTION_KEYS: readonly OptionKey[] = [
  "accessibility",
  "amenities",
  "services",
]

export const TEXT_LABELS: Record<TextKey, string> = {
  name: "Name",
  shortName: "Short or other name",
  streetAddress: "Street address",
  district: "Area or district",
  city: "Town or city",
  postalCode: "Postcode",
  website: "Website",
  phone: "Phone",
  email: "Email",
  catalogueUrl: "Catalogue link",
  operationalStatus: "Status",
  closureReason: "What’s happening",
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

function refs(v: unknown): OptionRef[] {
  if (!Array.isArray(v)) return []

  return v.flatMap((o) => {
    const { documentId, name } = (o ?? {}) as Record<string, unknown>

    return typeof documentId === "string" && typeof name === "string"
      ? [{ documentId, name }]
      : []
  })
}

/** A Strapi library (as the editing loader returns it) as a CorrectionRecord. */
export function toCorrectionRecord(
  lib: Record<string, unknown> & { documentId: string }
): CorrectionRecord {
  const hours = lib.openingTimes as { days?: unknown } | null

  return {
    documentId: lib.documentId,
    name: str(lib.name),
    shortName: str(lib.shortName),
    streetAddress: str(lib.streetAddress),
    district: str(lib.district),
    city: str(lib.city),
    postalCode: str(lib.postalCode),
    website: str(lib.website),
    phone: str(lib.phone),
    email: str(lib.email),
    catalogueUrl: str(lib.catalogueUrl),
    operationalStatus: str(lib.operationalStatus),
    closureReason: str(lib.closureReason),
    openingTimes:
      hours && Array.isArray(hours.days) ? (hours as OpeningTimesData) : null,
    libraryType: str(libraryTypeName(lib.libraryType)),
    mobileTimetable: normalizeMobileTimetable(lib.mobileTimetable),
    accessibility: refs(lib.accessibility),
    amenities: refs(lib.amenities),
    services: refs(lib.services),
    absentFacilities: Array.isArray(lib.absentFacilities)
      ? lib.absentFacilities.filter((x): x is string => typeof x === "string")
      : [],
  }
}

/** Opening hours in all seven days, from the record or empty. */
export function hoursOf(v: OpeningTimesData | null | undefined) {
  const base = emptyOpeningTimes()
  if (!v) return base

  return {
    version: v.version ?? 1,
    days: DAY_ORDER.map(
      (day) =>
        v.days.find((d) => d.day === day) ??
        base.days.find((d) => d.day === day)!
    ),
  }
}

/** A comparison key that ignores ids and order, so equal hours compare equal. */
function hoursKey(v: OpeningTimesData | null | undefined): string {
  return hoursOf(v)
    .days.map((d) => {
      const frames = d.enabled
        ? [...d.timeframes]
            .map((t) => `${t.startTime}-${t.endTime}/${t.staffing}`)
            .sort()
        : []

      return `${d.day}:${frames.join(",")}`
    })
    .join("|")
}

/** The current value of a text field, or "". */
const currentText = (current: CorrectionRecord, key: TextKey) =>
  str(current[key]).trim()

export type RecordChanges = {
  /** Library fields to write, in the moderation plugin's shape. */
  changes: Record<string, unknown>
  /** What the record said, for the contributor's own summary. */
  previous: Record<string, unknown>
  suggestedOptions: Partial<Record<OptionKey, string[]>>
  previousHash?: string
}

/** Only what this category's editor changed, compared with the record. */
export function recordChanges(
  category: string,
  current: CorrectionRecord,
  edit: RecordEdit
): RecordChanges {
  const keys =
    KEYS[editorFor(category, libraryTypeName(current.libraryType) ?? undefined)]
  const changes: Record<string, unknown> = {}
  const previous: Record<string, unknown> = {}
  const suggestedOptions: Partial<Record<OptionKey, string[]>> = {}

  for (const key of keys) {
    if (key === "mobileTimetable") {
      if (
        edit.mobileTimetable !== undefined &&
        timetableHash(edit.mobileTimetable) !==
          timetableHash(current.mobileTimetable ?? null)
      ) {
        changes.mobileTimetable = edit.mobileTimetable
        previous.mobileTimetable = current.mobileTimetable ?? null
      }
      continue
    }
    if (key === "openingTimes") {
      if (
        edit.openingTimes &&
        hoursKey(edit.openingTimes) !== hoursKey(current.openingTimes)
      ) {
        changes.openingTimes = hoursOf(edit.openingTimes)
        previous.openingTimes = current.openingTimes
      }
      continue
    }
    if ((OPTION_KEYS as readonly string[]).includes(key)) {
      const k = key as OptionKey
      const was = current[k].map((o) => o.documentId)
      const now = edit[k]
      if (now) {
        const connect = now.filter((id) => !was.includes(id))
        const disconnect = was.filter((id) => !now.includes(id))
        if (connect.length || disconnect.length) {
          changes[k] = {
            ...(connect.length ? { connect } : {}),
            ...(disconnect.length ? { disconnect } : {}),
          }
          previous[k] = was
        }
      }
      const extra = (edit.suggested?.[k] ?? [])
        .map((n) => n.trim())
        .filter(Boolean)
      if (extra.length) suggestedOptions[k] = extra
      continue
    }
    const k = key as TextKey
    if (edit[k] === undefined) continue
    const next = edit[k]!.trim()
    if (next === currentText(current, k)) continue
    // The status editor only offers real statuses; never send an empty one.
    if (k === "operationalStatus" && !next) continue
    if (k === "name" && !next) continue
    changes[k] = next
    previous[k] = currentText(current, k)
  }

  return {
    changes,
    previous,
    suggestedOptions,
    ...(Object.prototype.hasOwnProperty.call(changes, "mobileTimetable")
      ? { previousHash: timetableHash(current.mobileTimetable ?? null) }
      : {}),
  }
}

export const hasRecordChange = (c: RecordChanges) =>
  Object.keys(c.changes).length > 0 ||
  Object.values(c.suggestedOptions).some((l) => l && l.length > 0)

/** Opening hours as short lines, e.g. "Monday 09:00–17:00". */
export function hoursLines(v: OpeningTimesData | null | undefined): string[] {
  return hoursOf(v).days.map((d) => {
    const frames = d.enabled ? d.timeframes : []

    return `${DAY_LABELS[d.day]}: ${
      frames.length
        ? frames.map((t) => `${t.startTime}–${t.endTime}`).join(", ")
        : "closed"
    }`
  })
}

/** Plain-language lines for the review step. */
export function describeChanges(
  c: RecordChanges,
  names: Record<string, string>
): string[] {
  const lines: string[] = []
  const nameOf = (id: string) => names[id] ?? "an option"
  for (const [key, value] of Object.entries(c.changes)) {
    if (key === "openingTimes") {
      lines.push("New opening hours for the week")
      continue
    }
    if (key === "mobileTimetable") {
      lines.push(
        summarizeDiff(
          diffTimetable(
            normalizeMobileTimetable(c.previous.mobileTimetable),
            normalizeMobileTimetable(value)
          )
        )
      )
      continue
    }
    if ((OPTION_KEYS as readonly string[]).includes(key)) {
      const { connect = [], disconnect = [] } = value as {
        connect?: string[]
        disconnect?: string[]
      }
      if (connect.length) lines.push(`Add: ${connect.map(nameOf).join(", ")}`)
      if (disconnect.length)
        lines.push(`Remove: ${disconnect.map(nameOf).join(", ")}`)
      continue
    }
    const label = TEXT_LABELS[key as TextKey] ?? key
    const shown =
      key === "operationalStatus"
        ? (OPERATIONAL_STATUSES.find((o) => o.value === value)?.label ??
          String(value))
        : String(value) || "(remove it)"
    lines.push(`${label}: ${shown}`)
  }
  for (const list of Object.values(c.suggestedOptions))
    if (list?.length) lines.push(`New option: ${list.join(", ")}`)

  return lines
}

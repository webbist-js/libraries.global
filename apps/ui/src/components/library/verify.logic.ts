// "Still right?": a reader confirms parts of a library's record without
// changing them. Pure helpers, no React, so they're unit-testable.

import {
  hasOpeningHours,
  sectionCheckedAt as sharedSectionCheckedAt,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"

import { OPERATIONAL_STATUSES } from "@/app/[locale]/contribute/index/_components/wizard.constants"
import {
  DAY_ORDER,
  DAY_SHORT,
  formatDayTimes,
  type OpeningTimesDay,
} from "@/components/library/library-page.helpers"

/** The sections a verify can confirm, shared with Strapi and the index. */
export { VERIFY_SECTIONS, type VerifySection }

export const SECTION_LABELS: Record<VerifySection, string> = {
  hours: "Opening hours",
  status: "Open or closed",
  address: "Address",
  contact: "Contact details",
}

/** The parts of a library record a verify reads. */
export type VerifyRecord = {
  openingTimes?: unknown
  operationalStatus?: string | null
  streetAddress?: string | null
  city?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
}

const filled = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== ""

const str = (v: unknown): string | null => (typeof v === "string" ? v : null)

/** A verify's fields picked from a library as Strapi returns it. */
export function verifyRecordOf(library: object): VerifyRecord {
  const r = library as Record<string, unknown>

  return {
    openingTimes: r.openingTimes ?? null,
    operationalStatus: str(r.operationalStatus),
    streetAddress: str(r.streetAddress),
    city: str(r.city),
    website: str(r.website),
    phone: str(r.phone),
    email: str(r.email),
  }
}

export const isVerifySection = (v: unknown): v is VerifySection =>
  (VERIFY_SECTIONS as readonly unknown[]).includes(v)

/** The valid sections in `raw`, once each, in VERIFY_SECTIONS order. */
export function toSections(raw: unknown): VerifySection[] {
  const asked = new Set(Array.isArray(raw) ? raw : [])

  return VERIFY_SECTIONS.filter((s) => asked.has(s))
}

/**
 * When a section was last confirmed, by the shared rule (`@repo/shared-data`
 * `sectionCheckedAt`): its own stamp; else, only on a legacy row with no
 * valid stamp at all, `lastVerifiedAt`; else null.
 */
export function sectionCheckedAt(
  library: object,
  section: VerifySection
): string | null {
  return sharedSectionCheckedAt(library, section)
}

/** Only the sections the library has a value for. */
export function availableSections(library: VerifyRecord): VerifySection[] {
  const has: Record<VerifySection, boolean> = {
    hours: hasOpeningHours(library.openingTimes),
    status:
      filled(library.operationalStatus) &&
      library.operationalStatus !== "unknown",
    address: filled(library.streetAddress),
    contact: [library.website, library.phone, library.email].some(filled),
  }

  return VERIFY_SECTIONS.filter((s) => has[s])
}

export function statusLabel(value: unknown): string {
  if (!filled(value)) return ""
  const label = OPERATIONAL_STATUSES.find((o) => o.value === value)?.label

  return label
    ? label.charAt(0) + label.slice(1).toLowerCase()
    : value.replaceAll("_", " ")
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** "Mon 09:00–17:00, Tue 09:00–17:00 …": the first two open days. */
function hoursPreview(openingTimes: unknown): string {
  const days = ((openingTimes as { days?: unknown } | null)?.days ??
    []) as OpeningTimesDay[]
  const open = DAY_ORDER.flatMap((key) => {
    const day = Array.isArray(days) ? days.find((d) => d?.day === key) : null

    return day?.enabled && day.timeframes?.length
      ? [`${DAY_SHORT[key]} ${formatDayTimes(day)}`]
      : []
  })

  return `${open.slice(0, 2).join(", ")}${open.length > 2 ? " …" : ""}`
}

/** One line of what a section says now, shown beside its checkbox. */
export function sectionSummary(
  section: VerifySection,
  library: VerifyRecord
): string {
  switch (section) {
    case "hours":
      return hoursPreview(library.openingTimes)
    case "status":
      return statusLabel(library.operationalStatus)
    case "address":
      return [library.streetAddress, library.city].filter(filled).join(", ")
    case "contact":
      return filled(library.website)
        ? hostOf(library.website)
        : ([library.phone, library.email].find(filled) ?? "")
  }
}

const isWebAddress = (source: string) => /^https?:\/\//i.test(source.trim())

type VerifyInput = {
  readonly sections: readonly VerifySection[]
  /** "Where did you check?": a web address, or blank. */
  readonly source: string
  /** "I checked in person" is ticked. */
  readonly inPerson: boolean
}

/** Why the verify can't be sent yet, or null when it can. */
export function verifyProblem({
  sections,
  source,
  inPerson,
}: VerifyInput): string | null {
  if (sections.length === 0) return "Choose at least one section to confirm."
  const s = source.trim()
  if (!s && !inPerson)
    return "Add the page you checked, or tick “I checked in person”."
  if (s && !isWebAddress(s)) return "The source must be a web address."

  return null
}

/** The field `verifyProblem`'s message is about, for linking it to that field. */
export function verifyProblemField({
  sections,
  source,
  inPerson,
}: VerifyInput): "sections" | "source" | null {
  if (sections.length === 0) return "sections"
  const s = source.trim()

  return (!s && !inPerson) || (s && !isWebAddress(s)) ? "source" : null
}

export type VerifyBody = {
  submissionType: "correction"
  targetEntityType: "library"
  targetSlug: string
  fields: { kind: "verify"; sections: VerifySection[]; libraryName: string }
  evidenceType: "other" | "on_site_visit"
  evidenceUrl?: string
}

/**
 * The /api/submissions body. A visit in person is `on_site_visit` (with the
 * page too, when one was given); otherwise the page is the evidence.
 */
export function verifyPayload({
  slug,
  name,
  sections,
  source,
  inPerson,
}: VerifyInput & {
  readonly slug: string
  readonly name: string
}): VerifyBody {
  const s = source.trim()

  return {
    submissionType: "correction",
    targetEntityType: "library",
    targetSlug: slug,
    fields: {
      kind: "verify",
      sections: toSections(sections),
      libraryName: name,
    },
    evidenceType: inPerson ? "on_site_visit" : "other",
    ...(s && isWebAddress(s) ? { evidenceUrl: s } : {}),
  }
}

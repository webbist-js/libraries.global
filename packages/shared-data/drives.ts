// ── Drives ────────────────────────────────────────────────────────────────────
// Board-run Drives: community gap-filling efforts on the Noticeboard. One
// definition of a Drive's scope and focus — as a Meilisearch filter, as an
// in-scope predicate over a single library, and as the rule that decides
// whether a piece of contributed work fills the focus — so Strapi (lifecycle,
// submission policy, credit) and the UI (progress, task panel) never drift.

import { type GapKey, isGapKey } from "./gaps"
import { type VerifySection, isValidStamp, SECTION_FIELDS } from "./verify"

export const DRIVE_MAX_TASKS = 2000
export const DRIVE_MAX_DAYS = 90
export const DRIVE_MAX_PINNED = 6
export const DRIVE_MAX_LIBRARIES = 500

export const DRIVE_UNITS = ["library", "branch", "record"] as const
export type DriveUnit = (typeof DRIVE_UNITS)[number]

export const DRIVE_STATUSES = [
  "draft",
  "scheduled",
  "open",
  "closed",
  "cancelled",
] as const
export type DriveStatus = (typeof DRIVE_STATUSES)[number]

export const DRIVE_PLACE_LEVELS = [
  "continent",
  "country",
  "region",
  "area",
] as const
export type DrivePlaceLevel = (typeof DRIVE_PLACE_LEVELS)[number]

/** Anything `toUnixSeconds` and the date-bearing fields accept. */
type DateLike = string | Date | null

/** The shared verification module (band 1) names the four sections. */
export type DriveVerifySection = VerifySection

/** The Focus gaps D1's task panel can fill. */
export const PANEL_GAPS = [
  "hours",
  "photo",
  "accessibility",
  "contact",
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriveScope {
  places?: Partial<Record<DrivePlaceLevel, string[]>>
  libraries?: string[]
  libraryTypes?: string[]
  source?: string | null
  completenessBelow?: number | null
}

export type DriveFocus =
  | { kind: "gaps"; gaps: GapKey[] }
  | { kind: "verify"; sections: DriveVerifySection[]; before: string }
  | { kind: "record"; target: number }

export interface DriveLibrary {
  documentId: string
  continent?: string | null
  country?: string | null
  region?: string | null
  area?: string | null
  libraryType?: string | null
  source?: string | null
  completeness?: number | null
  createdAt?: DateLike
  operationalStatus?: string | null
}

export interface DriveInput {
  title: string
  summary: string
  steps: string[]
  focus: DriveFocus
  scope: DriveScope
  unit: DriveUnit
  startsAt: string
  endsAt: string
  goalPercent: number
  whereToLook: { name: string; url: string; licenceNote: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const quoteList = (items: readonly string[]) =>
  `[${items.map((i) => JSON.stringify(i)).join(", ")}]`

function toUnixSeconds(v: DateLike | undefined): number | null {
  if (v == null) return null
  const t = v instanceof Date ? v.getTime() : Date.parse(v)

  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

const nonEmpty = (v: string[] | undefined): v is string[] =>
  Array.isArray(v) && v.length > 0

// ── Filters ───────────────────────────────────────────────────────────────────

/**
 * The Meilisearch filter for every library a Drive can touch: an explicit
 * library list, or the place/type/source/completeness clauses, always
 * excluding permanently closed libraries. Callers add their own locale
 * clause.
 */
export function scopeFilter(
  scope: DriveScope,
  opts?: { openedAt?: DateLike }
): string {
  const clauses: string[] = []

  if (nonEmpty(scope.libraries)) {
    clauses.push(`documentId IN ${quoteList(scope.libraries)}`)
  } else if (scope.places) {
    const placeClauses = DRIVE_PLACE_LEVELS.filter((level) =>
      nonEmpty(scope.places?.[level])
    ).map((level) => `${level}_slug IN ${quoteList(scope.places![level]!)}`)

    if (placeClauses.length === 1) {
      clauses.push(placeClauses[0]!)
    } else if (placeClauses.length > 1) {
      clauses.push(`(${placeClauses.join(" OR ")})`)
    }
  }

  if (nonEmpty(scope.libraryTypes)) {
    clauses.push(`libraryType IN ${quoteList(scope.libraryTypes)}`)
  }
  if (scope.source) {
    clauses.push(`source = ${JSON.stringify(scope.source)}`)
  }
  if (scope.completenessBelow != null) {
    clauses.push(`completeness < ${Math.trunc(scope.completenessBelow)}`)
  }
  const openedTs = toUnixSeconds(opts?.openedAt)
  if (openedTs != null) {
    clauses.push(`created_ts <= ${openedTs}`)
  }
  clauses.push(`operationalStatus != "permanently_closed"`)

  return clauses.join(" AND ")
}

/** The Meilisearch filter for work the Drive's focus still needs. */
export function focusFilter(focus: DriveFocus): string {
  if (focus.kind === "gaps") {
    return `needs IN ${quoteList(focus.gaps)}`
  }
  if (focus.kind === "record") {
    return `completeness < ${Math.trunc(focus.target)}`
  }

  const beforeTs = toUnixSeconds(focus.before)
  const groups = focus.sections.map(
    (s) => `(verified_${s}_ts < ${beforeTs} OR verified_${s}_ts NOT EXISTS)`
  )

  return `(${groups.join(" OR ")})`
}

/** The scope filter and the scope-plus-focus ("to do") filter together. */
export function driveFilters(d: {
  scope: DriveScope
  focus: DriveFocus
  openedAt?: DateLike
}): { scope: string; todo: string } {
  const scope = scopeFilter(d.scope, { openedAt: d.openedAt })

  return { scope, todo: `${scope} AND ${focusFilter(d.focus)}` }
}

// ── Predicates ────────────────────────────────────────────────────────────────

/**
 * The same rules as `scopeFilter`, evaluated against one library record
 * rather than Meilisearch. A missing `createdAt` counts as in scope —
 * Meilisearch excludes it there, but this predicate is only used for credit
 * and policy checks on libraries that are already known.
 */
export function libraryInScope(
  lib: DriveLibrary,
  scope: DriveScope,
  openedAt?: DateLike
): boolean {
  if (lib.operationalStatus === "permanently_closed") return false

  if (nonEmpty(scope.libraries)) {
    if (!scope.libraries.includes(lib.documentId)) return false
  } else if (scope.places) {
    const levels = DRIVE_PLACE_LEVELS.filter((level) =>
      nonEmpty(scope.places?.[level])
    )
    if (
      levels.length > 0 &&
      !levels.some((level) => {
        const val = lib[level]

        return val != null && scope.places![level]!.includes(val)
      })
    ) {
      return false
    }
  }

  if (
    nonEmpty(scope.libraryTypes) &&
    (!lib.libraryType || !scope.libraryTypes.includes(lib.libraryType))
  ) {
    return false
  }
  if (scope.source && lib.source !== scope.source) return false
  if (
    scope.completenessBelow != null &&
    (lib.completeness == null || lib.completeness >= scope.completenessBelow)
  ) {
    return false
  }

  const openedTs = toUnixSeconds(openedAt)
  if (openedTs != null && lib.createdAt != null) {
    const createdTs = toUnixSeconds(lib.createdAt)
    if (createdTs != null && createdTs > openedTs) return false
  }

  return true
}

/** How each Focus gap can be filled: by submission kind, by field, or both. */
const GAP_FILL: Record<GapKey, { kinds?: string[]; fields?: string[] }> = {
  hours: { fields: ["openingTimes"] },
  photo: { kinds: ["photo"], fields: ["uploadedImages"] },
  accessibility: { kinds: ["facilities"], fields: ["accessibility"] },
  contact: { fields: ["website", "phone", "email", "catalogueUrl"] },
  services: { kinds: ["facilities"], fields: ["services", "amenities"] },
  address: { fields: ["streetAddress", "city", "postalCode", "district"] },
  location: { fields: ["lat", "lng"] },
  facilities: {
    kinds: ["facilities"],
    fields: ["accessibility", "services", "amenities"],
  },
  about: { fields: ["summary", "description", "collectionStats"] },
  history: { fields: ["foundedYear", "openedYear"] },
}

const gapMatches = (
  gap: GapKey,
  isRecordKind: boolean,
  kind: string | undefined,
  fields: Record<string, unknown>
): boolean => {
  const rule = GAP_FILL[gap]
  if (rule.kinds && kind && rule.kinds.includes(kind)) return true

  return Boolean(isRecordKind && rule.fields?.some((f) => f in fields))
}

const SECTION_TOUCH_FIELDS: Record<DriveVerifySection, readonly string[]> =
  SECTION_FIELDS

/**
 * Whether a piece of contributed work (a Submission's type and payload
 * fields) fills a Drive's focus. The "closed or moved" rule comes first: a
 * record-level edit that changes the operational status or street address
 * counts as progress against any focus, since the record moved on from
 * whatever the Drive was chasing.
 */
export function focusMatches(
  focus: DriveFocus,
  s: { submissionType: string; fields: unknown }
): boolean {
  const fields = (
    s.fields && typeof s.fields === "object" ? s.fields : {}
  ) as Record<string, unknown>
  const kind = typeof fields.kind === "string" ? fields.kind : undefined
  const isLibraryEdit = s.submissionType === "library_edit"
  const isRecordKind = kind === "record" || isLibraryEdit

  if (
    isRecordKind &&
    ("operationalStatus" in fields || "streetAddress" in fields)
  ) {
    return true
  }

  if (focus.kind === "gaps") {
    return focus.gaps.some((gap) => gapMatches(gap, isRecordKind, kind, fields))
  }

  if (focus.kind === "verify") {
    if (s.submissionType === "correction" && kind === "verify") {
      const sections = Array.isArray(fields.sections) ? fields.sections : []
      if (focus.sections.some((sec) => sections.includes(sec))) return true
    }

    return (
      isRecordKind &&
      focus.sections.some((sec) =>
        SECTION_TOUCH_FIELDS[sec].some((f) => f in fields)
      )
    )
  }

  // focus.kind === "record"
  if (isRecordKind) return true

  return (
    s.submissionType === "correction" &&
    (kind === "photo" || kind === "facilities")
  )
}

// ── Validation ────────────────────────────────────────────────────────────────

const lenOk = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.trim().length >= min && v.length <= max

const hasPlacesOrLibraries = (scope: DriveScope): boolean =>
  nonEmpty(scope.libraries) ||
  DRIVE_PLACE_LEVELS.some((level) => nonEmpty(scope.places?.[level]))

/** The problems with a Drive's editable fields, in a fixed, user-facing order. */
export function validateDrive(input: DriveInput, now: Date): string[] {
  // `now` matches the shared signature (and future `startsAt`-vs-now rules);
  // nothing below the date rule yet needs it.
  const errors: string[] = []

  if (!lenOk(input.title, 3, 120)) {
    errors.push("Give the drive a title of 3 to 120 characters.")
  }
  if (!lenOk(input.summary, 10, 280)) {
    errors.push("Write a summary of 10 to 280 characters.")
  }
  if (
    !Array.isArray(input.steps) ||
    input.steps.length < 1 ||
    input.steps.length > 5 ||
    !input.steps.every((step) => lenOk(step, 1, 200))
  ) {
    errors.push("Add one to five steps, each under 200 characters.")
  }

  // `input` comes from an untrusted request body at the Strapi layer, cast
  // to `DriveInput` before it reaches here — `focus` and `scope` can
  // genuinely be missing or malformed at runtime despite the type saying
  // otherwise, so both are re-checked as `unknown` rather than trusted.
  const rawFocus = input.focus as unknown
  const focus: DriveFocus | null =
    rawFocus && typeof rawFocus === "object" && !Array.isArray(rawFocus)
      ? (rawFocus as DriveFocus)
      : null
  if (!focus) {
    errors.push("Choose what the drive is for.")
  } else {
    switch (focus.kind) {
      case "gaps":
        if (
          !Array.isArray(focus.gaps) ||
          focus.gaps.length < 1 ||
          focus.gaps.length > 3 ||
          !focus.gaps.every(isGapKey)
        ) {
          errors.push("Choose one to three gaps to fill.")
        }

        break

      case "verify":
        if (
          !Array.isArray(focus.sections) ||
          focus.sections.length < 1 ||
          !isValidStamp(focus.before)
        ) {
          errors.push("Choose the sections to confirm and a date.")
        }

        break

      case "record":
        if (
          typeof focus.target !== "number" ||
          focus.target < 50 ||
          focus.target > 100
        ) {
          errors.push("Set a completeness target between 50 and 100.")
        }

        break

      default:
        errors.push("Choose what the drive is for.")
    }
  }

  const rawScope = input.scope as unknown
  const scope: DriveScope | null =
    rawScope && typeof rawScope === "object" && !Array.isArray(rawScope)
      ? (rawScope as DriveScope)
      : null
  if (!scope || !hasPlacesOrLibraries(scope)) {
    errors.push("Limit the drive to places or to a list of libraries.")
  }
  if (
    scope &&
    nonEmpty(scope.libraries) &&
    scope.libraries.length > DRIVE_MAX_LIBRARIES
  ) {
    errors.push("A list can hold at most 500 libraries.")
  }

  if (!(DRIVE_UNITS as readonly string[]).includes(input.unit)) {
    errors.push("Choose a unit.")
  }

  const starts = Date.parse(input.startsAt)
  const ends = Date.parse(input.endsAt)
  if (!Number.isFinite(starts)) errors.push("Give a valid start date.")
  if (!Number.isFinite(ends)) errors.push("Give a valid end date.")
  if (Number.isFinite(starts) && Number.isFinite(ends)) {
    if (ends <= starts) {
      errors.push("The drive must end after it starts.")
    } else if (ends - starts > DRIVE_MAX_DAYS * 86400000) {
      errors.push("A drive can run for at most 90 days.")
    }
  }

  if (
    typeof input.goalPercent !== "number" ||
    input.goalPercent < 1 ||
    input.goalPercent > 100
  ) {
    errors.push("Set a goal between 1% and 100%.")
  }

  const url = input.whereToLook?.url
  if (url && !/^https?:\/\//i.test(url)) {
    errors.push("The source link must be a web address.")
  }

  return errors
}

// ── Dates & progress ──────────────────────────────────────────────────────────

// A fixed three-letter table rather than `Intl.DateTimeFormat`: ICU data
// varies by Node build ("Sept" vs "Sep"), and the card wants the short form.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const fmtDate = (v: string | Date) => {
  const d = new Date(v)

  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** How a Drive's dates read on a card: a plain countdown, or a warning close in. */
export function driveDateLabel(
  d: {
    status: DriveStatus
    startsAt: string
    endsAt: string
    closedAt?: string | null
  },
  now: Date
): { text: string; tone: "plain" | "warn" } {
  if (d.status === "closed" || d.status === "cancelled") {
    return { text: `Closed ${fmtDate(d.closedAt ?? d.endsAt)}`, tone: "plain" }
  }
  if (d.status === "scheduled" || d.status === "draft") {
    return { text: `Opens ${fmtDate(d.startsAt)}`, tone: "plain" }
  }

  const days = Math.ceil(
    (new Date(d.endsAt).getTime() - now.getTime()) / 86_400_000
  )

  if (days <= 0) return { text: "Ends today", tone: "warn" }
  if (days <= 7) {
    return { text: `${days} day${days === 1 ? "" : "s"} left`, tone: "warn" }
  }
  if (days <= 14) return { text: `${days} days left`, tone: "plain" }

  return { text: `Ends ${fmtDate(d.endsAt)}`, tone: "plain" }
}

/** Coverage and goal maths from a drive's to-do and in-review counts. */
export function driveProgress(
  c: { total: number; todo: number; inReview: number },
  goalPercent: number
): {
  total: number
  done: number
  todo: number
  inReview: number
  percent: number
  goalMet: boolean
} {
  const done = Math.max(0, c.total - c.todo)
  const percent = c.total ? Math.round((done / c.total) * 100) : 0
  const goalMet = c.total > 0 && (done / c.total) * 100 >= goalPercent

  return {
    total: c.total,
    done,
    todo: c.todo,
    inReview: c.inReview,
    percent,
    goalMet,
  }
}

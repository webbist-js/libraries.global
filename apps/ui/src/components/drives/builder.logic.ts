/**
 * The drive builder's rules, kept pure so the form and its tests share them:
 * the form's state, its mapping to the shared `DriveInput`, the pasted
 * library list, and `validateDrive`'s messages linked back to the fields
 * they're about (spec §5.7, board mode).
 */
import {
  checkLink,
  checkText,
  DRIVE_MAX_LIBRARIES,
  DRIVE_MAX_TASKS,
  DRIVE_PLACE_LEVELS,
  type DriveFocus,
  type DriveInput,
  type DrivePlaceLevel,
  type DriveScope,
  type DriveUnit,
  type GapKey,
  validateDrive,
} from "@repo/shared-data"

import type { Drive, DriveSource } from "@/lib/drives/types"
import { nameFromSlug } from "@/lib/find-places"

/** One place the drive covers, as a removable chip. */
export interface BuilderPlace {
  level: DrivePlaceLevel
  slug: string
  name: string
  /** What the country calls this level ("State", "County"), when known. */
  kind?: string
}

/** The form as typed: numbers and dates stay strings until `toDriveInput`. */
export interface BuilderState {
  gaps: GapKey[]
  places: BuilderPlace[]
  libraryTypes: string[]
  /** A Dataset key; blank means any source. */
  source: string
  /** "Only libraries below N% complete"; blank means no ceiling. */
  completenessBelow: string
  /** Slugs or documentIds, one per line; when set, it replaces the places. */
  libraryList: string
  whereName: string
  whereUrl: string
  whereLicence: string
  title: string
  summary: string
  steps: string[]
  /** `YYYY-MM-DD` (UTC): the drive opens at the start of this day. */
  startsOn: string
  /** `YYYY-MM-DD` (UTC): the drive closes at the end of this day. */
  endsOn: string
  goalPercent: string
  unit: DriveUnit
}

/** Every field an error can point at, in the order the form shows them. */
export const BUILDER_FIELDS = [
  "focus",
  "places",
  "libraryTypes",
  "source",
  "completenessBelow",
  "libraries",
  "whereName",
  "whereUrl",
  "whereLicence",
  "title",
  "summary",
  "steps",
  "startsOn",
  "endsOn",
  "goalPercent",
  "unit",
] as const

export type BuilderField = (typeof BUILDER_FIELDS)[number]

export interface FieldError {
  /** The field it's about; null for a problem with the whole drive. */
  field: BuilderField | null
  message: string
}

/** The element id a field's control (or group) carries, for summary links. */
export const fieldId = (field: BuilderField) => `drive-${field}`

/** A new drive runs this many days, counting both ends. */
export const DEFAULT_DRIVE_DAYS = 30

const DAY_MS = 86_400_000

/** A date as `YYYY-MM-DD` in UTC. */
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** `YYYY-MM-DD` of an ISO timestamp; "" when it isn't a date. */
function dayOf(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : Number.NaN

  return Number.isFinite(t) ? isoDay(new Date(t)) : ""
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const validDay = (day: string) =>
  DAY_PATTERN.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`))

/** The start of a day (UTC), as the drive's `startsAt`; "" when not a day. */
const startOfDay = (day: string) =>
  validDay(day) ? `${day}T00:00:00.000Z` : ""

/** The end of a day (UTC), as the drive's `endsAt`; "" when not a day. */
const endOfDay = (day: string) => (validDay(day) ? `${day}T23:59:59.000Z` : "")

/** A new drive's form: it starts today and runs `DEFAULT_DRIVE_DAYS`. */
export function emptyBuilderState(now: Date = new Date()): BuilderState {
  return {
    gaps: [],
    places: [],
    libraryTypes: [],
    source: "",
    completenessBelow: "",
    libraryList: "",
    whereName: "",
    whereUrl: "",
    whereLicence: "",
    title: "",
    summary: "",
    steps: [""],
    startsOn: isoDay(now),
    endsOn: isoDay(new Date(now.getTime() + (DEFAULT_DRIVE_DAYS - 1) * DAY_MS)),
    goalPercent: "100",
    unit: "library",
  }
}

// ── The library list ─────────────────────────────────────────────────────────

/** Strapi v5 documentIds (as `lib/bridge-params`). */
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface LibraryList {
  /** Every usable ref, in order, without repeats. */
  refs: string[]
  documentIds: string[]
  slugs: string[]
  /** Pieces that are neither a slug nor a documentId. */
  invalid: string[]
  /** More than `DRIVE_MAX_LIBRARIES` refs. */
  overLimit: boolean
}

/** A pasted link or path to a library page becomes its last segment. */
function refOf(token: string): string {
  if (!token.includes("/")) return token.toLowerCase()
  const path = token.split(/[?#]/)[0] ?? ""

  return (path.split("/").findLast(Boolean) ?? "").toLowerCase()
}

/**
 * The libraries pasted into the list: one per line (commas and spaces work
 * too), as slugs, documentIds or links to library pages.
 */
export function parseLibraryList(text: string): LibraryList {
  const refs: string[] = []
  const invalid: string[] = []
  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue
    const ref = refOf(token)
    if (!ref) continue
    const into = DOCUMENT_ID.test(ref) || SLUG.test(ref) ? refs : invalid
    const shown = into === refs ? ref : token
    if (!into.includes(shown)) into.push(shown)
  }

  return {
    refs,
    documentIds: refs.filter((r) => DOCUMENT_ID.test(r)),
    slugs: refs.filter((r) => !DOCUMENT_ID.test(r)),
    invalid,
    overLimit: refs.length > DRIVE_MAX_LIBRARIES,
  }
}

// ── Mapping to a DriveInput ──────────────────────────────────────────────────

/** A whole number from a text field; null for blank or anything else. */
function wholeNumber(text: string): number | null {
  const t = text.trim()

  return /^\d{1,3}$/.test(t) ? Number(t) : null
}

/** The places grouped by level, broadest first, without repeats. */
function placesOf(places: readonly BuilderPlace[]): DriveScope["places"] {
  const out: Partial<Record<DrivePlaceLevel, string[]>> = {}
  for (const level of DRIVE_PLACE_LEVELS) {
    const slugs = [
      ...new Set(places.filter((p) => p.level === level).map((p) => p.slug)),
    ]
    if (slugs.length > 0) out[level] = slugs
  }

  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * The Drive Scope: a pasted list (or its resolved documentIds) replaces the
 * places; types, Dataset and ceiling apply either way.
 */
function scopeOf(
  state: BuilderState,
  libraries?: readonly string[]
): DriveScope {
  const refs = libraries ?? parseLibraryList(state.libraryList).refs
  const scope: DriveScope = {}
  if (refs.length > 0) {
    scope.libraries = [...refs]
  } else {
    const places = placesOf(state.places)
    if (places) scope.places = places
  }
  if (state.libraryTypes.length > 0)
    scope.libraryTypes = [...state.libraryTypes]
  const source = state.source.trim()
  if (source) scope.source = source
  const ceiling = wholeNumber(state.completenessBelow)
  if (ceiling !== null) scope.completenessBelow = ceiling

  return scope
}

const focusOf = (state: BuilderState): DriveFocus => ({
  kind: "gaps",
  gaps: [...state.gaps],
})

/**
 * The builder as the shared `DriveInput`. `libraries` replaces the pasted
 * list with the documentIds the server resolved it to.
 */
export function toDriveInput(
  state: BuilderState,
  opts: { libraries?: readonly string[] } = {}
): DriveInput {
  return {
    title: state.title.trim(),
    summary: state.summary.trim(),
    steps: state.steps.map((s) => s.trim()).filter(Boolean),
    focus: focusOf(state),
    scope: scopeOf(state, opts.libraries),
    unit: state.unit,
    startsAt: startOfDay(state.startsOn),
    endsAt: endOfDay(state.endsOn),
    // Not a whole number: 0, which the goal rule refuses.
    goalPercent: wholeNumber(state.goalPercent) ?? 0,
    whereToLook: {
      name: state.whereName.trim(),
      url: state.whereUrl.trim(),
      licenceNote: state.whereLicence.trim(),
    },
  }
}

/** The fields Strapi lets the board change once a drive has opened. */
export function textOnlyInput(
  input: DriveInput
): Pick<DriveInput, "title" | "summary" | "steps" | "whereToLook"> {
  return {
    title: input.title,
    summary: input.summary,
    steps: input.steps,
    whereToLook: input.whereToLook,
  }
}

/** The builder filled from a saved drive. `placeNames` keys `level:slug`. */
export function builderStateFromDrive(
  drive: Drive,
  placeNames: ReadonlyMap<string, string> = new Map()
): BuilderState {
  const scope: DriveScope = drive.scope ?? {}
  const places = DRIVE_PLACE_LEVELS.flatMap((level) =>
    (scope.places?.[level] ?? []).map((slug) => ({
      level,
      slug,
      name: placeNames.get(`${level}:${slug}`) ?? nameFromSlug(slug),
    }))
  )
  const where: DriveSource = drive.whereToLook ?? {}

  return {
    gaps: drive.focus?.kind === "gaps" ? [...drive.focus.gaps] : [],
    places,
    libraryTypes: [...(scope.libraryTypes ?? [])],
    source: scope.source ?? "",
    completenessBelow:
      scope.completenessBelow == null ? "" : String(scope.completenessBelow),
    libraryList: (scope.libraries ?? []).join("\n"),
    whereName: where.name ?? "",
    whereUrl: where.url ?? "",
    whereLicence: where.licenceNote ?? "",
    title: drive.title ?? "",
    summary: drive.summary ?? "",
    steps:
      drive.steps?.length > 0 ? drive.steps.map((s) => s.text ?? "") : [""],
    startsOn: dayOf(drive.startsAt),
    endsOn: dayOf(drive.endsAt),
    goalPercent: String(drive.goalPercent ?? 100),
    unit: drive.unit ?? "library",
  }
}

// ── Errors ───────────────────────────────────────────────────────────────────

/** `validateDrive`'s (and Strapi's) messages, by the field each is about. */
const MESSAGE_FIELDS: [prefix: string, field: BuilderField][] = [
  ["Give the drive a title", "title"],
  ["Write a summary", "summary"],
  ["Add one to five steps", "steps"],
  ["Choose what the drive is for", "focus"],
  ["Choose one to three gaps", "focus"],
  ["Limit the drive to places", "places"],
  ["A list can hold at most", "libraries"],
  ["These libraries weren", "libraries"],
  ["Choose a unit", "unit"],
  ["Give a valid start date", "startsOn"],
  ["Give a valid end date", "endsOn"],
  ["The drive must end after it starts", "endsOn"],
  ["A drive can run for at most", "endsOn"],
  ["Set a goal between", "goalPercent"],
  ["The source link must be", "whereUrl"],
]

/** The field a validation message is about; null when it isn't one field's. */
export function fieldOfMessage(message: string): BuilderField | null {
  return (
    MESSAGE_FIELDS.find(([prefix]) => message.startsWith(prefix))?.[1] ?? null
  )
}

const COMPLETENESS_MESSAGE = "Give a completeness between 1% and 100%."

const listed = (items: readonly string[]) => items.join(", ")

/** Content-safety problems in the words, by field. */
function safetyErrors(state: BuilderState): FieldError[] {
  const errors: FieldError[] = []
  const text = (field: BuilderField, value: string) => {
    const issue = checkText(value)
    if (issue) errors.push({ field, message: issue })
  }
  text("whereName", state.whereName)
  const url = state.whereUrl.trim()
  if (/^https?:\/\//i.test(url)) {
    const issue = checkLink(url)
    if (issue) errors.push({ field: "whereUrl", message: issue })
  }
  text("whereLicence", state.whereLicence)
  text("title", state.title)
  text("summary", state.summary)
  const step = state.steps.map((s) => checkText(s)).find(Boolean)
  if (step) errors.push({ field: "steps", message: step })

  return errors
}

const ORDER = new Map<BuilderField | null, number>(
  BUILDER_FIELDS.map((f, i) => [f, i])
)
const rank = (e: FieldError) => ORDER.get(e.field) ?? BUILDER_FIELDS.length

/**
 * Everything wrong with the builder, in form order: `validateDrive`'s rules,
 * the ceiling and the pasted list, libraries the preview couldn't find, and
 * the content-safety matcher on the words.
 */
export function builderErrors(
  state: BuilderState,
  now: Date,
  extra: { unknownLibraries?: readonly string[] } = {}
): FieldError[] {
  const errors: FieldError[] = validateDrive(toDriveInput(state), now).map(
    (message) => ({ field: fieldOfMessage(message), message })
  )

  const ceiling = state.completenessBelow.trim()
  if (ceiling) {
    const n = wholeNumber(ceiling)
    if (n === null || n < 1 || n > 100) {
      errors.push({ field: "completenessBelow", message: COMPLETENESS_MESSAGE })
    }
  }

  const list = parseLibraryList(state.libraryList)
  if (list.invalid.length > 0) {
    errors.push({
      field: "libraries",
      message: `These lines aren’t library slugs or documentIds: ${listed(list.invalid)}.`,
    })
  }
  if (extra.unknownLibraries?.length) {
    errors.push({
      field: "libraries",
      message: `These libraries weren’t found: ${listed(extra.unknownLibraries)}.`,
    })
  }

  errors.push(...safetyErrors(state))

  return errors
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i)
    .map(({ e }) => e)
}

const SAVE_FAILED = "The drive couldn’t be saved. Try again."

/**
 * A failed response's errors: Strapi's `error.details.errors` (the same
 * `validateDrive` messages), else its message, linked to fields.
 */
export function errorsFromResponse(json: unknown): FieldError[] {
  const error = (json as { error?: unknown } | null)?.error
  if (typeof error === "string" && error)
    return [{ field: null, message: error }]
  const e = (error ?? {}) as {
    message?: unknown
    details?: { errors?: unknown }
  }
  const raw = e.details?.errors
  const list = Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === "string")
    : []
  if (list.length > 0) {
    return list.map((message) => ({ field: fieldOfMessage(message), message }))
  }
  if (typeof e.message === "string" && e.message) {
    return [{ field: fieldOfMessage(e.message), message: e.message }]
  }

  return [{ field: null, message: SAVE_FAILED }]
}

// ── Live counts ──────────────────────────────────────────────────────────────

export interface PreviewRequest {
  scope: DriveScope
  focus: DriveFocus
}

/**
 * What `/api/drives/preview` counts, or null while the builder can't be
 * counted yet: no gap, nowhere to look, or a ceiling or list it can't read.
 * A pasted list goes as typed; the server resolves its slugs.
 */
export function previewRequest(state: BuilderState): PreviewRequest | null {
  if (state.gaps.length === 0) return null
  const list = parseLibraryList(state.libraryList)
  if (list.invalid.length > 0 || list.overLimit) return null
  if (list.refs.length === 0 && state.places.length === 0) return null
  const ceiling = state.completenessBelow.trim()
  if (ceiling) {
    const n = wholeNumber(ceiling)
    if (n === null || n < 1 || n > 100) return null
  }

  return { scope: scopeOf(state), focus: focusOf(state) }
}

const fmt = (n: number) => n.toLocaleString("en-GB")

/** "251 in scope, 109 to do". */
export const countsLine = (c: { total: number; todo: number }) =>
  `${fmt(c.total)} in scope, ${fmt(c.todo)} to do`

/** More to do than a drive may open with. */
export const isTooBig = (c: { todo: number }) => c.todo > DRIVE_MAX_TASKS

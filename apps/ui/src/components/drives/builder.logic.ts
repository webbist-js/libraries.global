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
  DRIVE_UNITS,
  type DriveFocus,
  driveProgress,
  type DriveInput,
  type DrivePlaceLevel,
  type DriveScope,
  type DriveUnit,
  type GapKey,
  isGapKey,
  PANEL_FOCUS_MESSAGE,
  PANEL_GAPS,
  validateDrive,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"

import { SECTION_LABELS } from "@/components/library/verify.logic"
import type { DriveView, PlaceNames } from "@/lib/drives/drive-view"
import type { ProposePrefill } from "@/lib/drives/propose-link"
import type { Drive, DriveSource } from "@/lib/drives/types"
import { nameFromSlug } from "@/lib/find-places"

import type { DriveDiscussionSetup } from "./DriveDiscussionOptions"
import { FOCUS_META, type PanelGap } from "./focus-meta"

/**
 * The board writes drives directly; anyone else's builder sends a Drive
 * Proposal for a Moderator to review (spec §5.7).
 */
export type BuilderMode = "board" | "propose"

/** "Anything the Moderator should know?": at most this many characters. */
export const PROPOSAL_NOTE_MAX = 1000

/** A proposal starts this many days from today, so it can be reviewed first. */
export const PROPOSAL_LEAD_DAYS = 7

/** One place the drive covers, as a removable chip. */
export interface BuilderPlace {
  level: DrivePlaceLevel
  slug: string
  name: string
  /** What the country calls this level ("State", "County"), when known. */
  kind?: string
}

/** What a drive does: fill gaps, confirm sections, or complete whole records. */
export type FocusKind = DriveFocus["kind"]

/**
 * Where helpers look: each library's own website (no fields), a public
 * dataset, or another source (both with a name, link and licence note).
 * The form's choice only; the drive stores `whereToLook` as before.
 */
export type WhereKind = "website" | "dataset" | "other"

export const WHERE_KINDS: readonly WhereKind[] = ["website", "dataset", "other"]

/** The source name a "Each library's own website" drive carries. */
export const WEBSITE_SOURCE = "Each library’s own website"

/** The form as typed: numbers and dates stay strings until `toDriveInput`. */
export interface BuilderState {
  discussions?: DriveDiscussionSetup
  focusKind: FocusKind
  gaps: GapKey[]
  /** A verify drive's sections to confirm, from `VERIFY_SECTIONS`. */
  verifySections: VerifySection[]
  /** `YYYY-MM-DD` (UTC): a verify drive asks after sections not confirmed since this day. */
  verifyBefore: string
  /** A whole-record drive's completeness target (50 to 100), as typed. */
  recordTarget: string
  places: BuilderPlace[]
  libraryTypes: string[]
  /** A Dataset key; blank means any source. */
  source: string
  /** "Only libraries below N% complete"; blank means no ceiling. */
  completenessBelow: string
  /** Slugs or documentIds, one per line; when set, it replaces the places. */
  libraryList: string
  whereKind: WhereKind
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
  "verifySections",
  "verifyBefore",
  "recordTarget",
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

/** "Runs for": the lengths a drive can run, counting both ends. */
export const RUN_CHOICES: readonly { days: number; label: string }[] = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
]

/** A new drive runs this many days (4 weeks), counting both ends. */
export const DEFAULT_DRIVE_DAYS = 28

/** "Goal": the shares of the scope a drive can aim for. */
export const GOAL_CHOICES: readonly { percent: number; label: string }[] = [
  { percent: 50, label: "50%" },
  { percent: 75, label: "75%" },
  { percent: 100, label: "All of them" },
]

/** A whole-record drive's completeness targets, as pills. */
export const RECORD_TARGET_CHOICES: readonly number[] = [50, 75, 90, 100]

/** A new verify drive asks after sections not confirmed for this many days. */
export const DEFAULT_VERIFY_DAYS = 365

/** A new verify drive's sections. */
export const DEFAULT_VERIFY_SECTIONS: readonly VerifySection[] = [
  "hours",
  "status",
]

/** A new whole-record drive's completeness target. */
export const DEFAULT_RECORD_TARGET = "75"

/** A whole-record target's bounds, as `validateDrive` checks them. */
export const RECORD_TARGET_MIN = 50
export const RECORD_TARGET_MAX = 100

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

/** `YYYY-MM-DD` (UTC) today: the latest "not confirmed since" a verify drive takes. */
export const todayDay = (now: Date = new Date()) => isoDay(now)

/** The Focus fields of a new drive: gaps chosen, the others at their defaults. */
function defaultFocusFields(
  now: Date
): Pick<
  BuilderState,
  "focusKind" | "gaps" | "verifySections" | "verifyBefore" | "recordTarget"
> {
  return {
    focusKind: "gaps",
    gaps: [],
    verifySections: [...DEFAULT_VERIFY_SECTIONS],
    verifyBefore: isoDay(
      new Date(now.getTime() - DEFAULT_VERIFY_DAYS * DAY_MS)
    ),
    recordTarget: DEFAULT_RECORD_TARGET,
  }
}

const isVerifySection = (v: unknown): v is VerifySection =>
  typeof v === "string" && (VERIFY_SECTIONS as readonly string[]).includes(v)

/**
 * A saved or prefilled Focus as the builder's fields: the chosen kind's own
 * values, every other kind's at its default.
 */
function focusFieldsOf(
  focus: DriveFocus | null | undefined,
  now: Date
): ReturnType<typeof defaultFocusFields> {
  const fields = defaultFocusFields(now)
  if (!focus) return fields

  switch (focus.kind) {
    case "verify": {
      const sections = Array.isArray(focus.sections)
        ? [...new Set(focus.sections.filter(isVerifySection))]
        : []

      return {
        ...fields,
        focusKind: "verify",
        verifySections: sections,
        verifyBefore: dayOf(focus.before) || fields.verifyBefore,
      }
    }
    case "record":
      return {
        ...fields,
        focusKind: "record",
        recordTarget:
          typeof focus.target === "number" && Number.isFinite(focus.target)
            ? String(focus.target)
            : fields.recordTarget,
      }
    case "gaps":
      return { ...fields, gaps: [...(focus.gaps ?? [])] }

    default:
      return fields
  }
}

/** A new drive's form: it starts today and runs `DEFAULT_DRIVE_DAYS`. */
export function emptyBuilderState(now: Date = new Date()): BuilderState {
  return {
    ...defaultFocusFields(now),
    places: [],
    libraryTypes: [],
    source: "",
    completenessBelow: "",
    libraryList: "",
    whereKind: "website",
    whereName: WEBSITE_SOURCE,
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

/** A proposal's dates: from `PROPOSAL_LEAD_DAYS` ahead, for `DEFAULT_DRIVE_DAYS`. */
function proposalDates(now: Date): Pick<BuilderState, "startsOn" | "endsOn"> {
  const starts = now.getTime() + PROPOSAL_LEAD_DAYS * DAY_MS

  return {
    startsOn: isoDay(new Date(starts)),
    endsOn: isoDay(new Date(starts + (DEFAULT_DRIVE_DAYS - 1) * DAY_MS)),
  }
}

/**
 * The builder filled from a link's prefill (`propose-link.ts`): its Focus
 * (gaps, sections to confirm since a date, or a completeness target), its
 * places (named from `names`, else from the slug), types, Dataset and
 * ceiling. A proposal starts `PROPOSAL_LEAD_DAYS` from today and runs
 * `DEFAULT_DRIVE_DAYS`; the board's keeps the new drive's dates.
 */
export function builderStateFromPrefill(
  prefill: ProposePrefill,
  names: PlaceNames,
  mode: BuilderMode,
  now: Date = new Date()
): BuilderState {
  const state = emptyBuilderState(now)
  const places = DRIVE_PLACE_LEVELS.flatMap((level) =>
    (prefill.places?.[level] ?? []).map((slug) => ({
      level,
      slug,
      name: names.get(`${level}:${slug}`)?.name ?? nameFromSlug(slug),
    }))
  )

  return {
    ...state,
    ...(mode === "propose" ? proposalDates(now) : {}),
    ...(prefill.focus ? focusFieldsOf(prefill.focus, now) : {}),
    gaps: [...(prefill.gaps ?? [])],
    places,
    libraryTypes: [...(prefill.libraryTypes ?? [])],
    source: prefill.source ?? "",
    completenessBelow:
      prefill.completenessBelow == null
        ? ""
        : String(prefill.completenessBelow),
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

  return path
    .split("/")
    .reduce((last, segment) => segment || last, "")
    .toLowerCase()
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

/** The Focus the builder describes, by the kind chosen. */
function focusOf(state: BuilderState): DriveFocus {
  switch (state.focusKind) {
    case "verify":
      return {
        kind: "verify",
        sections: [...state.verifySections],
        before: `${state.verifyBefore}T00:00:00.000Z`,
      }
    case "record":
      return { kind: "record", target: Number(state.recordTarget) }

    default:
      return { kind: "gaps", gaps: [...state.gaps] }
  }
}

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
    ...focusFieldsOf(drive.focus, new Date()),
    places,
    libraryTypes: [...(scope.libraryTypes ?? [])],
    source: scope.source ?? "",
    completenessBelow:
      scope.completenessBelow == null ? "" : String(scope.completenessBelow),
    libraryList: (scope.libraries ?? []).join("\n"),
    whereKind: whereKindOf(where),
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
  ["Choose the sections to confirm and a date", "verifySections"],
  ["Set a completeness target between", "recordTarget"],
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
  [PANEL_FOCUS_MESSAGE, "focus"],
  ["List libraries by their id", "libraries"],
  ["No library in this scope has that gap", "places"],
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
export function errorsFromResponse(
  json: unknown,
  fallback: string = SAVE_FAILED
): FieldError[] {
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

  return [{ field: null, message: fallback }]
}

// ── Live counts ──────────────────────────────────────────────────────────────

export interface PreviewRequest {
  scope: DriveScope
  focus: DriveFocus
}

/** Whether the chosen Focus can be counted: a gap, a section and a date, or a target. */
function focusCountable(state: BuilderState): boolean {
  switch (state.focusKind) {
    case "verify":
      return state.verifySections.length > 0 && validDay(state.verifyBefore)
    case "record": {
      const target = wholeNumber(state.recordTarget)

      return (
        target !== null &&
        target >= RECORD_TARGET_MIN &&
        target <= RECORD_TARGET_MAX
      )
    }

    default:
      return state.gaps.length > 0
  }
}

/**
 * What `/api/drives/preview` counts, or null while the builder can't be
 * counted yet: no Focus to count (a section and a date, or a target),
 * nowhere to look, or a ceiling or list it can't read. A gaps drive with no
 * gap chosen yet still counts its scope (`gaps: []`), so the gap chips can
 * show how many libraries miss each one. A pasted list goes as typed; the
 * server resolves its slugs.
 */
export function previewRequest(state: BuilderState): PreviewRequest | null {
  const scopeOnly = state.focusKind === "gaps" && state.gaps.length === 0
  if (!scopeOnly && !focusCountable(state)) return null
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

// ── Runs for and goal ────────────────────────────────────────────────────────

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)

/**
 * The last day of a drive that starts on `startsOn` and runs `days` days,
 * counting both ends; "" when `startsOn` isn't a day.
 */
export function endsOnFor(startsOn: string, days: number): string {
  if (!validDay(startsOn)) return ""

  return isoDay(new Date(dayMs(startsOn) + (days - 1) * DAY_MS))
}

/** How many days the drive runs, counting both ends; null without two days in order. */
export function runDaysOf(
  state: Pick<BuilderState, "startsOn" | "endsOn">
): number | null {
  if (!validDay(state.startsOn) || !validDay(state.endsOn)) return null
  const days =
    Math.round((dayMs(state.endsOn) - dayMs(state.startsOn)) / DAY_MS) + 1

  return days >= 1 ? days : null
}

/**
 * A new start day that keeps how long the drive runs (4 weeks when that
 * can't be read): "Runs for" is the only end-date control.
 */
export function withStartsOn(
  state: Pick<BuilderState, "startsOn" | "endsOn">,
  startsOn: string
): Pick<BuilderState, "startsOn" | "endsOn"> {
  const days = runDaysOf(state) ?? DEFAULT_DRIVE_DAYS

  return { startsOn, endsOn: endsOnFor(startsOn, days) || state.endsOn }
}

/**
 * How many of the libraries to do must be done to meet the goal. The goal
 * is a share of every library in scope (`driveProgress`), so libraries
 * already done count towards it: 0 means it's met before the drive opens.
 */
export function goalCount(
  counts: { total: number; todo: number },
  goalPercent: number
): number {
  const needed =
    Math.ceil((counts.total * goalPercent) / 100) - (counts.total - counts.todo)

  return Math.min(counts.todo, Math.max(0, needed))
}

// ── Where to look ────────────────────────────────────────────────────────────

const plainApostrophes = (s: string) => s.replaceAll("’", "'").trim()

/**
 * The "Where should helpers look?" choice a saved source reads as: the
 * library's own website when it names it (or nothing) without a link,
 * else another source.
 */
export function whereKindOf(where: DriveSource): WhereKind {
  const name = plainApostrophes(where.name ?? "")
  const url = (where.url ?? "").trim()
  const licence = (where.licenceNote ?? "").trim()
  if (url) return "other"
  if (!name && !licence) return "website"

  return name === plainApostrophes(WEBSITE_SOURCE) ? "website" : "other"
}

/**
 * The source fields for a new choice: the website names itself with no
 * link or note; leaving it clears its name for the one the user types.
 */
export function whereFieldsFor(
  state: Pick<
    BuilderState,
    "whereKind" | "whereName" | "whereUrl" | "whereLicence"
  >,
  kind: WhereKind
): Pick<BuilderState, "whereKind" | "whereName" | "whereUrl" | "whereLicence"> {
  if (kind === "website") {
    return {
      whereKind: kind,
      whereName: WEBSITE_SOURCE,
      whereUrl: "",
      whereLicence: "",
    }
  }
  if (state.whereKind === "website") {
    return { whereKind: kind, whereName: "", whereUrl: "", whereLicence: "" }
  }

  return { ...state, whereKind: kind }
}

// ── Drafted words ────────────────────────────────────────────────────────────

/** The words the builder drafts until the user writes their own. */
export type DraftField = "title" | "summary" | "steps"

/** Which words the user has written by hand; drafting leaves those alone. */
export type WordsDirty = Record<DraftField, boolean>

export const CLEAN_WORDS: WordsDirty = {
  title: false,
  summary: false,
  steps: false,
}

export interface DraftedWords {
  title: string
  summary: string
  steps: string[]
}

const TITLE_MAX = 120
const SUMMARY_MAX = 280

/** "a, b and c", as written. */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** "A, b and c": every label after the first lower-cased. */
function joinLabels(labels: readonly string[]): string {
  const [first = "", ...rest] = labels

  return joinAnd([first, ...rest.map((l) => l.toLowerCase())].filter(Boolean))
}

const isPanelGap = (g: GapKey): g is PanelGap =>
  (PANEL_GAPS as readonly string[]).includes(g)

/** How a gap reads in a drafted summary: "opening hours", "photos". */
export const GAP_PHRASES: Record<PanelGap, string> = {
  hours: "opening hours",
  photo: "photos",
  accessibility: "accessibility details",
  contact: "contact details",
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`

/**
 * The places as words, shorter at each `level` so a long title still
 * fits: up to three names ("A, B and C") or two and a count ("A, B and 4
 * more places"); then one name and a count; then a count alone.
 */
function placesText(names: readonly string[], level: number): string {
  if (names.length === 0) return "your chosen places"
  const named = Math.max(0, 3 - level)
  if (names.length <= named) return joinAnd(names)
  const shown = names.slice(0, Math.max(0, named - 1))
  if (shown.length === 0) return plural(names.length, "place", "places")
  const rest = plural(names.length - shown.length, "more place", "more places")

  return `${shown.join(", ")} and ${rest}`
}

/** Where the drive runs, as the drafts say it. */
interface DraftPlace {
  /** "Ealing, Camden and Croydon", or "12 libraries" for a list. */
  name: string
  /** "libraries in Ealing …", or "these 12 libraries". */
  libraries: string
  /** "in Ealing …", or "for 12 libraries". */
  at: string
}

function draftPlace(state: BuilderState, level: number): DraftPlace {
  const listed = parseLibraryList(state.libraryList).refs.length
  if (listed > 0) {
    const name = plural(listed, "library", "libraries")

    return { name, libraries: `these ${name}`, at: `for ${name}` }
  }
  const name = placesText(
    state.places.map((p) => p.name),
    level
  )

  return { name, libraries: `libraries in ${name}`, at: `in ${name}` }
}

function draftVerify(state: BuilderState, place: DraftPlace): DraftedWords {
  const sections = VERIFY_SECTIONS.filter((s) =>
    state.verifySections.includes(s)
  ).map((s) => SECTION_LABELS[s])
  const label = sections.length > 0 ? joinLabels(sections) : "Details"
  const lower = sections.length > 0 ? label.toLowerCase() : "the details"

  return {
    title: `Still right? *${label}* ${place.at}`,
    summary: `Help us confirm ${lower} are still right for ${place.libraries}. Check the library’s website and mark what you checked.`,
    steps: [
      "Open a library from the list",
      "Check its website for the details",
      "Mark what you confirmed, with the link",
    ],
  }
}

function draftRecord(state: BuilderState, place: DraftPlace): DraftedWords {
  const typed = state.recordTarget.trim()
  const target = /^\d{1,3}$/.test(typed) ? `${typed}%` : "the target"
  const every = place.libraries.startsWith("these ")
    ? `each of ${place.libraries}`
    : `every library in ${place.name}`

  return {
    title: `Complete the records for ${place.name}`,
    summary: `Help us bring ${every} to ${target} complete. Each task fills what’s missing.`,
    steps: [
      "Open a library from the list",
      "Fill in whatever the checklist shows",
      "Save with a source link",
    ],
  }
}

function draftGaps(state: BuilderState, place: DraftPlace): DraftedWords {
  const gaps = state.gaps.filter(isPanelGap)
  const label =
    gaps.length > 0
      ? joinLabels(gaps.map((g) => FOCUS_META[g].label))
      : "Missing details"
  const phrase =
    gaps.length > 0
      ? joinAnd(gaps.map((g) => GAP_PHRASES[g]))
      : "missing details"

  return {
    title: `*${label}* for ${place.name}`,
    summary: `Help us add ${phrase} for ${place.libraries}. Each task takes a few minutes.`,
    steps: [
      "Open a library from the list",
      "Find the details on the library’s own website",
      "Add them with the source link",
    ],
  }
}

/** One draft of the words at a `level` of place detail. */
function draftAt(state: BuilderState, level: number): DraftedWords {
  const place = draftPlace(state, level)
  if (state.focusKind === "verify") return draftVerify(state, place)
  if (state.focusKind === "record") return draftRecord(state, place)

  return draftGaps(state, place)
}

/**
 * The card's words drafted from the builder's choices: a title, a summary
 * and three steps for its Focus and places (or list). A long title or
 * summary names fewer places so it fits its limit.
 */
export function draftWords(state: BuilderState): DraftedWords {
  const drafts = [0, 1, 2, 3].map((level) => draftAt(state, level))
  const fit = <K extends "title" | "summary">(key: K, max: number) =>
    drafts.find((d) => d[key].length <= max)?.[key] ??
    drafts.at(-1)![key].slice(0, max)

  return {
    title: fit("title", TITLE_MAX),
    summary: fit("summary", SUMMARY_MAX),
    steps: drafts[0]!.steps,
  }
}

/** The words a user has already written count as hand-written. */
export function dirtyOf(state: Pick<BuilderState, DraftField>): WordsDirty {
  return {
    title: state.title.trim() !== "",
    summary: state.summary.trim() !== "",
    steps: state.steps.some((s) => s.trim() !== ""),
  }
}

/** The state with every word not written by hand redrafted. */
export function withDraftedWords(
  state: BuilderState,
  dirty: WordsDirty
): BuilderState {
  if (dirty.title && dirty.summary && dirty.steps) return state
  const draft = draftWords(state)

  return {
    ...state,
    title: dirty.title ? state.title : draft.title,
    summary: dirty.summary ? state.summary : draft.summary,
    steps: dirty.steps ? state.steps : draft.steps,
  }
}

// ── Steps done ───────────────────────────────────────────────────────────────

/** The builder's five cards, by the fields each one holds. */
export const STEP_FIELDS: readonly (readonly BuilderField[])[] = [
  ["focus", "verifySections", "verifyBefore", "recordTarget"],
  ["places", "libraryTypes", "source", "completenessBelow", "libraries"],
  ["whereName", "whereUrl", "whereLicence"],
  ["title", "summary", "steps"],
  ["startsOn", "endsOn", "goalPercent", "unit"],
]

/**
 * Whether each card is complete: none of its fields has a problem, and a
 * dataset or other source has a name or a link.
 */
export function stepsDone(
  state: BuilderState,
  errors: readonly FieldError[]
): boolean[] {
  const bad = new Set(errors.map((e) => e.field))

  return STEP_FIELDS.map((fields, i) => {
    if (fields.some((f) => bad.has(f))) return false
    if (i === 2 && state.whereKind !== "website") {
      return state.whereName.trim() !== "" || state.whereUrl.trim() !== ""
    }

    return true
  })
}

// ── A saved draft ────────────────────────────────────────────────────────────

/** What "Save draft" keeps in the browser. */
export interface SavedDraft {
  state: BuilderState
  note: string
  dirty: WordsDirty
}

/** The browser storage key for a user's draft: one per user and mode. */
export const draftStorageKey = (mode: BuilderMode, userId: string) =>
  `${mode === "propose" ? "drive-proposal-draft" : "drive-board-draft"}:${userId}`

export function serializeDraft(draft: SavedDraft): string {
  return JSON.stringify({ v: 1, ...draft })
}

const PLACE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The strings in a saved list; null when it isn't a list. */
const asStrings = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : null

function savedPlaces(v: unknown): BuilderPlace[] | null {
  if (!Array.isArray(v)) return null
  const places: BuilderPlace[] = []
  for (const p of v as Record<string, unknown>[]) {
    if (
      !p ||
      !(DRIVE_PLACE_LEVELS as readonly unknown[]).includes(p.level) ||
      typeof p.slug !== "string" ||
      !PLACE_SLUG.test(p.slug) ||
      typeof p.name !== "string"
    ) {
      return null
    }
    places.push({
      level: p.level as DrivePlaceLevel,
      slug: p.slug,
      name: p.name,
      ...(typeof p.kind === "string" ? { kind: p.kind } : {}),
    })
  }

  return places
}

/**
 * A draft read back from the browser, or null when there's none or it
 * can't be read. Every field is checked against its type; one that doesn't
 * fit keeps a new drive's value, so an older or tampered draft can't break
 * the form.
 */
export function parseSavedDraft(
  raw: string | null,
  now: Date = new Date()
): SavedDraft | null {
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const src = json as Record<string, unknown> | null
  if (!src || src.v !== 1 || !src.state || typeof src.state !== "object") {
    return null
  }
  const saved = src.state as Record<string, unknown>
  const state = emptyBuilderState(now)
  const out = state as unknown as Record<string, unknown>

  for (const [key, fallback] of Object.entries(state)) {
    const value = saved[key]
    if (typeof fallback === "string" && typeof value === "string") {
      out[key] = value
    }
  }
  if (!["gaps", "verify", "record"].includes(state.focusKind)) {
    state.focusKind = "gaps"
  }
  if (!WHERE_KINDS.includes(state.whereKind)) state.whereKind = "other"
  if (!(DRIVE_UNITS as readonly string[]).includes(state.unit)) {
    state.unit = "library"
  }
  state.gaps = (asStrings(saved.gaps) ?? []).filter(isGapKey).slice(0, 3)
  state.verifySections = (asStrings(saved.verifySections) ?? []).filter(
    (s): s is VerifySection =>
      (VERIFY_SECTIONS as readonly string[]).includes(s)
  )
  state.libraryTypes = asStrings(saved.libraryTypes) ?? []
  const steps = asStrings(saved.steps)
  state.steps = steps && steps.length > 0 ? steps.slice(0, 5) : [""]
  state.places = savedPlaces(saved.places) ?? []
  const discussions = saved.discussions as Record<string, unknown> | undefined
  if (
    discussions &&
    typeof discussions.enabled === "boolean" &&
    Array.isArray(discussions.threadIds)
  ) {
    const start = discussions.start as Record<string, unknown> | undefined
    state.discussions = {
      enabled: discussions.enabled,
      threadIds: discussions.threadIds
        .filter(
          (id): id is string => typeof id === "string" && id.length <= 128
        )
        .slice(0, 10),
      ...(typeof discussions.baseVersion === "number"
        ? { baseVersion: discussions.baseVersion }
        : {}),
      ...(typeof discussions.featuredThreadId === "string"
        ? { featuredThreadId: discussions.featuredThreadId }
        : {}),
      ...(start &&
      typeof start.title === "string" &&
      typeof start.body === "string" &&
      typeof start.language === "string"
        ? {
            start: {
              title: start.title.slice(0, 250),
              body: start.body.slice(0, 20000),
              language: start.language.slice(0, 35),
            },
          }
        : {}),
    }
  }

  const dirtySrc = (src.dirty ?? {}) as Record<string, unknown>

  return {
    state,
    note: typeof src.note === "string" ? src.note : "",
    dirty: {
      title: dirtySrc.title === true,
      summary: dirtySrc.summary === true,
      steps: dirtySrc.steps === true,
    },
  }
}

// ── The live preview ─────────────────────────────────────────────────────────

/** Places the preview card names before counting the rest. */
const PREVIEW_PLACES = 3

/** "Ealing · Camden · Croydon", "12 chosen libraries", or null. */
export function previewPlaceLine(
  state: Pick<BuilderState, "places" | "libraryList">
): string | null {
  const listed = parseLibraryList(state.libraryList).refs.length
  if (listed > 0)
    return `${plural(listed, "chosen library", "chosen libraries")}`
  const names = state.places.map((p) => p.name)
  if (names.length === 0) return null
  const shown = names.slice(0, PREVIEW_PLACES).join(" · ")
  const rest = names.length - PREVIEW_PLACES

  return rest > 0 ? `${shown} · ${plural(rest, "more", "more")}` : shown
}

/**
 * The form as the Noticeboard card would show it, for the builder's live
 * preview: scheduled, nobody helping, nothing done yet, so its bar reads
 * "0 of 12" once the count of what's left is known, and "Not counted yet"
 * before.
 */
export function previewDriveView(
  state: BuilderState,
  todo: number | null
): DriveView {
  const input = toDriveInput(state)
  const goal = input.goalPercent || 100

  return {
    drive: {
      documentId: "preview",
      slug: "preview",
      title: input.title || "Your drive’s title",
      summary: input.summary,
      focus: input.focus,
      scope: input.scope,
      unit: input.unit,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      goalPercent: goal,
      status: "scheduled",
      pinned: false,
      featured: false,
      locale: "en",
      createdAt: "",
      updatedAt: "",
      steps: input.steps.map((text) => ({ text })),
    },
    href: "",
    place: previewPlaceLine(state),
    source: input.scope.source ?? null,
    progress:
      todo == null
        ? null
        : driveProgress({ total: todo, todo, inReview: 0 }, goal),
    helpers: null,
  }
}

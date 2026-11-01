/**
 * Pure rules for a drive's task panel: which editor each Focus opens (a
 * gap's editor, the "Still right?" fields for a verify drive, or a
 * whole-record drive's checklist of the library's own gaps), the
 * /api/submissions bodies it sends (the existing editors' own payloads,
 * tagged with the drive), the "Where did you find this?" rule, the
 * session's skip list, picking the next library, and the quota and
 * earned-Pro lines of "Your part". No React, so it's unit-testable.
 */
import { EARNED_PRO_POINTS } from "@repo/access"
import {
  COMPLETENESS_GAP_KEYS,
  type DriveFocus,
  type FacilityAnswer,
  type GapKey,
  PANEL_GAPS,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"

import {
  type CorrectionRecord,
  hasRecordChange,
  type RecordChanges,
  type RecordEdit,
  recordChanges,
} from "@/components/contribute/correction.logic"
import {
  buildSubmission,
  EMPTY_DRAFT,
  type WizardDraft,
} from "@/components/contribute/wizard.logic"
import {
  facilityAnswersBody,
  type FacilityAnswersBody,
} from "@/components/library/facility-rows"
import {
  availableSections,
  type VerifyRecord,
} from "@/components/library/verify.logic"
import type { DriveTask } from "@/lib/drives/types"

export type PanelGap = (typeof PANEL_GAPS)[number]

/**
 * What the panel edits: one of the drive's gaps, "closed or moved", the
 * "Still right?" fields (verify), or the whole-record checklist (record).
 */
export type PanelMode = PanelGap | "closed" | "verify" | "record"

/** The record-correction modes: one record correction each. */
export type RecordMode = "hours" | "contact" | "closed"

const isPanelGap = (g: string): g is PanelGap =>
  (PANEL_GAPS as readonly string[]).includes(g)

/** The gaps a drive asks for that this panel can fill, in focus order. */
export function panelGapsOf(focus: DriveFocus): PanelGap[] {
  return focus.kind === "gaps" ? (focus.gaps ?? []).filter(isPanelGap) : []
}

/**
 * The panel's first mode for a Focus: a gaps drive's first panel gap, the
 * "Still right?" fields for verify, the checklist for a whole record. Null
 * for a gaps drive with no gap the panel fills.
 */
export function panelModeOf(focus: DriveFocus): PanelMode | null {
  if (focus.kind === "verify") return "verify"
  if (focus.kind === "record") return "record"

  return panelGapsOf(focus)[0] ?? null
}

export const TASK_VERBS: Record<PanelGap, string> = {
  hours: "Add hours",
  photo: "Add a photo",
  accessibility: "Answer accessibility questions",
  contact: "Add contact details",
}

/** A task row's action: its gap's verb, or a general one for several. */
export function taskVerb(focus: DriveFocus): string {
  if (focus.kind === "verify") return "Confirm details"
  if (focus.kind === "record") return "Complete the record"
  const gaps = panelGapsOf(focus)
  if (gaps.length === 1) return TASK_VERBS[gaps[0]!]

  return gaps.length > 1 ? "Fill the gaps" : "Improve the record"
}

/** A task row's accessible name: "Add hours for Worthington Libraries". */
export const taskActionName = (verb: string, name: string) =>
  `${verb} for ${name}`

/** The library a submission is about. */
export type TaskTarget = { documentId: string; slug: string; name: string }

/** The drive a submission counts toward, and whether the sender claims it. */
export type DriveTag = {
  driveDocumentId?: string | null
  /** A Library Claim: record changes go in as `library_edit`. */
  claimed?: boolean
}

type Tagged<T> = T & {
  targetDocumentId: string
  driveDocumentId?: string
}

/** The library's id and the drive, added at the top level of a body. */
function tag<T extends object>(
  body: T,
  target: TaskTarget,
  { driveDocumentId }: DriveTag
): Tagged<T> {
  return {
    ...body,
    targetDocumentId: target.documentId,
    ...(driveDocumentId ? { driveDocumentId } : {}),
  }
}

/** The same body without its drive: "Send without the drive". */
export function withoutDrive<T extends { driveDocumentId?: string }>(
  body: T
): Omit<T, "driveDocumentId"> {
  const { driveDocumentId: _drive, ...rest } = body

  return rest
}

/** The correction categories (and so the editors) each record mode uses. */
export const MODE_CATEGORIES: Record<RecordMode, readonly string[]> = {
  hours: ["Opening hours"],
  contact: ["Website or catalogue"],
  closed: ["Open or closed", "Address or location"],
}

/** What these categories' editors changed, as one change set. */
export function categoryChanges(
  categories: readonly string[],
  record: CorrectionRecord,
  edit: RecordEdit
): RecordChanges {
  const merged: RecordChanges = {
    changes: {},
    previous: {},
    suggestedOptions: {},
  }
  for (const category of categories) {
    const c = recordChanges(category, record, edit)
    Object.assign(merged.changes, c.changes)
    Object.assign(merged.previous, c.previous)
    Object.assign(merged.suggestedOptions, c.suggestedOptions)
    if (c.previousHash) merged.previousHash = c.previousHash
  }

  return merged
}

/** What a record mode's editors changed, as one change set. */
export function panelChanges(
  mode: RecordMode,
  record: CorrectionRecord,
  edit: RecordEdit
): RecordChanges {
  return categoryChanges(MODE_CATEGORIES[mode], record, edit)
}

// ── Verify and whole-record drives ───────────────────────────────────────

/**
 * The sections a verify drive asks this library to confirm: the Focus's
 * sections the record has a value for, in VERIFY_SECTIONS order. Empty for
 * any other Focus.
 */
export function verifySectionsFor(
  focus: DriveFocus,
  record: VerifyRecord
): VerifySection[] {
  if (focus.kind !== "verify") return []
  const asked = new Set<string>(focus.sections)
  const has = new Set<string>(availableSections(record))

  return VERIFY_SECTIONS.filter((s) => asked.has(s) && has.has(s))
}

/** The correction category (and so the editor) each checklist gap opens. */
export const RECORD_EDITORS: Partial<Record<GapKey, string>> = {
  hours: "Opening hours",
  address: "Address or location",
  contact: "Website or catalogue",
  facilities: "Services and facilities",
}

/**
 * What a whole-record task lacks: the index's `needs` that count toward
 * completeness, in registry order. Empty when the index sent none.
 */
export function recordGapsOf(task: DriveTask): GapKey[] {
  const needs = new Set<string>(Array.isArray(task.needs) ? task.needs : [])

  return COMPLETENESS_GAP_KEYS.filter((k) => needs.has(k))
}

type RecordBody = Omit<
  Tagged<ReturnType<typeof buildSubmission>>,
  "submissionType"
> & {
  submissionType: "correction" | "library_edit"
}

/**
 * Hours, contact details, or "closed or moved": the correction drawer's
 * own record correction (`fields.kind: "record"`, the changed fields plus
 * `previous`), with the page as its evidence, tagged with the drive. A
 * claimant's goes in as a `library_edit`, as from the Index editor.
 */
export function recordPayload(
  mode: RecordMode,
  target: TaskTarget,
  record: CorrectionRecord,
  edit: RecordEdit,
  evidence: string,
  drive: DriveTag
): RecordBody {
  const changes = panelChanges(mode, record, edit)
  const [first, second] = MODE_CATEGORIES[mode]
  const category =
    mode === "hours" && record.libraryType === "Mobile"
      ? "Stops & times"
      : mode === "closed" && !("operationalStatus" in changes.changes) && second
        ? second
        : first!
  const body = buildSubmission(
    "correction",
    { slug: target.slug, name: target.name },
    { ...EMPTY_DRAFT, category, source: evidence },
    changes
  )

  return {
    ...tag(body, target, drive),
    submissionType: drive.claimed ? "library_edit" : "correction",
  }
}

/**
 * A whole-record task's one record correction: what the open categories'
 * editors changed, as `recordPayload` builds it. Its category is the first
 * open one that changed something. A claimant's goes in as a
 * `library_edit`.
 */
export function recordTaskPayload(
  categories: readonly string[],
  target: TaskTarget,
  record: CorrectionRecord,
  edit: RecordEdit,
  evidence: string,
  drive: DriveTag
): RecordBody {
  const changes = categoryChanges(categories, record, edit)
  const category =
    categories.find((c) => hasRecordChange(recordChanges(c, record, edit))) ??
    categories[0] ??
    ""
  const body = buildSubmission(
    "correction",
    { slug: target.slug, name: target.name },
    { ...EMPTY_DRAFT, category, source: evidence },
    changes
  )

  return {
    ...tag(body, target, drive),
    submissionType: drive.claimed ? "library_edit" : "correction",
  }
}

/** A photo, its credit and caption; sending it confirms the licence. */
export type PhotoInput = {
  photo: NonNullable<WizardDraft["photo"]>
  credit: string
  caption: string
}

/** The photo share's payload (`fields.kind: "photo"`), tagged with the drive. */
export function photoPayload(
  target: TaskTarget,
  { photo, credit, caption }: PhotoInput,
  drive: DriveTag
) {
  return tag(
    buildSubmission(
      "photo",
      { slug: target.slug, name: target.name },
      { ...EMPTY_DRAFT, photo, credit, text: caption, licence: true }
    ),
    target,
    drive
  )
}

/** The library page's Yes/No answers (`fields.kind: "facilities"`), tagged. */
export function facilitiesPayload(
  target: TaskTarget,
  answers: readonly (readonly [string, FacilityAnswer])[],
  drive: DriveTag
): FacilityAnswersBody {
  return facilityAnswersBody({
    slug: target.slug,
    name: target.name,
    answers,
    documentId: target.documentId,
    driveDocumentId: drive.driveDocumentId ?? undefined,
  })
}

/** Modes whose "Where did you find this?" must be a web page. */
const EVIDENCE_REQUIRED: ReadonlySet<PanelMode> = new Set(["hours", "contact"])

/** Checklist categories whose details need the page they came from. */
const EVIDENCE_CATEGORIES: ReadonlySet<string> = new Set([
  "Opening hours",
  "Stops & times",
  "Address or location",
  "Website or catalogue",
])

/**
 * Whether "Where did you find this?" must be a web page: always for hours
 * and contact details; for the whole-record checklist, when any open
 * category is hours, the address or contact details (services and
 * facilities alone leave it optional).
 */
export const evidenceRequired = (
  mode: PanelMode,
  categories: readonly string[] = []
) =>
  mode === "record"
    ? categories.some((c) => EVIDENCE_CATEGORIES.has(c))
    : EVIDENCE_REQUIRED.has(mode)

const isWebAddress = (s: string) => /^https?:\/\/\S+$/i.test(s)

/**
 * Why "Where did you find this?" isn't good enough yet, or null. Hours,
 * addresses and contact details need the page they came from; elsewhere
 * it's optional (a written reference goes to the reviewer as a note).
 * `categories` are the whole-record checklist's open editors.
 */
export function evidenceProblem(
  mode: PanelMode,
  source: string,
  categories: readonly string[] = []
): string | null {
  if (!evidenceRequired(mode, categories)) return null
  const s = source.trim()
  if (!s) return "Add the page you found this on."
  if (!isWebAddress(s)) return "The source must be a web address."

  return null
}

// ── Skips ────────────────────────────────────────────────────────────────

/** A drive's skipped libraries, kept for the browser session. */
export const skipKey = (driveDocumentId: string) =>
  `drive.skips.${driveDocumentId}`

/** No more than a drive can hold (DRIVE_MAX_TASKS). */
const MAX_SKIPS = 2000

const sessionStore = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** The libraries skipped in this drive this session; [] when unreadable. */
export function readSkips(
  driveDocumentId: string,
  storage: Storage | null = sessionStore()
): string[] {
  try {
    const raw = storage?.getItem(skipKey(driveDocumentId))
    const list: unknown = raw ? JSON.parse(raw) : []

    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === "string")
      : []
  } catch {
    return []
  }
}

/** Adds a skip (once) and returns the list; storage failing only loses it. */
export function addSkip(
  driveDocumentId: string,
  libraryDocumentId: string,
  storage: Storage | null = sessionStore()
): string[] {
  const list = readSkips(driveDocumentId, storage)
  const next = list.includes(libraryDocumentId)
    ? list
    : [...list, libraryDocumentId].slice(-MAX_SKIPS)
  try {
    storage?.setItem(skipKey(driveDocumentId), JSON.stringify(next))
  } catch {
    // storage unavailable: the skip lasts as long as the page
  }

  return next
}

// ── Picking ──────────────────────────────────────────────────────────────

const isOpen = (
  t: DriveTask,
  skipped: ReadonlySet<string>,
  done: ReadonlySet<string>
) =>
  !t.inReview &&
  !t.heldByOther &&
  !skipped.has(t.documentId) &&
  !done.has(t.documentId)

/**
 * The next library to offer after `currentId`: the first open one after it
 * in the list, wrapping round to the start; never the current one, a
 * skipped one, or one sent (`done`) or already in review.
 */
export function nextTask(
  tasks: readonly DriveTask[],
  currentId: string | null,
  skipped: ReadonlySet<string>,
  done: ReadonlySet<string>
): DriveTask | null {
  const at = currentId ? tasks.findIndex((t) => t.documentId === currentId) : -1
  const order = [...tasks.slice(at + 1), ...tasks.slice(0, Math.max(at, 0))]

  return (
    order.find((t) => t.documentId !== currentId && isOpen(t, skipped, done)) ??
    null
  )
}

/**
 * "Give me a library": a random open one from the list shown (until holds
 * ship, spec §6.4, picking at random keeps two helpers apart).
 */
export function randomTask(
  tasks: readonly DriveTask[],
  skipped: ReadonlySet<string>,
  done: ReadonlySet<string>,
  random: () => number = Math.random
): DriveTask | null {
  const open = tasks.filter((t) => isOpen(t, skipped, done))
  if (open.length === 0) return null

  return open[Math.min(open.length - 1, Math.floor(random() * open.length))]!
}

// ── Your part ────────────────────────────────────────────────────────────

/** `/api/contribute/standing`'s pending quota. */
export type PendingQuota = {
  pendingCount: number
  pendingLimit: number
}

const fmt = (n: number) => n.toLocaleString("en-GB")

/** "3 of 5 waiting for review", or null without a quota. */
export function quotaLine(q: PendingQuota | null): string | null {
  return q
    ? `${fmt(q.pendingCount)} of ${fmt(q.pendingLimit)} waiting for review`
    : null
}

/** Why Send is off: the pending quota is full. Null while there's room. */
export function quotaReason(q: PendingQuota | null): string | null {
  if (!q || q.pendingCount < q.pendingLimit) return null

  return `You have ${fmt(q.pendingCount)} changes waiting for review, the most you can have at once. Send more once some are reviewed.`
}

/** The parts of `/api/contribute/standing`'s rewards standing read here. */
export type StandingTier = {
  totalPoints?: number | null
  tier?: {
    name?: string | null
    nextName?: string | null
    nextThreshold?: number | null
  } | null
}

/** Remaining points for earned Pro; activity is required even above the threshold. */
export function pointsToEarnedPro(s: StandingTier | null): number | null {
  if (s?.totalPoints == null) return null

  return Math.max(0, EARNED_PRO_POINTS - s.totalPoints)
}

export const earnedProLine = (points: number) =>
  points > 0
    ? `Drive work counts toward earned Pro: ${fmt(points)} points to 5,000. Keep contributing at least once every 30 days to retain it.`
    : "You have enough points for earned Pro. An accepted contribution renews access for 30 days."

// ── Place and search ─────────────────────────────────────────────────────

/** "Columbus, Ohio": the town (or district, or area), then the region. */
export function taskPlace(t: DriveTask): string {
  const town = t.city || t.district || t.area_name || ""
  const parts = [town, t.region_name ?? ""].filter(Boolean)

  return [...new Set(parts)].join(", ")
}

/** A web search for the library's name and town, for records without a site. */
export function webSearchHref(t: DriveTask): string {
  const q = [t.name, t.city || t.district || t.area_name]
    .filter(Boolean)
    .join(" ")

  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
}

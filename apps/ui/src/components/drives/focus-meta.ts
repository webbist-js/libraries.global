/**
 * How a Drive's Focus reads and looks: the label, icon and tint for each
 * gap the task panel fills (`PANEL_GAPS`), the "have …" phrase progress
 * sentences use, the one-line summary the rules and reviews show, and the
 * Noticeboard's focus filter keys. Pure, so server and client components
 * share it.
 */
import {
  type DriveFocus,
  type DriveUnit,
  type GapKey,
  gapDefinition,
  PANEL_GAPS,
} from "@repo/shared-data"

import { SECTION_LABELS } from "@/components/library/verify.logic"
import { FOCUS_TINT } from "@/lib/design-tokens"

export type PanelGap = (typeof PANEL_GAPS)[number]

export type FocusTint = { readonly bg: string; readonly fg: string }

export interface FocusLook {
  label: string
  /** Iconify id. */
  icon: string
  tint: FocusTint
}

export const FOCUS_META: Record<PanelGap, FocusLook & { phrase: string }> = {
  hours: {
    label: "Opening hours",
    icon: "mdi:clock-outline",
    tint: FOCUS_TINT.hours,
    phrase: "have hours",
  },
  photo: {
    label: "Photos",
    icon: "mdi:camera-outline",
    tint: FOCUS_TINT.photo,
    phrase: "have a photo",
  },
  accessibility: {
    label: "Accessibility",
    icon: "mdi:wheelchair-accessibility",
    tint: FOCUS_TINT.accessibility,
    phrase: "have accessibility details",
  },
  contact: {
    label: "Contact details",
    icon: "mdi:card-account-phone-outline",
    tint: FOCUS_TINT.contact,
    phrase: "have contact details",
  },
}

/** The Noticeboard's `?focus=` values: the panel gaps, then verify and record. */
export const FOCUS_FILTER_KEYS = [...PANEL_GAPS, "verify", "record"] as const

export type FocusFilterKey = (typeof FOCUS_FILTER_KEYS)[number]

export const FOCUS_FILTER_META: Record<FocusFilterKey, FocusLook> = {
  ...FOCUS_META,
  verify: {
    label: "Check details",
    icon: "mdi:shield-check-outline",
    tint: FOCUS_TINT.other,
  },
  record: {
    label: "Whole record",
    icon: "mdi:file-document-check-outline",
    tint: FOCUS_TINT.other,
  },
}

export const isFocusFilterKey = (v: unknown): v is FocusFilterKey =>
  typeof v === "string" && (FOCUS_FILTER_KEYS as readonly string[]).includes(v)

const isPanelGap = (g: GapKey): g is PanelGap =>
  (PANEL_GAPS as readonly string[]).includes(g)

const UNIT_NOUNS: Record<DriveUnit, [string, string]> = {
  library: ["library", "libraries"],
  branch: ["branch", "branches"],
  record: ["record", "records"],
}

/** "library" for one, "libraries" for any other count. */
export function unitNoun(unit: DriveUnit, count: number): string {
  const [one, many] = UNIT_NOUNS[unit] ?? UNIT_NOUNS.library

  return count === 1 ? one : many
}

/** The filter keys a Drive is listed under. */
export function focusKeysOf(focus: DriveFocus): FocusFilterKey[] {
  if (focus.kind === "verify") return ["verify"]
  if (focus.kind === "record") return ["record"]

  return (focus.gaps ?? []).filter(isPanelGap)
}

/** "a, b and c", as written. */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** "A, b and c": every item after the first lower-cased. */
function joinLabels(labels: string[]): string {
  const [first = "", ...rest] = labels

  return joinAnd([first, ...rest.map((l) => l.toLowerCase())].filter(Boolean))
}

// A fixed table, as `driveDateLabel`: ICU month names vary by Node build.
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

/** "6 Oct 2025", in UTC like the card dates; "" when it isn't a date. */
export function longDate(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : Number.NaN
  if (!Number.isFinite(t)) return ""
  const d = new Date(t)

  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const gapLook = (gap: GapKey): FocusLook =>
  isPanelGap(gap)
    ? FOCUS_META[gap]
    : {
        label: gapDefinition(gap)?.label ?? gap,
        icon: "mdi:help-circle-outline",
        tint: FOCUS_TINT.other,
      }

/** The chip for a Drive's Focus: its gaps' labels, led by the first gap's look. */
export function focusChipOf(focus: DriveFocus): FocusLook {
  if (focus.kind !== "gaps") return FOCUS_FILTER_META[focus.kind]

  const gaps = focus.gaps ?? []
  // No gap chosen yet: only the builder's live preview draws one.
  if (!gaps[0]) {
    return { label: "Fill gaps", icon: "mdi:plus", tint: FOCUS_TINT.other }
  }
  const lead = gapLook(gaps[0])

  return {
    label: joinLabels(gaps.map((g) => gapLook(g).label)) || lead.label,
    icon: lead.icon,
    tint: lead.tint,
  }
}

/** A gap's phrase without its leading "have": "hours", "a photo". */
const gapObject = (gap: GapKey): string =>
  isPanelGap(gap)
    ? FOCUS_META[gap].phrase.replace(/^have /, "")
    : (gapDefinition(gap)?.phrase ?? gap)

/**
 * What a done library has, for progress sentences: "142 of 251 branches
 * have hours", "… have been checked since 6 Oct 2025", "… are 75% complete".
 */
export function gapPhraseOf(focus: DriveFocus): string {
  if (focus.kind === "verify") {
    const since = longDate(focus.before)

    return since ? `have been checked since ${since}` : "have been checked"
  }
  if (focus.kind === "record") return `are ${focus.target}% complete`

  const objects = (focus.gaps ?? []).map(gapObject)
  if (objects.length === 0) return "are done"

  return `have ${joinAnd(objects)}`
}

/**
 * A Focus in one line, for the drive's rules and a proposal's review:
 * "Opening hours and Contact details", "Confirm opening hours and open or
 * closed not checked since 6 Oct 2025", "Complete records to 75%".
 */
export function focusSummary(focus: DriveFocus): string {
  if (focus.kind === "verify") {
    const sections = joinAnd(
      (focus.sections ?? []).map((s) => (SECTION_LABELS[s] ?? s).toLowerCase())
    )
    const since = longDate(focus.before)

    return since
      ? `Confirm ${sections} not checked since ${since}`
      : `Confirm ${sections}`
  }
  if (focus.kind === "record") return `Complete records to ${focus.target}%`

  return joinAnd((focus.gaps ?? []).map((g) => gapLook(g).label))
}

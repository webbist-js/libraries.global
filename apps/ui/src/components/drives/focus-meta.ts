/**
 * How a Drive's Focus reads and looks: the label, icon and tint for each
 * gap the task panel fills (`PANEL_GAPS`), the "have …" phrase progress
 * sentences use, and the Noticeboard's focus filter keys. Pure, so server
 * and client components share it.
 */
import {
  type DriveFocus,
  type DriveUnit,
  type GapKey,
  gapDefinition,
  PANEL_GAPS,
} from "@repo/shared-data"

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

/** "A, b and c": every item after the first lower-cased. */
function joinLabels(labels: string[]): string {
  const [first = "", ...rest] = labels
  const tail = rest.map((l) => l.toLowerCase())
  if (tail.length === 0) return first

  return `${[first, ...tail.slice(0, -1)].join(", ")} and ${tail.at(-1)}`
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
  const lead = gaps[0] ? gapLook(gaps[0]) : FOCUS_FILTER_META.record

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
 * have hours".
 */
export function gapPhraseOf(focus: DriveFocus): string {
  if (focus.kind === "verify") return "have been checked"
  if (focus.kind === "record") return "are complete"

  const objects = (focus.gaps ?? []).map(gapObject)
  if (objects.length === 0) return "are done"
  const list =
    objects.length === 1
      ? objects[0]
      : `${objects.slice(0, -1).join(", ")} and ${objects.at(-1)}`

  return `have ${list}`
}

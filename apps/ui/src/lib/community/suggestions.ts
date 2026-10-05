// Shared types and pure helpers for Option Suggestions ("Suggest an
// addition"): the public shape, sorting, status presentation and the
// editorial board's monthly review date. No `server-only` — client islands
// (the suggestion form, the sort toggle) import this directly.

import { TYPE_TINT } from "@/lib/design-tokens"

/** The four lists a contributor can suggest an addition to. */
export const SUGGESTION_LISTS = [
  "accessibility",
  "amenities",
  "services",
  "library_types",
] as const

export type SuggestionList = (typeof SUGGESTION_LISTS)[number]

export type SuggestionStatus =
  | "open"
  | "reviewing"
  | "planned"
  | "accepted"
  | "declined"

/** The public shape of a suggestion, as `GET /api/option-suggestions` returns it. */
export type PublicSuggestion = {
  documentId: string
  name: string
  optionKey: SuggestionList
  status: SuggestionStatus
  votes: number
  /** Only present when the viewer is signed in. */
  voted?: boolean
  description: string | null
  suggestedByName: string | null
  createdAt: string
  decidedAt: string | null
  decisionNote: string | null
  libraryCount: number
}

export const LIST_LABELS: Record<SuggestionList, string> = {
  accessibility: "Accessibility",
  services: "Services",
  amenities: "Facilities",
  library_types: "Library types",
}

export const LIST_ORDER: SuggestionList[] = [
  "accessibility",
  "services",
  "amenities",
  "library_types",
]

export type StatusMeta = {
  label: string
  icon: string
  bg: string
  fg: string
}

export const STATUS_META: Record<SuggestionStatus, StatusMeta> = {
  open: {
    label: "New",
    icon: "mdi:circle-outline",
    bg: TYPE_TINT.neutral.bg,
    fg: TYPE_TINT.neutral.fg,
  },
  reviewing: {
    label: "Under review",
    icon: "mdi:eye-outline",
    bg: TYPE_TINT.academic.bg,
    fg: TYPE_TINT.academic.fg,
  },
  planned: {
    label: "Planned",
    icon: "mdi:calendar-blank-outline",
    bg: TYPE_TINT.public.bg,
    fg: TYPE_TINT.public.fg,
  },
  accepted: {
    label: "Added",
    icon: "mdi:check",
    bg: TYPE_TINT.public.bg,
    fg: TYPE_TINT.public.fg,
  },
  declined: {
    label: "Not adding",
    icon: "mdi:close",
    bg: TYPE_TINT.special.bg,
    fg: TYPE_TINT.special.fg,
  },
}

const VOTABLE_STATUSES = new Set<SuggestionStatus>([
  "open",
  "reviewing",
  "planned",
])

/** Whether a contributor can still vote on this suggestion. */
export function isVotable(s: Pick<PublicSuggestion, "status">): boolean {
  return VOTABLE_STATUSES.has(s.status)
}

/**
 * Sorts a list of suggestions for display.
 * - "top": declined suggestions last, then by votes descending, then by name.
 * - "new": most recently suggested first.
 */
export function sortSuggestions<T extends PublicSuggestion>(
  list: readonly T[],
  mode: "top" | "new"
): T[] {
  const copy = [...list]

  if (mode === "new") {
    return copy.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  return copy.sort((a, b) => {
    const declinedA = a.status === "declined" ? 1 : 0
    const declinedB = b.status === "declined" ? 1 : 0
    if (declinedA !== declinedB) return declinedA - declinedB
    if (b.votes !== a.votes) return b.votes - a.votes

    return a.name.localeCompare(b.name)
  })
}

function firstTuesday(year: number, month: number): Date {
  const d = new Date(year, month, 1)
  const diff = (2 - d.getDay() + 7) % 7
  d.setDate(1 + diff)

  return d
}

/**
 * The editorial board's next monthly review: the first Tuesday of the
 * month, or next month's once this month's has passed. The review day
 * itself still counts as upcoming.
 */
export function nextBoardReview(now: Date): Date {
  const year = now.getFullYear()
  const month = now.getMonth()
  const thisMonth = firstTuesday(year, month)
  const today = new Date(year, month, now.getDate())

  return today <= thisMonth ? thisMonth : firstTuesday(year, month + 1)
}

/** "3 November" — en-GB, day and month, no year. */
export function formatBoardReview(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`
}

/** "just now", "5 days ago", "3 weeks ago", "2 months ago", … */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return plural(minutes, "minute")

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, "hour")

  const days = Math.floor(hours / 24)
  if (days < 7) return plural(days, "day")

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return plural(weeks, "week")

  const months = Math.floor(days / 30)
  if (months < 12) return plural(months, "month")

  const years = Math.floor(days / 365)

  return plural(years, "year")
}

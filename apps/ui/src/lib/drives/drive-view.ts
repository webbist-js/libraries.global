/**
 * A Drive as the Noticeboard and drive page show it: the Drive plus its
 * place label, source name, progress numbers and helper count. The rules
 * here are pure; `drive-view-server.ts` loads the inputs.
 */
import {
  DRIVE_PLACE_LEVELS,
  type DrivePlaceLevel,
  driveProgress,
} from "@repo/shared-data"

import {
  FOCUS_FILTER_KEYS,
  FOCUS_FILTER_META,
  type FocusFilterKey,
  focusKeysOf,
} from "@/components/drives/focus-meta"
import { nameFromSlug } from "@/lib/find-places"

import type { Drive, DriveScope, DriveStats } from "./types"

export type DriveNumbers = ReturnType<typeof driveProgress>

export interface DriveView {
  drive: Drive
  /** The drive page. */
  href: string
  /** "Ohio, United States", "Ohio and Indiana", "12 chosen libraries". */
  place: string | null
  /** The Dataset the scope draws on ("Records from …"), by name. */
  source: string | null
  /** Null when nothing has been counted yet. */
  progress: DriveNumbers | null
  /** Distinct people helping, or null when unknown. */
  helpers: number | null
}

export const driveHref = (slug: string) =>
  `/community/drives/${encodeURIComponent(slug)}`

/** A Drive title without its `*italic*` markup, for alt text and metadata. */
export const plainDriveTitle = (title: string) => title.replaceAll("*", "")

const fromCounts = (
  total: number,
  done: number,
  inReview: number,
  goalPercent: number
) =>
  driveProgress(
    { total, todo: Math.max(0, total - done), inReview },
    goalPercent
  )

/**
 * The numbers to show for a Drive: the final tally once it has closed,
 * else the live counts, else its newest stored snapshot (the progress log,
 * then the baseline), else null.
 */
export function displayProgress(
  drive: Drive,
  live: DriveNumbers | null
): DriveNumbers | null {
  const goal = drive.goalPercent ?? 100

  if (drive.status === "closed" && drive.final) {
    return fromCounts(drive.final.total, drive.final.done, 0, goal)
  }
  if (live) return live

  const last = drive.progressLog?.at(-1)
  if (last) return fromCounts(last.total, last.done, last.inReview ?? 0, goal)
  if (drive.baseline) {
    return fromCounts(drive.baseline.total, drive.baseline.done, 0, goal)
  }

  return null
}

/**
 * "57% · 38 people helping" ("41 people helped" once finished), or the
 * percentage alone when helpers are unknown.
 */
export function progressMeta(
  percent: number,
  helpers: number | null,
  finished = false
): string {
  if (helpers == null) return `${percent}%`
  const people = `${helpers.toLocaleString("en-GB")} ${helpers === 1 ? "person" : "people"}`

  return `${percent}% · ${people} ${finished ? "helped" : "helping"}`
}

/** The final helper count once closed, else the live stats' count. */
export function displayHelpers(
  drive: Drive,
  stats: DriveStats | null
): number | null {
  if (drive.status === "closed" && drive.final) return drive.final.helpers

  return stats?.helpers ?? null
}

export interface PlaceRef {
  level: DrivePlaceLevel
  slug: string
}

/** The place name and its country, keyed `${level}:${slug}`. */
export type PlaceNames = ReadonlyMap<
  string,
  { name: string; country?: string | null }
>

export const placeKey = (ref: PlaceRef) => `${ref.level}:${ref.slug}`

/** Every place in a scope, broadest level first, in the order given. */
export function drivePlaceRefs(scope: DriveScope): PlaceRef[] {
  return DRIVE_PLACE_LEVELS.flatMap((level) =>
    (scope.places?.[level] ?? []).map((slug) => ({ level, slug }))
  )
}

/** Places the label names; the rest are counted ("and 2 more"). */
export const NAMED_PLACES = 2

/**
 * One line for where a Drive runs: one place with its country, two places
 * joined, more counted, or the size of an explicit library list (which
 * replaces places, as in the scope filter).
 */
export function drivePlaceLabel(
  scope: DriveScope,
  names: PlaceNames
): string | null {
  const libraries = scope.libraries?.length ?? 0
  if (libraries > 0) {
    return `${libraries} chosen ${libraries === 1 ? "library" : "libraries"}`
  }

  const refs = drivePlaceRefs(scope)
  if (refs.length === 0) return null

  const nameOf = (ref: PlaceRef) =>
    names.get(placeKey(ref))?.name ?? nameFromSlug(ref.slug)

  if (refs.length === 1) {
    const ref = refs[0]!
    const name = nameOf(ref)
    const country = names.get(placeKey(ref))?.country

    return country && country !== name ? `${name}, ${country}` : name
  }

  const named = refs.slice(0, NAMED_PLACES).map(nameOf)
  const rest = refs.length - named.length

  return rest > 0
    ? `${named.join(", ")} and ${rest} more`
    : `${named[0]} and ${named[1]}`
}

/**
 * The big card's drive: the Featured Drive, else the first pinned drive,
 * else the first drive. The others keep their order.
 */
export function pickFeatured(views: readonly DriveView[]): {
  featured: DriveView | null
  others: DriveView[]
} {
  const featured =
    views.find((v) => v.drive.featured) ??
    views.find((v) => v.drive.pinned) ??
    views[0] ??
    null

  return { featured, others: views.filter((v) => v !== featured) }
}

/** The drives listed under a focus filter key; every drive without one. */
export function filterByFocus(
  views: readonly DriveView[],
  key: FocusFilterKey | null
): DriveView[] {
  if (!key) return [...views]

  return views.filter((v) => focusKeysOf(v.drive.focus).includes(key))
}

export interface FocusFilterOption {
  key: FocusFilterKey
  label: string
  icon: string
  count: number
}

/** A link per focus with at least one open drive, in `FOCUS_FILTER_KEYS` order. */
export function focusFilterOptions(
  drives: readonly Drive[]
): FocusFilterOption[] {
  const counts = new Map<FocusFilterKey, number>()
  for (const d of drives) {
    for (const key of new Set(focusKeysOf(d.focus))) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return FOCUS_FILTER_KEYS.flatMap((key) => {
    const count = counts.get(key) ?? 0

    return count > 0
      ? [
          {
            key,
            label: FOCUS_FILTER_META[key].label,
            icon: FOCUS_FILTER_META[key].icon,
            count,
          },
        ]
      : []
  })
}

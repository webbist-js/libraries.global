/**
 * A Drive's display progress, counted in Meilisearch rather than Strapi
 * (ADR-0004): one `multiSearch` with two `limit: 0` queries — the scope
 * filter and the scope-plus-focus ("to do") filter, both from the shared
 * `driveFilters` — faceted on `locale` so the count is exact even though
 * `totalHits` itself stops at the index's `maxTotalHits`.
 */
import {
  DRIVE_PLACE_LEVELS,
  driveFilters,
  driveProgress,
  type DriveFocus,
  type DrivePlaceLevel,
  type DriveScope,
  PANEL_GAPS,
  scopeFilter,
} from "@repo/shared-data"

import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"

type Distribution = Record<string, Record<string, number>> | undefined

const countOf = (dist: Distribution, facet: string) =>
  Object.values(dist?.[facet] ?? {}).reduce((sum, n) => sum + n, 0)

export interface DriveCountsInput {
  scope: DriveScope
  focus: DriveFocus
  /** The drive's own `openedAt` once it has one; omitted before it opens. */
  openedAt?: string | null
}

export interface DriveCounts {
  /** Every library in the Drive's scope. */
  total: number
  /** In scope and still on-focus — what's left to do. */
  todo: number
}

/**
 * `{ total, todo }` for one Drive, in the search route's locale. Null on
 * any Meilisearch failure, so callers can fall back to the Drive's last
 * stored snapshot (`baseline`/`progressLog`/`final`) instead of breaking.
 */
export async function driveCounts(
  drive: DriveCountsInput,
  locale?: string
): Promise<DriveCounts | null> {
  const [counts] = await driveCountsMany([drive], locale)

  return counts ?? null
}

/**
 * `driveCounts` for several Drives in one `multiSearch` (two queries per
 * Drive), so the Noticeboard asks Meilisearch once however many drives are
 * open. One entry per Drive, in order; every entry is null on failure.
 */
export async function driveCountsMany(
  drives: readonly DriveCountsInput[],
  locale?: string
): Promise<(DriveCounts | null)[]> {
  if (drives.length === 0) return []

  try {
    const localeClause = searchLocaleFilter(locale)
    const query = (filter: string) => ({
      indexUid: "library",
      filter: `${filter} AND ${localeClause}`,
      limit: 0,
      facets: ["locale"],
    })

    const { results } = await meiliClient.multiSearch({
      queries: drives.flatMap((drive) => {
        const filters = driveFilters({
          scope: drive.scope,
          focus: drive.focus,
          openedAt: drive.openedAt,
        })

        return [query(filters.scope), query(filters.todo)]
      }),
    })
    const facets = results as unknown as { facetDistribution?: Distribution }[]

    return drives.map((_, i) => ({
      total: countOf(facets[i * 2]?.facetDistribution, "locale"),
      todo: countOf(facets[i * 2 + 1]?.facetDistribution, "locale"),
    }))
  } catch {
    return drives.map(() => null)
  }
}

/** The places a preview counts one by one; the rest still count in the totals. */
export const PREVIEW_MAX_PLACES = 12

export type PreviewGap = (typeof PANEL_GAPS)[number]

/** No library missing any gap: an empty preview's `gaps`. */
export const PANEL_GAP_ZEROS: Readonly<Record<PreviewGap, number>> = {
  hours: 0,
  photo: 0,
  accessibility: 0,
  contact: 0,
}

/** One place in the scope, with its own share of the counts. */
export interface DrivePreviewPlace {
  level: DrivePlaceLevel
  slug: string
  /** From the index; the slug as words when no library carries it. */
  name: string
  total: number
  /** Null when the preview counts the scope only. */
  todo: number | null
}

export interface DrivePreviewCounts {
  total: number
  /** Null when the preview counts the scope only (no gap chosen yet). */
  todo: number | null
  /** Libraries in scope missing each gap the task panel can fill. */
  gaps: Record<PreviewGap, number>
  /** Each place in the scope, broadest first, at most `PREVIEW_MAX_PLACES`. */
  places: DrivePreviewPlace[]
}

const titleCase = (slug: string) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

/** The scope's places, broadest level first, capped. A list replaces them. */
function previewPlaces(
  scope: DriveScope
): { level: DrivePlaceLevel; slug: string }[] {
  if (scope.libraries?.length) return []

  return DRIVE_PLACE_LEVELS.flatMap((level) =>
    (scope.places?.[level] ?? []).map((slug) => ({ level, slug }))
  ).slice(0, PREVIEW_MAX_PLACES)
}

/**
 * The drive builder's live preview, in one `multiSearch`: the scope
 * (faceted on `needs` too, for the gap chips) and its to-do, then for each
 * place (at most 12) the scope and to-do within it, the first also naming
 * the place from one hit. Counts come from the `locale` facet, as
 * `driveCountsMany`. With `focus: null` it counts the scope only, leaving
 * every to-do count null. Null on any Meilisearch failure.
 */
export async function drivePreviewCounts(
  drive: {
    scope: DriveScope
    focus: DriveFocus | null
    openedAt?: string | null
  },
  locale?: string
): Promise<DrivePreviewCounts | null> {
  try {
    const localeClause = searchLocaleFilter(locale)
    const scope = scopeFilter(drive.scope, { openedAt: drive.openedAt })
    const todo = drive.focus
      ? driveFilters({
          scope: drive.scope,
          focus: drive.focus,
          openedAt: drive.openedAt,
        }).todo
      : null
    const count = (filter: string, extra: Record<string, unknown> = {}) => ({
      indexUid: "library",
      filter: `${filter} AND ${localeClause}`,
      limit: 0,
      facets: ["locale"],
      ...extra,
    })
    const places = previewPlaces(drive.scope)

    const queries = [
      count(scope, { facets: ["locale", "needs"] }),
      ...(todo ? [count(todo)] : []),
      ...places.flatMap(({ level, slug }) => {
        const clause = `${level}_slug = ${JSON.stringify(slug)}`

        return [
          count(`${scope} AND ${clause}`, {
            limit: 1,
            attributesToRetrieve: [`${level}_name`],
          }),
          ...(todo ? [count(`${todo} AND ${clause}`)] : []),
        ]
      }),
    ]

    const { results } = await meiliClient.multiSearch({ queries })
    const rows = results as unknown as {
      facetDistribution?: Distribution
      hits?: Record<string, unknown>[]
    }[]
    const step = todo ? 2 : 1
    const needs = rows[0]?.facetDistribution?.needs ?? {}

    return {
      total: countOf(rows[0]?.facetDistribution, "locale"),
      todo: todo ? countOf(rows[1]?.facetDistribution, "locale") : null,
      gaps: Object.fromEntries(
        PANEL_GAPS.map((gap) => [gap, needs[gap] ?? 0])
      ) as Record<PreviewGap, number>,
      places: places.map(({ level, slug }, i) => {
        const inPlace = rows[step + i * step]
        const name = inPlace?.hits?.[0]?.[`${level}_name`]

        return {
          level,
          slug,
          name: typeof name === "string" && name ? name : titleCase(slug),
          total: countOf(inPlace?.facetDistribution, "locale"),
          todo: todo
            ? countOf(rows[step + i * step + 1]?.facetDistribution, "locale")
            : null,
        }
      }),
    }
  } catch {
    return null
  }
}

/**
 * The shared `driveProgress` maths, fed by a live `driveCounts` result and
 * `fetchDriveStats`'s `inReview`. Null when the counts aren't available —
 * callers show the Drive's last stored snapshot instead.
 */
export function driveProgressOf(
  drive: { goalPercent: number },
  counts: DriveCounts | null,
  stats: { inReview: number } | null
): ReturnType<typeof driveProgress> | null {
  if (!counts) return null

  return driveProgress(
    { total: counts.total, todo: counts.todo, inReview: stats?.inReview ?? 0 },
    drive.goalPercent
  )
}

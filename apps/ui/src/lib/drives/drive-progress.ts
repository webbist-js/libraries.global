/**
 * A Drive's display progress, counted in Meilisearch rather than Strapi
 * (ADR-0004): one `multiSearch` with two `limit: 0` queries — the scope
 * filter and the scope-plus-focus ("to do") filter, both from the shared
 * `driveFilters` — faceted on `locale` so the count is exact even though
 * `totalHits` itself stops at the index's `maxTotalHits`.
 */
import {
  driveFilters,
  driveProgress,
  type DriveFocus,
  type DriveScope,
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

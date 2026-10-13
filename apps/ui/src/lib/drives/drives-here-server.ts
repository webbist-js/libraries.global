import "server-only"

import { driveFilters } from "@repo/shared-data"

import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"

import type { DriveView } from "./drive-view"
import { loadDriveViews } from "./drive-view-server"
import { fetchDrives } from "./drives-server"
import type { Drive } from "./types"

/** The location levels a page can call `drivesHere` for (area has no page). */
export type DrivesHereLevel = "continent" | "country" | "region"

type FacetCounts = {
  facetDistribution?: Record<string, Record<string, number>>
}

const localeCount = (result: FacetCounts | undefined) =>
  Object.values(result?.facetDistribution?.locale ?? {}).reduce(
    (sum, n) => sum + n,
    0
  )

/** At most three drives named on a location page. */
const MAX_DRIVES_HERE = 3

/**
 * Open drives with work still to do at this place, for the continent,
 * country and region pages: `fetchDrives("open")`, then one `multiSearch`
 * with one `limit: 0` query per drive (its "to do" filter plus this place's
 * slug), keeping the drives with work here, at most three, in list order
 * (pinned first), with `loadDriveViews` numbers. `null` on failure; an empty list is a successful query.
 */
export async function drivesHere(
  level: DrivesHereLevel,
  slug: string,
  locale: string
): Promise<{ view: DriveView; here: number }[] | null> {
  const drives = await fetchDrives("open", locale, undefined, true).catch(
    () => null
  )
  if (!drives) return null
  if (drives.length === 0) return []

  const localeClause = searchLocaleFilter(locale)
  const placeClause = `${level}_slug = ${JSON.stringify(slug)}`

  let heres: number[]
  try {
    const { results } = await meiliClient.multiSearch({
      queries: drives.map((d: Drive) => {
        const { todo } = driveFilters({
          scope: d.scope,
          focus: d.focus,
          openedAt: d.openedAt,
        })

        return {
          indexUid: "library",
          filter: `${todo} AND ${placeClause} AND ${localeClause} AND operationalStatus NOT IN ["permanently_closed","planned"]`,
          limit: 0,
          facets: ["locale"],
        }
      }),
    })
    heres = results.map((r) => localeCount(r as unknown as FacetCounts))
  } catch {
    return null
  }

  const withHere = drives
    .map((drive, i) => ({ drive, here: heres[i] ?? 0 }))
    .filter((d) => d.here > 0)
    .slice(0, MAX_DRIVES_HERE)

  if (withHere.length === 0) return []

  const views = await loadDriveViews(
    withHere.map((d) => d.drive),
    locale
  ).catch(() => null)
  if (!views) return null

  return withHere.map((d, i) => ({ view: views[i]!, here: d.here }))
}

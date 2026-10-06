import "server-only"

import { driveFilters } from "@repo/shared-data"
import type { Locale } from "next-intl"

import { docsSectionForArticle } from "@/components/docs/docs.config"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import { fetchDataset } from "@/lib/strapi-api/content/datasets"
import { fetchWikiArticle } from "@/lib/strapi-api/content/server"

import { driveCountsMany, driveProgressOf } from "./drive-progress"
import {
  displayHelpers,
  displayProgress,
  driveHref,
  drivePlaceLabel,
  drivePlaceRefs,
  type DriveView,
  NAMED_PLACES,
  type PlaceNames,
  type PlaceRef,
  placeKey,
} from "./drive-view"
import { fetchDrives, fetchDriveStats } from "./drives-server"
import type { Drive } from "./types"

/** The Knowledge article "How drives work" links to, when it's published. */
export const HOW_DRIVES_WORK_SLUG = "how-drives-work"

/** Drives whose numbers are still moving, so they're counted live. */
const isLive = (d: Drive) => d.status === "open" || d.status === "scheduled"

/**
 * Names for the places a label shows, from one library per place in the
 * search index (`{level}_name`, plus `country_name` below country level).
 * Empty on failure: labels fall back to the slug.
 */
export async function fetchPlaceNames(
  refs: readonly PlaceRef[],
  locale: string
): Promise<PlaceNames> {
  const unique = [...new Map(refs.map((r) => [placeKey(r), r])).values()]
  if (unique.length === 0) return new Map()

  try {
    const loc = searchLocaleFilter(locale)
    const { results } = await meiliClient.multiSearch({
      queries: unique.map((ref) => ({
        indexUid: "library",
        q: "",
        filter: `${ref.level}_slug = ${JSON.stringify(ref.slug)} AND ${loc}`,
        limit: 1,
        attributesToRetrieve: [`${ref.level}_name`, "country_name"],
      })),
    })

    return new Map(
      unique.flatMap((ref, i) => {
        const hit = results[i]?.hits?.[0] as Record<string, unknown> | undefined
        const name = hit?.[`${ref.level}_name`]
        if (typeof name !== "string" || !name) return []
        const country =
          (ref.level === "region" || ref.level === "area") &&
          typeof hit?.country_name === "string"
            ? hit.country_name
            : null

        return [[placeKey(ref), { name, country }] as const]
      })
    )
  } catch {
    return new Map()
  }
}

/** Dataset names by key ("Records from …"); the key itself when unnamed. */
async function fetchSourceNames(
  keys: readonly (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(keys.filter((k): k is string => !!k))]
  const datasets = await Promise.all(unique.map((key) => fetchDataset(key)))

  return new Map(unique.map((key, i) => [key, datasets[i]?.name ?? key]))
}

/**
 * Drives with everything the Noticeboard and drive page show: live counts
 * for open and scheduled drives (one `multiSearch` for all of them), stats
 * for open ones, place and Dataset names. Closed drives read their `final`
 * tally. In the order given.
 */
export async function loadDriveViews(
  drives: readonly Drive[],
  locale: string
): Promise<DriveView[]> {
  const live = drives.filter(isLive)
  const [counts, stats, names, sources] = await Promise.all([
    driveCountsMany(
      live.map((d) => ({
        scope: d.scope,
        focus: d.focus,
        openedAt: d.status === "open" ? d.openedAt : null,
      })),
      locale
    ),
    Promise.all(
      drives.map((d) =>
        d.status === "open" ? fetchDriveStats(d.documentId) : null
      )
    ),
    fetchPlaceNames(
      drives.flatMap((d) =>
        d.scope?.libraries?.length
          ? []
          : drivePlaceRefs(d.scope ?? {}).slice(0, NAMED_PLACES)
      ),
      locale
    ),
    fetchSourceNames(drives.map((d) => d.scope?.source)),
  ])
  const countsOf = new Map(live.map((d, i) => [d.documentId, counts[i]]))

  return drives.map((drive, i) => {
    const driveStats = stats[i] ?? null
    const liveNumbers = driveProgressOf(
      drive,
      countsOf.get(drive.documentId) ?? null,
      driveStats
    )

    return {
      drive,
      href: driveHref(drive.slug),
      place: drivePlaceLabel(drive.scope ?? {}, names),
      source: drive.scope?.source
        ? (sources.get(drive.scope.source) ?? drive.scope.source)
        : null,
      progress: displayProgress(drive, liveNumbers),
      helpers: displayHelpers(drive, driveStats),
    }
  })
}

/**
 * How many drives are open, for the Community tabs' Noticeboard count. The
 * same request as the Noticeboard's own list, so it shares its cache.
 */
export async function openDriveCount(locale: string): Promise<number> {
  return (await fetchDrives("open", locale)).length
}

/**
 * The homepage's one drive: the Featured Drive, else the first pinned drive,
 * else null — `pickFeatured`'s rule, but over pinned or featured drives
 * only. An unpinned open drive never reaches the homepage. Shares the
 * Noticeboard's 60-second cache.
 */
export async function fetchFeaturedDriveView(
  locale: string
): Promise<DriveView | null> {
  const drives = await fetchDrives("open", locale)
  const candidates = drives.filter((d) => d.featured || d.pinned)
  const drive =
    candidates.find((d) => d.featured) ??
    candidates.find((d) => d.pinned) ??
    candidates[0] ??
    null
  if (!drive) return null

  return (await loadDriveViews([drive], locale))[0] ?? null
}

type FacetCounts = {
  facetDistribution?: Record<string, Record<string, number>>
}

const localeFacetSum = (result: FacetCounts | undefined) =>
  Object.values(result?.facetDistribution?.locale ?? {}).reduce(
    (sum, n) => sum + n,
    0
  )

/**
 * The open drives (from `drives`) with work still to do in a followed
 * region: one `multiSearch` with one `limit: 0` query per drive (its
 * "to do" filter plus `region_slug IN [...]`), keeping the drives whose
 * locale-facet sum is above 0 — so a drive counts when it has work to do
 * in a followed region at any scope level. Empty when either list is
 * empty, or on any failure.
 */
export async function drivesInPlaces(
  drives: readonly Drive[],
  regionSlugs: readonly string[],
  locale: string
): Promise<Set<string>> {
  if (drives.length === 0 || regionSlugs.length === 0) return new Set()

  const localeClause = searchLocaleFilter(locale)
  const placesClause = `region_slug IN [${regionSlugs
    .map((slug) => JSON.stringify(slug))
    .join(", ")}]`

  try {
    const { results } = await meiliClient.multiSearch({
      queries: drives.map((drive) => {
        const { todo } = driveFilters({
          scope: drive.scope,
          focus: drive.focus,
          openedAt: drive.openedAt,
        })

        return {
          indexUid: "library",
          filter: `${todo} AND ${placesClause} AND ${localeClause}`,
          limit: 0,
          facets: ["locale"],
        }
      }),
    })

    return new Set(
      drives
        .filter(
          (_, i) => localeFacetSum(results[i] as unknown as FacetCounts) > 0
        )
        .map((drive) => drive.documentId)
    )
  } catch {
    return new Set()
  }
}

/** The "How drives work" Knowledge article's path, or null when unpublished. */
export async function howDrivesWorkHref(
  locale: string
): Promise<string | null> {
  const res = await fetchWikiArticle(HOW_DRIVES_WORK_SLUG, locale as Locale)
  const article = res?.data
  if (!article?.slug) return null

  return `/knowledge/${docsSectionForArticle(article)}/${article.slug}`
}

import "server-only"

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

/** The "How drives work" Knowledge article's path, or null when unpublished. */
export async function howDrivesWorkHref(
  locale: string
): Promise<string | null> {
  const res = await fetchWikiArticle(HOW_DRIVES_WORK_SLUG, locale as Locale)
  const article = res?.data
  if (!article?.slug) return null

  return `/knowledge/${docsSectionForArticle(article)}/${article.slug}`
}

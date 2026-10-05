import "server-only"

import {
  DEFAULT_FIND_STATE,
  findStateToParams,
  type NeedKey,
} from "@/components/index-page/find-helpers"
import { nameFromSlug } from "@/lib/find-places"
import { cached } from "@/lib/find-search"
import {
  meiliClient,
  searchLocale,
  searchLocaleFilter,
} from "@/lib/meilisearch"

// "Gaps worth a drive" on the Noticeboard: for each kind of gap, the region
// with the most records missing it. Every number is a Meilisearch facet
// count on the `library` index (ADR-0004: never a row scan).

export type DriveGapKey = "hours" | "photo" | "accessibility" | "stale"

export type DriveGap = {
  key: DriveGapKey
  title: string
  count: number
  place: { level: "region"; slug: string; name: string }
  /** Find libraries, narrowed to these records. */
  href: string
}

const NEED_GAPS: { key: DriveGapKey & NeedKey; title: string }[] = [
  { key: "hours", title: "Opening hours missing" },
  { key: "photo", title: "No photo yet" },
  { key: "accessibility", title: "Accessibility not recorded" },
]

const STALE_TITLE = "Not checked in over two years"

/**
 * Two years before `now`, in Unix seconds: the unit of the index's
 * `last_verified_ts` (apps/strapi/src/utils/library-search-fields.ts).
 */
export function staleCutoff(now: Date): number {
  const d = new Date(now)
  d.setUTCFullYear(d.getUTCFullYear() - 2)

  return Math.floor(d.getTime() / 1000)
}

/** The facet value with the highest count; ties go to the first slug. */
export function topFacet(
  dist: Record<string, number> | undefined
): { slug: string; count: number } | null {
  let top: { slug: string; count: number } | null = null
  for (const [slug, count] of Object.entries(dist ?? {})) {
    if (count > 0 && (!top || count > top.count)) top = { slug, count }
  }

  return top
}

function findHref(key: DriveGapKey, slug: string): string {
  const place = { level: "region" as const, slug }
  const params = findStateToParams(
    key === "stale"
      ? { ...DEFAULT_FIND_STATE, place, sort: "gaps" }
      : { ...DEFAULT_FIND_STATE, place, needs: [key] }
  )

  return `/libraries?${params.toString()}`
}

type FacetResult = {
  facetDistribution?: Record<string, Record<string, number>>
}

async function loadDriveGaps(locale: string, now: Date): Promise<DriveGap[]> {
  const loc = searchLocaleFilter(locale)
  const facet = (filter: string) => ({
    indexUid: "library",
    q: "",
    filter: `${filter} AND ${loc}`,
    limit: 0,
    facets: ["region_slug"],
  })
  const rows = [
    ...NEED_GAPS.map((g) => ({ ...g, filter: `needs = "${g.key}"` })),
    {
      key: "stale" as const,
      title: STALE_TITLE,
      filter: `last_verified_ts < ${staleCutoff(now)}`,
    },
  ]

  const { results } = await meiliClient.multiSearch({
    queries: rows.map((r) => facet(r.filter)),
  })
  const tops = rows.flatMap((row, i) => {
    const top = topFacet(
      (results[i] as FacetResult | undefined)?.facetDistribution?.region_slug
    )

    return top ? [{ ...row, ...top }] : []
  })
  if (tops.length === 0) return []

  // One library per region names it: "California, United States".
  const slugs = [...new Set(tops.map((t) => t.slug))]
  const named = await meiliClient.multiSearch({
    queries: slugs.map((slug) => ({
      indexUid: "library",
      q: "",
      filter: `region_slug = ${JSON.stringify(slug)} AND ${loc}`,
      limit: 1,
      attributesToRetrieve: ["region_name", "country_name"],
    })),
  })
  const names = new Map(
    slugs.map((slug, i) => {
      const hit = named.results[i]?.hits?.[0] as
        | { region_name?: unknown; country_name?: unknown }
        | undefined
      const region =
        typeof hit?.region_name === "string" && hit.region_name
          ? hit.region_name
          : nameFromSlug(slug)
      const country =
        typeof hit?.country_name === "string" && hit.country_name
          ? hit.country_name
          : null

      return [slug, country ? `${region}, ${country}` : region] as const
    })
  )

  return tops.map((t) => ({
    key: t.key,
    title: t.title,
    count: t.count,
    place: {
      level: "region" as const,
      slug: t.slug,
      name: names.get(t.slug) ?? nameFromSlug(t.slug),
    },
    href: findHref(t.key, t.slug),
  }))
}

/**
 * Up to four "Gaps worth a drive": missing opening hours, photos and
 * accessibility details, and records not checked in two years, each in the
 * region with the most. Rows with no records are dropped. Cached for ten
 * minutes per search locale; empty when Meilisearch can't answer.
 */
export async function fetchDriveGaps(locale?: string): Promise<DriveGap[]> {
  try {
    return await cached(`drive-gaps:${searchLocale(locale)}`, () =>
      loadDriveGaps(searchLocale(locale), new Date())
    )
  } catch {
    return []
  }
}

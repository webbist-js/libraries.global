import "server-only"

import { gapDefinition } from "@repo/shared-data"

import type { PlaceGapInsight } from "@/components/location/PlaceInsights"
import type { FindPlaceLevel } from "@/lib/find-places"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"

export const PLACE_INDEX_ELIGIBLE =
  'operationalStatus NOT IN ["permanently_closed", "planned"]'

export async function placeGapInsights(
  level: FindPlaceLevel,
  slug: string,
  types: readonly { type: string; count: number }[],
  locale: string
): Promise<PlaceGapInsight[] | null> {
  const recorded = types.filter((row) => row.count > 0)
  if (!recorded.length) return []
  try {
    const { results } = await meiliClient.multiSearch({
      queries: recorded.map(({ type }) => ({
        indexUid: "library",
        limit: 0,
        facets: ["needs", "locale"],
        filter: `${level}_slug = ${JSON.stringify(slug)} AND libraryType = ${JSON.stringify(type)} AND ${PLACE_INDEX_ELIGIBLE} AND ${searchLocaleFilter(locale)}`,
      })),
    })

    return results.flatMap((result, index) => {
      const type = recorded[index]!.type
      const distribution = result.facetDistribution ?? {}
      const eligible = Object.values(distribution.locale ?? {}).reduce(
        (sum, n) => sum + n,
        0
      )

      return (
        [
          "photo",
          "hours",
          "accessibility",
          "services",
          "contact",
          "address",
        ] as const
      )
        .filter(
          (key) => type !== "Digital" || ["photo", "contact"].includes(key)
        )
        .map((key) => ({
          key,
          type,
          label: `${type}: ${gapDefinition(key, type).label}`,
          missing: distribution.needs?.[key] ?? 0,
          eligible,
        }))
    })
  } catch {
    return null
  }
}

import "server-only"

import { contributionPlaceParams } from "@/lib/contribution-place"
import { findPlaceCatalogue } from "@/lib/find-place-catalogue-server"

/** Relation IDs come from the catalogue and its ancestry, never URL-provided IDs. */
export async function contributionPlacePrefill(
  params: Record<string, unknown>,
  locale: string
) {
  const place = contributionPlaceParams(params)
  const deepest = (["area", "region", "country", "continent"] as const).find(
    (level) => place[level]
  )
  if (!deepest) return {}
  const chain = await findPlaceCatalogue(
    { level: deepest, slug: place[deepest]! },
    locale
  )
  if (
    !chain ||
    Object.entries(place).some(
      ([level, slug]) => chain[level as keyof typeof chain]?.slug !== slug
    )
  )
    return {}

  return Object.fromEntries(
    Object.entries(chain).flatMap(([level, ref]) =>
      ref.documentId ? [[`${level}DocumentId`, ref.documentId]] : []
    )
  ) as {
    continentDocumentId?: string
    countryDocumentId?: string
    regionDocumentId?: string
    areaDocumentId?: string
  }
}

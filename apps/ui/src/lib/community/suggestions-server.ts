import "server-only"

import type {
  PublicSuggestion,
  SuggestionList,
} from "@/lib/community/suggestions"
import { LIBRARY_TYPES } from "@/lib/meilisearch"
import { PublicStrapiClient } from "@/lib/strapi-api"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** Every open, under-review, planned, accepted or declined suggestion. */
export async function fetchPublicSuggestions(): Promise<PublicSuggestion[]> {
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/option-suggestions`,
      {
        next: { revalidate: 60, tags: ["option-suggestions"] },
      }
    )
    if (!res.ok) return []
    const json = (await res.json()) as { data?: PublicSuggestion[] }

    return json.data ?? []
  } catch {
    return []
  }
}

const NAME_UIDS = {
  accessibility: "api::accessibility.accessibility",
  amenities: "api::amenity.amenity",
  services: "api::service.service",
} as const

const MAX_NAMES = 200

async function fetchNames(
  uid: (typeof NAME_UIDS)[keyof typeof NAME_UIDS]
): Promise<string[]> {
  try {
    const result = (await PublicStrapiClient.fetchMany(
      uid,
      {
        fields: ["name"],
        sort: { name: "asc" },
        pagination: { pageSize: MAX_NAMES },
        status: "published",
      } as never,
      { next: { revalidate: 3600 } }
    )) as { data?: { name?: string | null }[] }

    return (result.data ?? [])
      .map((r) => r.name)
      .filter((n): n is string => typeof n === "string")
  } catch {
    return []
  }
}

/**
 * The published accessibility, amenity and service names, sorted and
 * capped (at most 200 each), plus the library-type enum — for the
 * suggestion form's "is this already on the list?" check.
 */
export async function fetchOptionNames(): Promise<
  Record<SuggestionList, string[]>
> {
  const [accessibility, amenities, services] = await Promise.all([
    fetchNames(NAME_UIDS.accessibility),
    fetchNames(NAME_UIDS.amenities),
    fetchNames(NAME_UIDS.services),
  ])

  return {
    accessibility,
    amenities,
    services,
    library_types: [...LIBRARY_TYPES],
  }
}

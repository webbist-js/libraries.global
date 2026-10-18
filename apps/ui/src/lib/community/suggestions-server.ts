import "server-only"

import { DEFAULT_LOCALE } from "@repo/shared-data"

import { strapiServiceHeaders } from "@/lib/bridge-user-headers"
import type {
  OptionCatalogue,
  PublicSuggestion,
  SuggestionList,
  SuggestionReviewRound,
} from "@/lib/community/suggestions"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function fetchSuggestionBoard(): Promise<{
  data: PublicSuggestion[]
  round: SuggestionReviewRound | null
}> {
  try {
    const res = await fetch(
      `${STRAPI}/api/content-moderation/option-suggestions`,
      { cache: "no-store", headers: strapiServiceHeaders() }
    )
    if (!res.ok) return { data: [], round: null }
    const json = await res.json()

    return { data: json.data ?? [], round: json.round ?? null }
  } catch {
    return { data: [], round: null }
  }
}

export async function fetchPublicSuggestions(): Promise<PublicSuggestion[]> {
  return (await fetchSuggestionBoard()).data
}

/** Full published catalogue with translated documents overriding default-language entries. */
export async function fetchOptionCatalogue(
  locale: string = DEFAULT_LOCALE
): Promise<OptionCatalogue> {
  try {
    const response = await fetch(
      `${STRAPI}/api/content-moderation/option-catalogue?locale=${encodeURIComponent(locale)}`,
      { cache: "no-store", headers: strapiServiceHeaders() }
    )
    if (response.ok) {
      const body = await response.json()

      return { ...body.data, categories: body.categories }
    }
  } catch {
    /* Catalogue errors must not stop the public suggestion board. */
  }
  console.warn("[suggestions] Published checklist catalogue unavailable.")

  return { accessibility: [], services: [], amenities: [], library_types: [] }
}

/** Name-only compatibility projection for duplicate checks. */
export async function fetchOptionNames(
  locale = DEFAULT_LOCALE
): Promise<Record<SuggestionList, string[]>> {
  const catalogue = await fetchOptionCatalogue(locale)

  return {
    accessibility: catalogue.accessibility.map((item) => item.name),
    amenities: catalogue.amenities.map((item) => item.name),
    services: catalogue.services.map((item) => item.name),
    library_types: catalogue.library_types.map((item) => item.name),
  }
}

import type { FindPlaceLevel } from "@/lib/find-places"
import type { FindPlaceRef } from "@/lib/find-search"

/** Public browser boundary; server consumers import the catalogue reader directly. */
export async function findPlaceCatalogue(
  place: { level: FindPlaceLevel; slug: string },
  locale?: string
): Promise<Partial<Record<FindPlaceLevel, FindPlaceRef>> | undefined> {
  if (typeof window === "undefined") return undefined
  try {
    const response = await fetch(
      `/api/place-catalogue?${new URLSearchParams({ ...place, ...(locale ? { locale } : {}) })}`
    )
    if (!response.ok) return undefined

    return (await response.json()).data ?? undefined
  } catch {
    return undefined
  }
}

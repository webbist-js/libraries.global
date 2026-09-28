import type { Core } from "@strapi/strapi"

export type LibraryTally = {
  count: number
  /** Mean position of the child's libraries, or null when none are located. */
  center: { lat: number; lng: number } | null
}

type TallyRow = {
  location?: { lat?: unknown; lng?: unknown } | null
  country?: { documentId?: string } | null
  region?: { documentId?: string } | null
}

const toCoord = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number.parseFloat(value) : value

  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/**
 * Published-library count and mean position per child location (countries of
 * a continent, regions of a country), from one query over the parent's
 * libraries. Children with no libraries are absent from the map.
 */
export async function tallyLibrariesByChild(
  strapi: Core.Strapi,
  opts: {
    parent: "continent" | "country"
    parentDocumentId: string
    child: "country" | "region"
    locale?: string
    status: "draft" | "published"
  }
): Promise<Map<string, LibraryTally>> {
  const tallies = new Map<
    string,
    { count: number; lat: number; lng: number; located: number }
  >()

  const rows = (await strapi.documents("api::library.library").findMany({
    filters: {
      [opts.parent]: { documentId: { $eq: opts.parentDocumentId } },
    } as never,
    fields: ["location"] as never,
    populate: { [opts.child]: { fields: ["documentId"] } } as never,
    locale: opts.locale,
    status: opts.status,
  })) as unknown as TallyRow[]

  for (const row of rows) {
    const childId = row[opts.child]?.documentId
    if (!childId) continue
    const entry = tallies.get(childId) ?? {
      count: 0,
      lat: 0,
      lng: 0,
      located: 0,
    }
    entry.count += 1
    const lat = toCoord(row.location?.lat)
    const lng = toCoord(row.location?.lng)
    if (lat !== null && lng !== null) {
      entry.lat += lat
      entry.lng += lng
      entry.located += 1
    }
    tallies.set(childId, entry)
  }

  return new Map(
    [...tallies].map(([id, t]) => [
      id,
      {
        count: t.count,
        center: t.located
          ? { lat: t.lat / t.located, lng: t.lng / t.located }
          : null,
      },
    ])
  )
}

/** The child's own map centre when set, else the mean of its libraries. */
export function centerFor(
  mapConfig: { centerLat?: unknown; centerLng?: unknown } | null | undefined,
  tally: LibraryTally | undefined
): { lat: number; lng: number } | null {
  const lat = toCoord(mapConfig?.centerLat)
  const lng = toCoord(mapConfig?.centerLng)
  if (lat !== null && lng !== null) return { lat, lng }

  return tally?.center ?? null
}

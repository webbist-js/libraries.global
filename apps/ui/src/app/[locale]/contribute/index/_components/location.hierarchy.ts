import type { PlaceAddress } from "@/lib/geocode/place"

import { atlasCountryCodes, matchByName } from "./location.apply"
import type { FormData } from "./wizard.types"

type Option = { documentId: string; name: string }
type AtlasCountry = Option & { continentDocumentId: string }

/** What a lookup writes to the hierarchy, and the atlas name of the country. */
export type HierarchyFill = Pick<
  FormData,
  | "continentDocumentId"
  | "countryDocumentId"
  | "regionDocumentId"
  | "areaDocumentId"
  | "country"
>

async function list<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Atlas lookup failed: ${url}`)
  const json = (await res.json()) as { data?: T[] }

  return Array.isArray(json.data) ? json.data : []
}

/**
 * Where an address sits in the atlas, starting from what the form has.
 * Continent and country come from the ISO code; a different country
 * replaces the selection, as choosing it in the selects would. Region and
 * area are matched by name, only while empty. Null when the country isn't
 * in the atlas or a lookup failed.
 */
export async function resolveHierarchy(
  form: FormData,
  address: PlaceAddress
): Promise<HierarchyFill | null> {
  const codes = atlasCountryCodes(address)
  if (codes.length === 0) return null

  try {
    const [country] = await list<AtlasCountry>(
      `/api/relations/countries?iso2=${encodeURIComponent(codes.join(","))}`
    )
    if (!country) return null

    const moved = form.countryDocumentId !== country.documentId
    const fill: HierarchyFill = moved
      ? {
          continentDocumentId: country.continentDocumentId,
          countryDocumentId: country.documentId,
          regionDocumentId: "",
          areaDocumentId: "",
          country: country.name,
        }
      : {
          continentDocumentId: form.continentDocumentId,
          countryDocumentId: form.countryDocumentId,
          regionDocumentId: form.regionDocumentId,
          areaDocumentId: form.areaDocumentId,
          country: country.name,
        }

    if (!fill.regionDocumentId) {
      const regions = await list<Option>(
        `/api/relations/regions?countryDocumentId=${encodeURIComponent(fill.countryDocumentId)}`
      )
      fill.regionDocumentId =
        matchByName(regions, [
          address.state,
          address.county,
          address.city,
          address.district,
        ]) ?? ""
    }
    if (fill.regionDocumentId && !fill.areaDocumentId) {
      const areas = await list<Option>(
        `/api/relations/areas?regionDocumentId=${encodeURIComponent(fill.regionDocumentId)}`
      )
      fill.areaDocumentId =
        matchByName(areas, [address.county, address.city, address.district]) ??
        ""
    }

    return fill
  } catch {
    return null
  }
}

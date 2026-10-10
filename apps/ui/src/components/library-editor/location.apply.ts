import { formatCoord } from "@/lib/geocode/coordinates"
import type { Place, PlaceAddress } from "@/lib/geocode/place"

import type { FormData } from "./wizard.types"

/** The address fields a place can fill. */
export const ADDRESS_KEYS = [
  "streetAddress",
  "district",
  "city",
  "postalCode",
  "country",
] as const satisfies readonly (keyof FormData & keyof PlaceAddress)[]

const LOCATION_KEYS = [...ADDRESS_KEYS, "lat", "lng"] as const

/** The form with the parts of `address` that aren't empty written over it. */
export function withAddress(form: FormData, address: PlaceAddress): FormData {
  const next = { ...form }
  for (const key of ADDRESS_KEYS) if (address[key]) next[key] = address[key]

  return next
}

/** A search result picked: its address parts and its coordinates. */
export function applyPlace(form: FormData, place: Place): FormData {
  return {
    ...withAddress(form, place.address),
    lat: formatCoord(place.lat),
    lng: formatCoord(place.lng),
  }
}

/** No address field has anything in it (the coordinates don't count). */
export function addressIsEmpty(form: FormData): boolean {
  return ADDRESS_KEYS.every((key) => !form[key].trim())
}

/** The address and coordinates as one string, to tell when they change. */
export function locationKey(form: FormData): string {
  return LOCATION_KEYS.map((key) => form[key]).join("\u0000")
}

// The atlas files the UK as its four countries, by ISO 3166-2 code.
const SUBDIVISIONS = new Map([
  [
    "GB",
    new Map([
      ["england", "GB-ENG"],
      ["scotland", "GB-SCT"],
      ["wales", "GB-WLS"],
      ["northern ireland", "GB-NIR"],
    ]),
  ],
])

/** The atlas country codes to try for an address, most specific first. */
export function atlasCountryCodes(address: PlaceAddress): string[] {
  const code = address.countryCode
  if (!code) return []
  const part = SUBDIVISIONS.get(code)?.get(address.state.trim().toLowerCase())

  return part ? [part, code] : [code]
}

const QUALIFIER = /^(?:the|greater|county of|city of) /

/**
 * A place name compared loosely: case, accents, spacing and a leading
 * "The", "Greater", "County of" or "City of" don't count.
 */
export function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .replace(QUALIFIER, "")
}

/** The one option named like any of `names`; null for none or several. */
export function matchByName(
  options: readonly { documentId: string; name: string }[],
  names: readonly string[]
): string | null {
  const wanted = new Set(names.map(placeKey).filter(Boolean))
  const hits = options.filter((option) => wanted.has(placeKey(option.name)))

  return hits.length === 1 ? (hits[0]?.documentId ?? null) : null
}

// Photon (OpenStreetMap) features, normalised to what the Index editor needs.
// Shared by the server routes that call Photon and the client that shows
// the results.

export interface PlaceAddress {
  streetAddress: string
  district: string
  city: string
  postalCode: string
  /** In English, as Photon names it: "United Kingdom". */
  country: string
  /** ISO 3166-1 alpha-2, upper-case: "GB". Empty when unknown. */
  countryCode: string
  state: string
  county: string
}

export interface Place {
  /** OSM type and id: "W4680891". */
  id: string
  /** The place's name, or its street line when it has none. */
  label: string
  /** Where it is: "96 Euston Road, Somers Town, London, England, United Kingdom". */
  detail: string
  /** What it is: "Library", "Street", "Village". */
  kind: string
  lat: number
  lng: number
  /** A building or an address, not a street, settlement or region. */
  precise: boolean
  address: PlaceAddress
}

type PhotonKey =
  | "osm_type"
  | "osm_key"
  | "osm_value"
  | "type"
  | "name"
  | "housenumber"
  | "street"
  | "locality"
  | "district"
  | "city"
  | "county"
  | "state"
  | "country"
  | "postcode"
  | "countrycode"

/** The parts of a Photon GeoJSON feature we read. */
export interface PhotonFeature {
  geometry?: { coordinates?: number[] }
  properties?: Partial<Record<PhotonKey, string>> & { osm_id?: number }
}

// Countries that write the house number after the street: "Ludwigstraße 16".
const NUMBER_AFTER_STREET = new Set([
  "AR",
  "AT",
  "BA",
  "BE",
  "BO",
  "BR",
  "CH",
  "CL",
  "CO",
  "CR",
  "CZ",
  "DE",
  "DK",
  "EC",
  "ES",
  "FI",
  "GR",
  "GT",
  "HN",
  "HR",
  "HU",
  "IS",
  "IT",
  "LI",
  "LU",
  "ME",
  "MK",
  "MX",
  "NI",
  "NL",
  "NO",
  "PA",
  "PE",
  "PL",
  "PT",
  "PY",
  "RO",
  "RS",
  "SE",
  "SI",
  "SK",
  "SV",
  "TR",
  "UY",
  "VE",
])

const SETTLEMENTS = new Set(["city", "town", "village", "hamlet"])

const KINDS = new Map([
  ["library", "Library"],
  ["museum", "Museum"],
  ["archive", "Archive"],
  ["university", "University"],
  ["college", "College"],
  ["school", "School"],
  ["place_of_worship", "Place of worship"],
  ["community_centre", "Community centre"],
  ["arts_centre", "Arts centre"],
  ["townhall", "Town hall"],
  ["house", "Address"],
  ["city", "City"],
  ["town", "Town"],
  ["village", "Village"],
  ["hamlet", "Hamlet"],
])

type Props = NonNullable<PhotonFeature["properties"]>

const text = (value: string | undefined) => value?.trim() ?? ""

/** The street with its number, in the order the country writes them. */
export function streetLine(
  street: string,
  housenumber: string,
  countryCode: string
): string {
  if (!street) return ""
  if (!housenumber) return street

  return NUMBER_AFTER_STREET.has(countryCode)
    ? `${street} ${housenumber}`
    : `${housenumber} ${street}`
}

function kindOf(props: Props): string {
  const value = text(props.osm_value)
  const known = KINDS.get(value)
  if (known) return known
  if (props.type === "street") return "Street"
  if (!value || value === "yes") return "Place"
  const words = value.replaceAll("_", " ")

  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** One Photon feature as a Place, or null without a position or a name. */
export function toPlace(feature: PhotonFeature): Place | null {
  const p: Props = feature.properties ?? {}
  const [lng, lat] = feature.geometry?.coordinates ?? []
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const countryCode = text(p.countrycode).toUpperCase()
  const name = text(p.name)
  const isStreet = p.type === "street"
  const isSettlement =
    p.osm_key === "place" && SETTLEMENTS.has(text(p.osm_value))
  const precise = p.type === "house" || !!text(p.housenumber)
  const street = streetLine(
    text(p.street) || (isStreet ? name : ""),
    text(p.housenumber),
    countryCode
  )
  // Photon's `city` is the district council in some countries (Haworth's is
  // "Bradford"), so a settlement is its own city.
  const city = isSettlement ? name : text(p.city) || text(p.locality)
  const district = text(p.district) === city ? "" : text(p.district)
  const label = name || street || city
  if (!label) return null

  const where = [
    street,
    district,
    city,
    text(p.county),
    text(p.state),
    text(p.country),
  ]

  return {
    id: `${text(p.osm_type)}${p.osm_id ?? ""}` || `${lat},${lng}`,
    label,
    detail: [...new Set(where.filter((part) => part && part !== label))].join(
      ", "
    ),
    kind: kindOf(p),
    lat,
    lng,
    precise,
    address: {
      streetAddress: street,
      district,
      city,
      // A settlement's postcode is one of many: only an address or a street
      // has its own.
      postalCode: precise || isStreet ? text(p.postcode) : "",
      country: text(p.country),
      countryCode,
      state: text(p.state),
      county: text(p.county),
    },
  }
}

/** A Photon FeatureCollection as Places, without duplicates. */
export function toPlaces(json: unknown): Place[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const seen = new Set<string>()
  const places: Place[] = []
  for (const feature of features) {
    const place = toPlace(feature as PhotonFeature)
    if (!place || seen.has(place.id)) continue
    seen.add(place.id)
    places.push(place)
  }

  return places
}

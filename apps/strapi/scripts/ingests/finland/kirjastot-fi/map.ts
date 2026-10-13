import { nameKey, type SourcePlace } from "./geography"
import { DATASET_KEY } from "./source"
import type { LibraryCreateData } from "../../../strapi-client"
import { slugify } from "../../_shared/text"

export interface MappedLibrary {
  recordId: string
  areaKey: string
  data: LibraryCreateData & { slug: string }
  warnings: string[]
}

const TYPES: Record<string, string> = {
  municipal: "Public",
  mobile: "Mobile",
  children: "Public",
  music: "Special",
  institutional: "Special",
  special: "Special",
  university: "University",
  polytechnic: "Academic",
  school: "Academic",
  vocational_college: "Academic",
  other: "Other",
}

export function mapLibrary(
  row: any,
  cities: Record<string, any>,
  geography: SourcePlace[]
): MappedLibrary | { recordId: string; name: string; reason: string } {
  const recordId = String(row.id)
  if (
    !Number.isSafeInteger(row.id) ||
    row.id <= 0 ||
    typeof row.name !== "string" ||
    !row.name.trim()
  )
    throw new Error(`Invalid library identity ${recordId}`)
  if (row.type === "home_service")
    return {
      recordId,
      name: row.name,
      reason: "Home delivery service; not a library institution to visit",
    }
  const libraryType = TYPES[row.type]
  if (!libraryType)
    throw new Error(`Unknown library type ${row.type} for ${recordId}`)
  const city = cities[String(row.city)]
  if (!city || typeof city.name !== "string")
    throw new Error(`No municipality reference for library ${recordId}`)
  const candidates = geography.filter(
    (place) =>
      place.level === "area" &&
      place.names.some((name) => nameKey(name) === nameKey(city.name))
  )
  if (candidates.length !== 1)
    throw new Error(
      `Library ${recordId}: municipality ${city.name} matches ${candidates.length} Areas`
    )
  const area = candidates[0]!
  const warnings: string[] = []
  const data: MappedLibrary["data"] = {
    name: row.name.trim(),
    slug: `${slugify(row.name)}-${area.country.toLowerCase()}-${recordId}`,
    libraryType,
    operationalStatus: "unknown",
    timezone: "Europe/Helsinki",
    source: DATASET_KEY,
    sourceUrl: `https://api.kirjastot.fi/v4/library/${recordId}`,
  }
  if (row.type === "municipal" || row.type === "mobile")
    data.operatorType = "Municipality"
  if (row.type === "university") data.operatorType = "University"
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() && value.trim() !== "-"
      ? value.trim()
      : undefined
  for (const [field, value] of Object.entries({
    streetAddress: row.address?.street,
    city: row.address?.city ?? area.name,
    postalCode: row.address?.zipcode,
    shortName: row.shortName,
    phone: row.primaryContactInfo?.phone?.number,
  })) {
    if (text(value)) data[field] = text(value)
  }
  const email = text(row.primaryContactInfo?.email?.email)
  if (email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) data.email = email
    else warnings.push("Invalid contact email omitted")
  }
  const website = text(row.primaryContactInfo?.homepage?.url)
  if (website) {
    try {
      const url = new URL(website)
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("Unsupported protocol")
      data.website = url.toString()
    } catch {
      warnings.push("Invalid website URL omitted")
    }
  }
  const coordinates = row.coordinates
  if (
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lon) &&
    coordinates.lat >= 59 &&
    coordinates.lat <= 71 &&
    coordinates.lon >= 19 &&
    coordinates.lon <= 32
  ) {
    data.location = { lat: coordinates.lat, lng: coordinates.lon }
  } else
    warnings.push(
      "Missing or invalid coordinates; contributor can add a map pin"
    )
  if (row.founded != null) {
    if (
      Number.isInteger(row.founded) &&
      row.founded >= 1000 &&
      row.founded <= new Date().getUTCFullYear()
    )
      data.foundedYear = String(row.founded)
    else warnings.push("Invalid foundation year omitted")
  }
  if (libraryType === "Mobile")
    warnings.push(
      "Address and pin describe the source's base; no timetable or live position inferred"
    )

  return { recordId, areaKey: area.key, data, warnings }
}

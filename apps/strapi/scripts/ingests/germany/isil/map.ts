/**
 * German ISIL library mapping from JSONLD + PICA records.
 * Source: Deutsches ISIL-Verzeichnis (DNB), CC0 1.0
 */

import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directorySlug,
  directoryUrl as cleanUrl,
} from "../../_shared/directory-fields"

export interface GermanLibrary {
  isil: string
  name: string
  shortName?: string
  alternateNames?: string[]
  streetAddress?: string
  city?: string
  postalCode?: string
  phone?: string
  website?: string
  catalogueUrl?: string
  latitude?: number
  longitude?: number
  land?: string
  areaName?: string
  placeCode?: string
  libraryType?: string
  operatorType?: string
  operatorName?: string
  dissolved?: boolean
  parentIsil?: string
}

// Type code mapping per ISIL registry (field 035E $f)
const TYPE_MAP: Record<string, string> = {
  "11": "National",
  "15": "National", // Central subject library (owner decision, 3 November 2026)
  "21": "Regional",
  "33": "Public",
  "34": "Public", // Mediathek
  "36": "Specific User Groups",
  "39": "Mobile",
  "60": "University", // Central
  "65": "University", // Departmental
  "70": "Academic",
  "73": "Academic",
  "81": "Special",
  // Archives are in scope (owner decision, 3 November 2026).
  "51": "Archive",
  "52": "Archive",
  "53": "Archive",
  "54": "Archive",
  "55": "Archive",
  "56": "Archive",
  "57": "Archive",
  "58": "Archive",
  "59": "Archive",
}

// German Länder (states) mapping
const LANDER_MAP: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bavaria",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hesse",
  MV: "Mecklenburg-Vorpommern",
  NI: "Lower Saxony",
  NW: "North Rhine-Westphalia",
  RP: "Rhineland-Palatinate",
  SL: "Saarland",
  SN: "Saxony",
  ST: "Saxony-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thuringia",
}

/**
 * Map ISIL record to library.
 * Returns string if record should be skipped (the reason), otherwise DirectoryLibrary.
 */
export function mapGermanLibrary(
  record: GermanLibrary
): DirectoryLibrary | string {
  // Validate required ISIL
  if (!record.isil || !record.isil.startsWith("DE-")) {
    return "Invalid or missing ISIL starting with DE-"
  }

  if (record.dissolved) {
    return "Dissolved institution (035E $a = I)"
  }

  // Type code comes from PICA field 035E via DNB SRU (not in JSONLD dump)
  const typeCode = record.libraryType ?? ""
  if (!TYPE_MAP[typeCode])
    return `Unsupported or missing registry type: ${typeCode}`

  // Land code also comes from PICA field 371 $f via SRU
  const names: Record<string, string> = {
    "Baden-Württemberg": "BW",
    Bayern: "BY",
    Berlin: "BE",
    Brandenburg: "BB",
    Bremen: "HB",
    Hamburg: "HH",
    Hessen: "HE",
    "Mecklenburg-Vorpommern": "MV",
    Niedersachsen: "NI",
    "Nordrhein-Westfalen": "NW",
    "Rheinland-Pfalz": "RP",
    Saarland: "SL",
    Sachsen: "SN",
    "Sachsen-Anhalt": "ST",
    "Schleswig-Holstein": "SH",
    Thüringen: "TH",
  }
  const land = record.land?.normalize("NFC").trim() ?? ""
  const regionName = LANDER_MAP[names[land] ?? land]
  if (!regionName) return `Unresolved registry region: ${land}`

  // Validate coordinates if present
  let location: { lat: number; lng: number } | undefined
  if (record.latitude !== undefined && record.longitude !== undefined) {
    const lat = Number(record.latitude)
    const lon = Number(record.longitude)
    // Germany bounds roughly: 47-55N, 6-15E
    if (lat >= 47 && lat <= 55 && lon >= 6 && lon <= 15) {
      location = { lat, lng: lon }
    } else {
      // Warn but don't exclude
      console.warn(`[${record.isil}] Coordinates out of bounds: ${lat},${lon}`)
    }
  }

  // Build name, handling shortName variants
  const name = record.name?.normalize("NFC").trim().replaceAll(/\s+/g, " ")
  if (!name || name.length > 255) {
    return "Missing or oversized official name (029A)"
  }

  // Validate postcodes are 5-digit
  const postalCode = record.postalCode
  if (postalCode && !/^\d{5}$/.test(postalCode)) {
    console.warn(
      `[${record.isil}] Invalid postcode (not 5 digits): ${postalCode}`
    )
  }

  // URL hygiene
  const website = record.website ? directoryUrl(record.website) : undefined
  const catalogueUrl = record.catalogueUrl
    ? directoryUrl(record.catalogueUrl)
    : undefined

  // Mobile libraries don't get location pins (omit location)
  const isMobile = typeCode === "39"

  return {
    recordId: record.isil,
    warnings:
      record.placeCode && !record.areaName
        ? [
            `Registry place code: ${record.placeCode}; district relation pending crosswalk`,
          ]
        : [],
    countryCode: "DE",
    regionAliases: [land],
    regionName,
    areaName: record.areaName,
    data: {
      slug: directorySlug(name, record.isil, 200),
      sourceUrl: `https://ld.zdb-services.de/resource/organisations/${record.isil}`,
      name,
      shortName:
        record.shortName && record.shortName !== name
          ? record.shortName
          : undefined,
      libraryType: TYPE_MAP[typeCode],
      operatorType: record.operatorType,
      operationalStatus: "unknown",
      location: isMobile ? undefined : location,
      timezone: isMobile ? "Europe/Berlin" : undefined,
      streetAddress: record.streetAddress,
      city: record.city,
      postalCode:
        postalCode && /^\d{5}$/.test(postalCode) ? postalCode : undefined,
      phone: record.phone,
      website,
      catalogueUrl,
    },
  }
}

/**
 * Clean and validate URLs for directory.
 */
function directoryUrl(url: string): string | undefined {
  return cleanUrl(url)
}

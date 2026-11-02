/**
 * German ISIL library mapping from JSONLD + PICA records.
 * Source: Deutsches ISIL-Verzeichnis (DNB), CC0 1.0
 */

import type { DirectoryLibrary } from "../../_shared/directory"

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
  "15": "Special", // National subject-specific library
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
  // TODO: Harvest type codes from DNB SRU endpoint, keyed by ISIL
  // For now, default to "Special" if type is not provided; harvest SRU data later
  const typeCode = record.libraryType || "81" // 81 = Wissenschaftliche Spezialbibliothek
  if (typeCode && !TYPE_MAP[typeCode]) {
    // Exclude archives and non-library records if type is explicitly present
    if (
      ["51", "52", "53", "54", "55", "56", "57", "58", "59"].includes(typeCode)
    ) {
      return "Archive (excluded in phase 1)"
    }
    if (
      [
        "82",
        "83",
        "84",
        "85",
        "86",
        "87",
        "88",
        "89",
        "91",
        "94",
        "95",
        "96",
        "97",
        "98",
      ].includes(typeCode)
    ) {
      return "Non-library institutional record (excluded)"
    }
  }

  // Land code also comes from PICA field 371 $f via SRU
  // TODO: Harvest Land codes from SRU; for now, default to "Other" or use postal code prefix
  const landCode = record.land
  const regionName = landCode ? LANDER_MAP[landCode] : "Unknown" // TODO: derive from postal code or set via SRU enrichment

  // Validate coordinates if present
  let location: { latitude: number; longitude: number } | undefined
  if (record.latitude !== undefined && record.longitude !== undefined) {
    const lat = Number(record.latitude)
    const lon = Number(record.longitude)
    // Germany bounds roughly: 47-55N, 6-15E
    if (lat >= 47 && lat <= 55 && lon >= 6 && lon <= 15) {
      location = { latitude: lat, longitude: lon }
    } else {
      // Warn but don't exclude
      console.warn(`[${record.isil}] Coordinates out of bounds: ${lat},${lon}`)
    }
  }

  // Build name, handling shortName variants
  const name = record.name
  if (!name) {
    return "Missing official name (foaf:name / 029A)"
  }

  const alternates: string[] = []
  if (record.shortName && record.shortName !== name) {
    alternates.push(record.shortName)
  }
  if (record.alternateNames) {
    alternates.push(
      ...record.alternateNames.filter(
        (n) => n && n !== name && !alternates.includes(n)
      )
    )
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
    countryCode: "DE",
    regionName,
    areaName: undefined, // Kreis matching would happen in geography phase
    data: {
      sourceRecordId: record.isil,
      sourceRecordUrl: `https://ld.zdb-services.de/resource/organisations/${record.isil}`,
      name,
      shortName:
        record.shortName && record.shortName !== name
          ? record.shortName
          : undefined,
      alternateNames: alternates.length > 0 ? alternates : undefined,
      libraryType: TYPE_MAP[typeCode],
      operatorType: record.operatorType,
      operatorName: record.operatorName,
      operationalStatus: "unknown",
      location: isMobile ? undefined : location,
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
  if (!url) return undefined

  try {
    const u = new URL(url)
    // Only HTTP(S)
    if (!["http:", "https:"].includes(u.protocol)) {
      return undefined
    }
    // No @ signs in authority (basic XSS check)
    if (u.hostname.includes("@")) {
      return undefined
    }

    return u.toString()
  } catch {
    return undefined
  }
}

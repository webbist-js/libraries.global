/**
 * Spanish library mapping from Ministerio de Cultura directory.
 * Source: Directorio de Bibliotecas Españolas, CC BY 4.0 (pending confirmation)
 */

import type { DirectoryLibrary } from "../../_shared/directory"

export interface SpanishLibrary {
  NIDEN: string
  Nombre: string
  "Nombre CA"?: string
  CodCA: string
  CodProvincia: string
  Municipio: string
  Longitud: number
  Latitud: number
  Tipología: string
  Tipo_Biblioteca?: string
  Gestión?: string
  Titularidad?: string
  Teléfono?: string
  Página_web?: string
  Acceso_catálogo?: string
  Año_Fundación?: string
  País?: string
}

// Type mapping for Spanish library types
const TYPE_MAP: Record<string, string> = {
  Públicas: "Public",
  Universitaria: "University",
  Nacional: "National",
  "Centrales de comunidades autónomas": "Regional",
  "De la Administración": "Special",
  "De Archivos": "Archive",
  "De museos y conjuntos arqueológicos": "Cultural",
  "De centros de investigación": "Special",
  "Otras bibliotecas especializadas": "Special",
  "De instituciones religiosas": "Special",
  "Bibliotecas para grupos específicos de usuarios (no especializadas)":
    "Specific User Groups",
}

// Spanish autonomous communities (INE codes)
const COMMUNITIES_MAP: Record<string, string> = {
  "01": "Andalucía",
  "02": "Aragón",
  "03": "Asturias",
  "04": "Balears, Illes",
  "05": "Canarias",
  "06": "Cantabria",
  "07": "Castilla y León",
  "08": "Castilla-La Mancha",
  "09": "Cataluña",
  "10": "Comunitat Valenciana",
  "11": "Extremadura",
  "12": "Galicia",
  "13": "Madrid",
  "14": "Murcia",
  "15": "Navarra",
  "16": "País Vasco",
  "17": "Rioja, La",
  "18": "Ceuta",
  "19": "Melilla",
}

/**
 * Map Spanish library record to directory library.
 * Returns string if record should be skipped, otherwise DirectoryLibrary.
 */
export function mapSpanishLibrary(
  record: SpanishLibrary
): DirectoryLibrary | string {
  // Validate required NIDEN
  if (!record.NIDEN) {
    return "Missing NIDEN (source record ID)"
  }

  if (!record.Nombre || record.Nombre.length > 255) {
    return "Missing or oversized name"
  }

  // Map community and province
  const regionName = COMMUNITIES_MAP[record.CodCA]
  if (!regionName) {
    return `Unknown community code: ${record.CodCA}`
  }

  // Validate coordinates (Spain bounds roughly: 36-44N, -10-5E)
  let location: { latitude: number; longitude: number } | undefined
  const lon = Number(record.Longitud)
  const lat = Number(record.Latitud)

  if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
    // Check bounds
    if (lat >= 36 && lat <= 44 && lon >= -10 && lon <= 5) {
      location = { latitude: lat, longitude: lon }
    } else {
      console.warn(
        `[${record.NIDEN}] Coordinates out of Spain bounds: ${lat},${lon}`
      )
    }
  }

  // Type mapping
  const typeStr = record.Tipología || "Otras bibliotecas especializadas"
  const libraryType = TYPE_MAP[typeStr] || "Other"

  // URL validation
  const website = record["Página_web"]
    ? directoryUrl(record["Página_web"])
    : undefined
  const catalogueUrl = record["Acceso_catálogo"]
    ? directoryUrl(record["Acceso_catálogo"])
    : undefined

  return {
    countryCode: "ES",
    regionName,
    areaName: undefined, // Province matching deferred to geography phase
    data: {
      sourceRecordId: record.NIDEN,
      sourceRecordUrl: `https://directoriobibliotecas.mcu.es/`,
      name: record.Nombre,
      alternateNames:
        record["Nombre CA"] && record["Nombre CA"] !== record.Nombre
          ? [record["Nombre CA"]]
          : undefined,
      libraryType,
      operatorType: record.Gestión ? operatorType(record.Gestión) : undefined,
      operatorName: record.Gestión,
      operationalStatus: "unknown",
      location: record["Tipo_Biblioteca"]?.includes("Bibliobús")
        ? undefined
        : location,
      streetAddress: record.Municipio,
      city: record.Municipio,
      phone: record.Teléfono,
      website,
      catalogueUrl,
      foundedYear: record["Año_Fundación"]
        ? Number.parseInt(record["Año_Fundación"])
        : undefined,
    },
  }
}

function operatorType(gestión: string): string | undefined {
  if (!gestión) return undefined
  gestión = gestión.toLowerCase()
  if (gestión.includes("ayuntamiento")) return "Municipality"
  if (gestión.includes("diputación") || gestión.includes("cabildo"))
    return "Regional Government"
  if (gestión.includes("ministerio") || gestión.includes("central"))
    return "National Government"
  if (gestión.includes("universidad")) return "University"
  if (gestión.includes("religios")) return "Religious Institution"
  if (gestión.includes("fundación")) return "Private Foundation"

  return undefined
}

function directoryUrl(url: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    if (!["http:", "https:"].includes(u.protocol)) return undefined
    if (u.hostname.includes("@")) return undefined

    return u.toString()
  } catch {
    return undefined
  }
}

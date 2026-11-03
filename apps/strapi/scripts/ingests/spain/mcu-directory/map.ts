/** Spanish ministry directory. Publisher licence remains unconfirmed. */
import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"

export interface SpanishLibrary {
  NIDEN: string
  Nombre: string
  "Nombre CA"?: string
  País?: string
  CodCA: string
  CA?: string
  CodProvincia: string
  Provincia?: string
  Municipio: string
  Entidad_Menor?: string
  Dirección?: string
  Distrito_Postal?: string
  Longitud: unknown
  Latitud: unknown
  Tipología: string
  Tipo_Biblioteca?: string
  Gestión?: string
  Titularidad?: string
  Teléfono?: string
  Página_web?: string
  Acceso_catálogo?: string
  Año_Fundación?: unknown
}
const TYPE_MAP: Record<string, string> = {
  Públicas: "Public",
  Universitaria: "University",
  "Biblioteca Nacional de España": "National",
  "Centrales de Comunidades Autónomas": "Regional",
  "De la Administración": "Special",
  "De Archivos": "Archive",
  "De museos y conjuntos arqueológicos": "Cultural",
  "De centros de investigación": "Special",
  "Otras bibliotecas especializadas": "Special",
  "De instituciones religiosas": "Special",
  "Bibliotecas para grupos específicos de usuarios (no especializadas)":
    "Specific User Groups",
  "De la Administración Corporativa": "Special",
  "De centros sanitarios": "Special",
  "De fundaciones": "Special",
  "De asociaciones": "Special",
  "Enseñanzas artísticas y deportivas": "Academic",
  "Centros Universitarios de la Defensa": "University",
  "De empresas o firmas comerciales": "Special",
}
const REGIONS: Record<string, string> = {
  "01": "Andalusia",
  "02": "Aragon",
  "03": "Asturias",
  "04": "Balearic Islands",
  "05": "Canary Islands",
  "06": "Cantabria",
  "07": "Castille and León",
  "08": "Castille-La Mancha",
  "09": "Catalonia",
  "10": "Valencia",
  "11": "Extremadura",
  "12": "Galicia",
  "13": "Madrid",
  "14": "Murcia",
  "15": "Navarre",
  "16": "Basque Country",
  "17": "La Rioja",
  "18": "Ceuta",
  "19": "Melilla",
}
const CMS_REGION_ALIASES: Record<string, string[]> = {
  "03": ["Principadode Asturias"],
  "04": ["Islas Baleares"],
  "05": ["Islas Canarias"],
  "07": ["Castillay León"],
  "13": ["Comunidadde Madrid"],
  "14": ["Regiónde Murcia"],
  "15": ["Comunidad Foralde Navarra"],
  "10": ["Comunidad Valenciana"],
  "18": ["Ceutay Melilla"],
  "19": ["Ceutay Melilla"],
}

export function mapSpanishLibrary(
  record: SpanishLibrary
): DirectoryLibrary | string {
  const id = directoryText(record.NIDEN),
    name = directoryText(record.Nombre)
  if (!id || !/^[\w-]+$/.test(id)) return "Missing or invalid NIDEN"
  if (!name || name.length > 255) return "Missing or oversized official name"
  if (record.País !== "España")
    return "Library abroad: host-country geography requires separate review"
  const regionName = REGIONS[record.CodCA]
  if (!regionName) return `Unknown autonomous community ${record.CodCA}`
  const mobile = /bibliob[uú]s|m[oó]vil/i.test(record.Tipo_Biblioteca ?? "")
  let libraryType = mobile ? "Mobile" : TYPE_MAP[record.Tipología]
  if (!libraryType) return `Unmapped library type: ${record.Tipología}`
  const manager = directoryText(record.Gestión) ?? ""
  if (libraryType === "Special" && /cortes|parlament/i.test(manager))
    libraryType = "Parliamentary"
  const point =
    directoryPoint(record.Latitud, record.Longitud, [35, 44.2, -10, 5]) ??
    directoryPoint(record.Latitud, record.Longitud, [27.5, 29.5, -18.5, -13])
  const warnings: string[] = []
  if (!point) warnings.push("Missing or out-of-bounds publisher coordinates")
  if (record.Titularidad && record.Titularidad !== record.Gestión)
    warnings.push("Owner differs from managing body")
  const postcode = directoryText(record.Distrito_Postal)
  if (
    postcode &&
    (!/^\d{5}$/.test(postcode) || !postcode.startsWith(record.CodProvincia))
  )
    warnings.push("Postcode differs from province code")
  const year = directoryText(record.Año_Fundación)

  return {
    recordId: id,
    countryCode: "ES",
    regionName,
    regionAliases: [
      ...(record.CA ? [record.CA] : []),
      ...(CMS_REGION_ALIASES[record.CodCA] ?? []),
    ],
    areaName: directoryText(record.Provincia),
    areaAliases:
      record.CodProvincia === "15"
        ? ["Provincia da Coruña"]
        : (record.Provincia ?? "")
            .split("/")
            .flatMap((name) => [
              `Provincia de ${name}`,
              `Província de ${name}`,
              `Province of ${name}`,
            ]),
    warnings,
    data: {
      name,
      slug: directorySlug(name, `es-mcu-${id}`, 200),
      libraryType,
      operationalStatus: "unknown",
      sourceUrl:
        "https://directoriobibliotecas.mcu.es/dimbe.cmd?apartado=descarga",
      streetAddress: directoryText(record.Dirección),
      city: directoryText(record.Municipio),
      district: directoryText(record.Entidad_Menor),
      postalCode: postcode && /^\d{5}$/.test(postcode) ? postcode : undefined,
      location: mobile ? undefined : point,
      timezone: mobile
        ? record.CodCA === "05"
          ? "Atlantic/Canary"
          : "Europe/Madrid"
        : undefined,
      phone: directoryText(record.Teléfono),
      website: directoryUrl(record.Página_web),
      catalogueUrl: directoryUrl(record.Acceso_catálogo),
      foundedYear:
        year &&
        /^\d{4}$/.test(year) &&
        Number(year) <= new Date().getUTCFullYear()
          ? year
          : undefined,
      operatorType: operatorType(manager),
      operatorName: manager || undefined,
    },
  }
}
function operatorType(manager: string): string | undefined {
  if (/ayuntamiento/i.test(manager)) return "Municipality"
  if (/diputaci[oó]n|cabildo|consell|comunidad|consejer[ií]a/i.test(manager))
    return "Regional Government"
  if (/ministerio|instituto cervantes|aecid/i.test(manager))
    return "National Government"
  if (/universidad/i.test(manager)) return "University"
  if (/religios|iglesia|di[oó]cesis/i.test(manager))
    return "Religious Institution"
  if (/fundaci[oó]n/i.test(manager)) return "Private Foundation"

  return undefined
}

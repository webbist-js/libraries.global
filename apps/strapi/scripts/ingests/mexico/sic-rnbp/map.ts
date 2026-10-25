import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"
import { slugify } from "../../_shared/text"

export type MexicanLibrary = Record<string, unknown>

// INEGI entity codes; the second name is the existing Atlas region name.
export const MEXICAN_STATES: Record<number, [string, string]> = {
  1: ["Aguascalientes", "Aguascalientes"],
  2: ["Baja California", "Baja California"],
  3: ["Baja California Sur", "Baja California Sur"],
  4: ["Campeche", "Campeche"],
  5: ["Coahuila de Zaragoza", "Coahuila"],
  6: ["Colima", "Colima"],
  7: ["Chiapas", "Chiapas"],
  8: ["Chihuahua", "Chihuahua"],
  9: ["Ciudad de México", "Mexico City"],
  10: ["Durango", "Durango"],
  11: ["Guanajuato", "Guanajuato"],
  12: ["Guerrero", "Guerrero"],
  13: ["Hidalgo", "Hidalgo"],
  14: ["Jalisco", "Jalisco"],
  15: ["México", "México"],
  16: ["Michoacán de Ocampo", "Michoacán"],
  17: ["Morelos", "Morelos"],
  18: ["Nayarit", "Nayarit"],
  19: ["Nuevo León", "Nuevo León"],
  20: ["Oaxaca", "Oaxaca"],
  21: ["Puebla", "Puebla"],
  22: ["Querétaro", "Querétaro"],
  23: ["Quintana Roo", "Quintana Roo"],
  24: ["San Luis Potosí", "San Luis Potosí"],
  25: ["Sinaloa", "Sinaloa"],
  26: ["Sonora", "Sonora"],
  27: ["Tabasco", "Tabasco"],
  28: ["Tamaulipas", "Tamaulipas"],
  29: ["Tlaxcala", "Tlaxcala"],
  30: ["Veracruz de Ignacio de la Llave", "Veracruz"],
  31: ["Yucatán", "Yucatán"],
  32: ["Zacatecas", "Zacatecas"],
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  ordm: "º",
  ordf: "ª",
  deg: "°",
  shy: "",
}

export function mexicanText(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return
  const decoded = String(value).replaceAll(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (!code.startsWith("#")) return ENTITIES[code] ?? entity
      const point =
        code.startsWith("#x") || code.startsWith("#X")
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1))

      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : entity
    }
  )
  const text = directoryText(decoded)

  return text && !/^(?:s\/?n|sin (?:dato|nombre)|no disponible)$/i.test(text)
    ? text
    : undefined
}

export function mexicanMunicipalityKey(row: MexicanLibrary) {
  return `${Number(row.estado_id)}:${slugify(mexicanText(row.nom_mun) ?? "")}`
}

/** Several Oaxaca municipalities share a name within one state. Never name-match these. */
export function ambiguousMexicanMunicipalities(rows: MexicanLibrary[]) {
  const codes = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = mexicanMunicipalityKey(row)
    const ids = codes.get(key) ?? new Set<string>()
    ids.add(String(row.municipio_id ?? ""))
    codes.set(key, ids)
  }

  return new Set(
    [...codes].filter(([, ids]) => ids.size > 1).map(([key]) => key)
  )
}

export function mapMexicanLibrary(
  row: MexicanLibrary,
  ambiguousMunicipalities = new Set<string>()
): DirectoryLibrary | string {
  const recordId = directoryText(row.rnbp_id)
  const name = mexicanText(row.rnbp_nombre)
  if (!recordId || !/^[1-9]\d*$/.test(recordId) || !name || name.length > 255)
    return "Missing or unsupported SIC identity/name"
  const state = MEXICAN_STATES[Number(row.estado_id)]
  if (!state || mexicanText(row.nom_ent) !== state[0])
    return "State code and name disagree; geography review required"
  const warnings: string[] = []
  const location = directoryPoint(
    row.gmaps_latitud,
    row.gmaps_longitud,
    [14.3, 32.8, -118.5, -86.5]
  )
  if (!location) warnings.push("No usable Mexican coordinates; pin omitted")
  const municipality = mexicanText(row.nom_mun)
  const ambiguousArea = ambiguousMunicipalities.has(mexicanMunicipalityKey(row))
  if (ambiguousArea)
    warnings.push(
      "Municipality name identifies multiple official codes; state placement retained"
    )
  const locality = mexicanText(row.nom_loc)
  const city =
    locality && !/^total del municipio$/i.test(locality) ? locality : undefined
  const operator = mexicanText(row.rnbp_adscripcion)
  const operatorType =
    /^Gobierno Municipal$/i.test(operator ?? "") ||
    /^Alcaldía\b/i.test(operator ?? "")
      ? "Municipality"
      : /^(?:Gobierno Estatal|Gobierno de la CDMX)$/i.test(operator ?? "")
        ? "Regional Government"
        : undefined
  const data: DirectoryLibrary["data"] = {
    name,
    slug: directorySlug(name, `mx-sic-${recordId}`),
    libraryType: "Public",
    operationalStatus: "unknown",
    sourceUrl: `https://sic.cultura.gob.mx/ficha.php?table=rnbp&table_id=${recordId}`,
    ...(operatorType ? { operatorType } : {}),
    ...(location ? { location } : {}),
    ...(city ? { city } : {}),
    ...(municipality ? { district: municipality } : {}),
  }
  for (const [source, target] of [
    ["rnbp_calle_numero", "streetAddress"],
    ["rnbp_telefono1", "phone"],
  ] as const) {
    const text = mexicanText(row[source])
    if (text && text.length <= 255) data[target] = text
    else if (text) warnings.push(`${target} exceeds the CMS limit; omitted`)
  }
  const postalCode = mexicanText(row.rnbp_cp)
  if (postalCode && /^\d{5}$/.test(postalCode)) data.postalCode = postalCode
  else if (postalCode) warnings.push("Invalid postal code; omitted")
  const website = directoryUrl(mexicanText(row.pagina_web))
  if (website) data.website = website

  return {
    recordId,
    countryCode: "MX",
    regionName: state[1],
    areaName: ambiguousArea ? undefined : municipality,
    warnings,
    data,
  }
}

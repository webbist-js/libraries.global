import { italianProvinceAliases } from "./provinces"
import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"

export interface ItalianLibrary {
  "codici-identificativi": { isil?: string }
  denominazioni?: { ufficiale?: string }
  "stato-registrazione"?: string | null
  "tipologia-funzionale"?: string
  indirizzo?: {
    regione?: string
    coordinate?: unknown[]
    provincia?: { nome?: string }
    comune?: { nome?: string }
    cap?: unknown
    "via-piazza"?: unknown
  }
  accesso?: { riservato?: unknown }
  contatti?: { tipo?: string; valore?: unknown }[]
}
// ICCU's official region names → the existing GeoNames placement hierarchy.
export const ITALIAN_REGIONS: Record<string, string> = {
  ABRUZZO: "Abruzzo",
  BASILICATA: "Basilicata",
  CALABRIA: "Calabria",
  CAMPANIA: "Campania",
  "EMILIA-ROMAGNA": "Emilia-Romagna",
  "FRIULI-VENEZIA GIULIA": "Friuli Venezia Giulia",
  LAZIO: "Lazio",
  LIGURIA: "Liguria",
  LOMBARDIA: "Lombardy",
  MARCHE: "The Marches",
  MOLISE: "Molise",
  PIEMONTE: "Piedmont",
  PUGLIA: "Apulia",
  SARDEGNA: "Sardinia",
  SICILIA: "Sicily",
  TOSCANA: "Tuscany",
  "TRENTINO-ALTO ADIGE/SÜDTIROL": "Trentino-Alto Adige",
  UMBRIA: "Umbria",
  "VALLE D'AOSTA/VALLÉE D'AOSTE": "Aosta Valley",
  VENETO: "Veneto",
}
const TYPES: Record<string, string> = {
  Pubblica: "Public",
  Specializzata: "Special",
  "Istituto di insegnamento superiore": "Academic",
  Scolastica: "Academic",
  "Di conservazione": "Special",
  "Importante non specializzata": "Other",
  Itinerante: "Mobile",
  Nazionale: "National",
  "NON SPECIFICATA": "Other",
}

export function mapItalianLibrary(
  row: ItalianLibrary
): DirectoryLibrary | string {
  const recordId = directoryText(row["codici-identificativi"]?.isil)
  const name = directoryText(row.denominazioni?.ufficiale)
  if (
    !recordId ||
    !/^IT-[A-Z]{2}\d{4}$/.test(recordId) ||
    !name ||
    name.length > 255
  )
    return "Missing or unsupported ISIL/name"
  const state = directoryText(row["stato-registrazione"])
  // Registration states are not current opening-status evidence. Quarantine
  // closed, merged, administrative, uninhabitable and planned institutions.
  if (state && state !== "Biblioteca non censita")
    return `Excluded registration state: ${state}`
  const address = row.indirizzo ?? {}
  const regionName = ITALIAN_REGIONS[address.regione ?? ""]
  if (!regionName) return "Unrecognised Italian region"
  const libraryType = TYPES[row["tipologia-funzionale"] ?? ""]
  if (!libraryType) return "Unrecognised functional library type"
  const mobile = libraryType === "Mobile"
  const coordinates = address.coordinate
  const location =
    !mobile && Array.isArray(coordinates) && coordinates.length === 2
      ? directoryPoint(coordinates[0], coordinates[1], [35.4, 47.2, 6.5, 18.6])
      : undefined
  const warnings = [
    "Directory vintage does not establish current operation; status unknown",
  ]
  if (!location)
    warnings.push(
      mobile
        ? "Bookmobile base is not a stop; pin omitted"
        : "No usable WGS84 coordinates"
    )
  if (state) warnings.push(state)
  if (row.accesso?.riservato)
    warnings.push(
      "Restricted access reported; no appointment-only status inferred"
    )
  const website = (row.contatti ?? [])
    .filter((c) => c.tipo === "Url")
    .map((c) => directoryUrl(c.valore))
    .find(Boolean)
  const scalar = (value: unknown) => {
    const text = directoryText(value)

    return text && text.length <= 255 ? text : undefined
  }

  return {
    recordId,
    countryCode: "IT",
    regionName,
    regionAliases: [
      address.regione ?? "",
      ...(regionName === "Aosta Valley"
        ? ["Valled'Aosta", "Regione Autonoma Valle d'Aosta", "Valle d'Aosta"]
        : []),
    ],
    // Province names change and may use English exonyms locally; the preflight
    // reports unmatched Areas without inventing a province assignment.
    areaName: directoryText(address.provincia?.nome),
    areaAliases: italianProvinceAliases(
      directoryText(address.provincia?.nome) ?? ""
    ),
    warnings,
    data: {
      name,
      slug: directorySlug(name, recordId, 200),
      libraryType,
      operationalStatus: "unknown",
      ...(mobile ? { timezone: "Europe/Rome" } : {}),
      sourceUrl: `https://anagrafe.iccu.sbn.it/isil/${recordId}`,
      ...(location ? { location } : {}),
      ...(scalar(address["via-piazza"])
        ? { streetAddress: scalar(address["via-piazza"]) }
        : {}),
      ...(scalar(address.comune?.nome)
        ? { city: scalar(address.comune?.nome) }
        : {}),
      ...(scalar(address.cap) ? { postalCode: scalar(address.cap) } : {}),
      ...(website ? { website } : {}),
    },
  }
}

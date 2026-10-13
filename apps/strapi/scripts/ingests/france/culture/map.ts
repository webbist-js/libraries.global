import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"

export type FrenchLibrary = Record<string, any>
const REGIONS = new Set([
  "11",
  "24",
  "27",
  "28",
  "32",
  "44",
  "52",
  "53",
  "75",
  "76",
  "84",
  "93",
  "94",
])
const AREA_ALIASES = {
  "Loir-et-Cher": "Loire-et-Cher",
  "Haute-Garonne": "Upper Garonne",
  "Haute-Corse": "Upper Corsica",
  "Corse-du-Sud": "South Corsica",
}

export function mapFrenchLibrary(
  row: FrenchLibrary
): DirectoryLibrary | string {
  const recordId = directoryText(row.code_bib),
    name = directoryText(row.nom_de_l_etablissement)
  if (
    !recordId ||
    !/^(?:LI|BD)\d+$/.test(recordId) ||
    !name ||
    name.length > 255
  )
    return "Missing or unsupported library identity/name"
  if (!REGIONS.has(String(row.code_region)))
    return "Outside metropolitan France or missing region; overseas atlas countries need a separate placement adapter"
  const building = directoryText(row.type_adresse)
  if (!["Bâtiment ouvert", "Bibliobus"].includes(building ?? ""))
    return `No visitor building established: ${building ?? "unspecified"}`
  const mobile = building === "Bibliobus"
  const location = mobile
    ? undefined
    : directoryPoint(row.latitude, row.longitude, [41, 51.6, -5.5, 10])
  const warnings = []
  if (!location)
    warnings.push(
      mobile
        ? "Base coordinates do not identify bookmobile stops; pin omitted"
        : "No usable coordinates"
    )
  if (row.amplitude_horaire !== null)
    warnings.push(
      "Weekly opening total does not establish a daily schedule; hours omitted"
    )

  return {
    recordId,
    countryCode: "FR",
    regionName: row.region,
    areaName: AREA_ALIASES[row.departement] ?? directoryText(row.departement),
    warnings,
    data: {
      name,
      slug: directorySlug(name, `fr-${recordId}`),
      libraryType: mobile ? "Mobile" : "Public",
      ...(mobile ? { timezone: "Europe/Paris" } : {}),
      operationalStatus: "unknown",
      operatorType:
        row.statut === "Bibliothèque associative"
          ? "Independent"
          : /département/i.test(row.statut ?? "")
            ? "Regional Government"
            : "Municipality",
      sourceUrl: `https://www.data.gouv.fr/datasets/adresses-des-bibliotheques-publiques-2/#${recordId}`,
      ...(location ? { location } : {}),
      ...(directoryText(row.adresse) && String(row.adresse).length <= 255
        ? { streetAddress: directoryText(row.adresse) }
        : {}),
      ...(directoryText(row.ville) ? { city: directoryText(row.ville) } : {}),
      ...(directoryText(row.cp) ? { postalCode: directoryText(row.cp) } : {}),
      ...(directoryText(row.telephone) && String(row.telephone).length <= 255
        ? { phone: directoryText(row.telephone) }
        : {}),
      ...(directoryUrl(row.site_internet)
        ? { website: directoryUrl(row.site_internet) }
        : {}),
    },
  }
}

/**
 * Swiss ISIL Directory (Swiss National Library) → Library.
 * Source: https://www.isil.nb.admin.ch/opendata/latest.csv, open use (opendata.swiss).
 */

import type { DirectoryLibrary } from "../../_shared/directory"
import { isilSlug } from "../../_shared/isil-registry"

export const SWISS_URL = "https://www.isil.nb.admin.ch/opendata/latest.csv"

export type SwissIsilRow = Record<string, string>

/** Columns the mapping reads; a release without any of them needs review. */
export const SWISS_COLUMNS = [
  "ISIL",
  "Status",
  "Name-Original",
  "Institutionstyp",
  "Institutionskategorie",
  "Strasse",
  "Postleitzahl",
  "Ortschaft",
  "Kanton",
  "Land",
  "Webseite",
] as const

/** German canton names in the source → existing Atlas region names. */
export const SWISS_CANTON_ALIASES: Record<string, string> = {
  Freiburg: "Fribourg",
  Genf: "Genève",
  Luzern: "Lucerne",
  Neuenburg: "Neuchâtel",
  Tessin: "Ticino",
  Wallis: "Valais",
  Waadt: "Vaud",
}

export const SWISS_CANTONS = new Set([
  "Aargau",
  "Appenzell Ausserrhoden",
  "Appenzell Innerrhoden",
  "Basel-Landschaft",
  "Basel-Stadt",
  "Bern",
  "Fribourg",
  "Genève",
  "Glarus",
  "Graubünden",
  "Jura",
  "Lucerne",
  "Neuchâtel",
  "Nidwalden",
  "Obwalden",
  "Sankt Gallen",
  "Schaffhausen",
  "Schwyz",
  "Solothurn",
  "Thurgau",
  "Ticino",
  "Uri",
  "Valais",
  "Vaud",
  "Zug",
  "Zürich",
])

/**
 * Registry entries already represented by curated Libraries, reconciled by
 * street address and website in the first import. They are linked, never
 * created.
 */
export const SWISS_CURATED: Record<string, string> = {
  "CH-000008-6": "zentralbibliothek-zurich",
  "CH-000003-X": "eth-bibliothek",
  "CH-000011-1": "bibliothek-munstergasse",
}

/** Institutionskategorie → library type; the first matching rule wins. */
export function swissLibraryType(categories: string) {
  const values = new Set(categories.split("|"))
  if (values.has("Nationalbibliothek")) return "National"
  if (values.has("Hochschul- und Forschungsbibliothek")) return "Academic"
  if (
    values.has("Öffentliche und gemischte Bibliothek") ||
    values.has("Kantonsbibliothek")
  )
    return "Public"
  if (values.has("Spezialbibliothek")) return "Special"

  return "Other"
}

/** Returns the skip reason, or the Library with its canton placement. */
export function mapSwissLibrary(row: SwissIsilRow): DirectoryLibrary | string {
  if (row.Land !== "CH") return "Outside Switzerland"
  if (row.Status !== "aktiv") return "Inactive institution"
  if (!row.Institutionstyp.split("|").includes("Bibliothek"))
    return "Not explicitly classified as a library"
  const isil = row.ISIL
  if (!/^CH-\d{6}-[0-9X]$/.test(isil)) return `Invalid Swiss ISIL ${isil}`
  const name = row["Name-Original"]
  if (!name || name.length > 255) return "Missing or oversized original name"
  const regionName = SWISS_CANTON_ALIASES[row.Kanton] ?? row.Kanton
  if (!SWISS_CANTONS.has(regionName))
    return `Unresolved canton ${row.Kanton || "(none)"}`
  const warnings: string[] = []
  const text = (field: string) => {
    const value = row[field]
    if (!value) return
    if (value.length <= 255) return value
    warnings.push(`${field} exceeds the CMS field limit; omitted`)
  }
  const website = row.Webseite
  // Source text is kept as published; only explicit HTTP(S) addresses qualify.
  const validWebsite =
    /^https?:\/\//.test(website) && website.length <= 255 ? website : undefined
  if (website && !validWebsite)
    warnings.push("Website is not an HTTP(S) address; omitted")

  return {
    recordId: isil,
    warnings,
    countryCode: "CH",
    regionName,
    regionAliases: regionName === row.Kanton ? [] : [row.Kanton],
    data: {
      name,
      slug: isilSlug(name, isil),
      libraryType: swissLibraryType(row.Institutionskategorie),
      operationalStatus: "unknown",
      sourceUrl: SWISS_URL,
      streetAddress: text("Strasse"),
      city: text("Ortschaft"),
      postalCode: text("Postleitzahl"),
      website: validWebsite,
    },
  }
}

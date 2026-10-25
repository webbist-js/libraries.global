import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
} from "../../_shared/directory-fields"

export type CanadianFacility = Record<string, string>
export const CANADIAN_PROVINCES: Record<string, [string, string]> = {
  ab: ["Alberta", "48"],
  bc: ["British Columbia", "59"],
  mb: ["Manitoba", "46"],
  nb: ["New Brunswick", "13"],
  nl: ["Newfoundland and Labrador", "10"],
  ns: ["Nova Scotia", "12"],
  nt: ["Northwest Territories", "61"],
  nu: ["Nunavut", "62"],
  on: ["Ontario", "35"],
  pe: ["Prince Edward Island", "11"],
  qc: ["Quebec", "24"],
  sk: ["Saskatchewan", "47"],
  yt: ["Yukon", "60"],
}

const LIBRARY =
  /\blibrar(?:y|ies)\b|\bbiblioth[eèé]ques?\b|\bm[eé]diath[eèé]ques?\b/i
// These providers supply branch directories. Their branch names often omit "Library".
const BRANCH_PROVIDERS = new Set([
  "city of toronto",
  "city of ottawa",
  "edmonton",
  "vancouver",
  "saskatchewan",
])
const PUBLIC_DIRECTORY_PROVIDERS = new Set([
  ...BRANCH_PROVIDERS,
  "government of alberta",
  "government of british columbia",
  "government of manitoba",
  "government of new brunswick",
  "government of newfoundland and labrador",
  "government of nova scotia",
  "bibliotheque et archives nationales du québec",
])

export function canadianText(value: unknown) {
  const text = directoryText(value)

  return text && !/^\.\.$/.test(text) ? text : undefined
}

export function mapCanadianLibrary(
  row: CanadianFacility
): DirectoryLibrary | string {
  if (row.ODCAF_Facility_Type !== "library or archives")
    return "Not a library/archive facility"
  const id = directoryText(row.Index),
    name = canadianText(row.Facility_Name)
  if (!id || !/^[1-9]\d*$/.test(id) || !name || name.length > 255)
    return "Missing or unsupported ODCAF identity/name"
  const province = CANADIAN_PROVINCES[row.Prov_Terr]
  if (
    !province ||
    province[1] !== row.PRUID ||
    !/^\d{7}$/.test(row.CSDUID) ||
    !row.CSDUID.startsWith(row.PRUID)
  )
    return "Province and census identifiers disagree; geography review required"
  if (row.Provider === "government of ontario")
    return "Ontario statistics describe library systems; visitor branch not established"
  if (row.Provider === "canadian museums association")
    return "Museum-association library/archive entry requires individual institution review"
  const type = canadianText(row.Source_Facility_Type) ?? ""
  if (
    /\b(?:bookmobile|bibliobus|mobile|hq|headquarters|administration|administrative\s+(?:cent(?:re|er)|offices?|buildings?))\b/i.test(
      `${name} ${type}`
    )
  )
    return "Mobile base or administrative site; visitor branch not established"
  if (/\barchives?\b/i.test(`${name} ${type}`) && !LIBRARY.test(name))
    return "Archive without an explicitly named library"
  if (
    !LIBRARY.test(`${name} ${type}`) &&
    !/^(?:affiliée au réseau biblio|municipale|branch|crsbp)$/i.test(type) &&
    !(BRANCH_PROVIDERS.has(row.Provider) && !type)
  )
    return "Combined library/archive category does not establish a library"
  const warnings: string[] = []
  const location = directoryPoint(
    row.Latitude,
    row.Longitude,
    [41.6, 83.2, -141.1, -52.5]
  )
  if (!location) warnings.push("No usable Canadian coordinates; pin omitted")
  const city = canadianText(row.CSD_Name)
  if (
    canadianText(row.City) &&
    city &&
    row.City.toLowerCase() !== city.toLowerCase()
  )
    warnings.push(
      "Source city differs from census subdivision; census name retained"
    )
  const publicLibrary =
    PUBLIC_DIRECTORY_PROVIDERS.has(row.Provider) ||
    /\bpublic|publique|municipale|réseau biblio|crsbp/i.test(`${name} ${type}`)
  const data: DirectoryLibrary["data"] = {
    name,
    slug: directorySlug(name, `ca-odcaf-v1-${id}`),
    libraryType: /(?:^|[^\p{L}])(?:university|université)(?=$|[^\p{L}])/iu.test(
      name
    )
      ? "University"
      : publicLibrary
        ? "Public"
        : "Other",
    operationalStatus: "unknown",
    sourceUrl: "https://www.statcan.gc.ca/en/lode/databases/odcaf",
    ...(location ? { location } : {}),
    ...(city ? { city } : {}),
  }
  const address = canadianText(row.Source_Format_Address)
  if (address && address.length <= 255) data.streetAddress = address
  else if (address)
    warnings.push("streetAddress exceeds the CMS limit; omitted")
  const postalCode = canadianText(row.Postal_Code)
  if (postalCode && /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i.test(postalCode))
    data.postalCode = postalCode
      .toUpperCase()
      .replaceAll(/\s/g, "")
      .replace(/(.{3})(.{3})/, "$1 $2")
  else if (postalCode) warnings.push("Invalid postal code; omitted")

  // Census subdivisions are not the Atlas's county/district Areas. Keep region placement only.
  return {
    recordId: `v1.0-${id}`,
    countryCode: "CA",
    regionName: province[0],
    warnings,
    data,
  }
}

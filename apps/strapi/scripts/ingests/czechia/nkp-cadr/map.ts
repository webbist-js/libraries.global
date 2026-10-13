import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"

export type CzechLibrary = Record<string, Record<string, string>[]>
const REGIONS = { "Hlavní město Praha": "Prague", Vysočina: "Kraj Vysočina" }
const TYPES = {
  NK: "National",
  KK: "Public",
  MK: "Public",
  OK: "Public",
  VŠ: "University",
  VK: "Academic",
  ŠK: "Academic",
  CK: "Special",
  KI: "Special",
  "KI-MU": "Special",
  "KI-GA": "Special",
  AK: "Special",
  LK: "Special",
  SP: "Special",
}

export function czechCoordinates(value: unknown) {
  const input = directoryText(value)
  if (!input) return
  const decimal = /^(\d+(?:\.\d+)?)\s*N\s*,\s*(\d+(?:\.\d+)?)\s*E$/i.exec(input)
  if (decimal)
    return directoryPoint(decimal[1], decimal[2], [48.4, 51.2, 12, 19])
  const dms =
    /^(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?N\s*,\s*(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?E$/i.exec(
      input
    )
  if (!dms) return
  const [degreesN, minutesN, secondsN, degreesE, minutesE, secondsE] = dms
    .slice(1)
    .map(Number)
  if (minutesN >= 60 || secondsN >= 60 || minutesE >= 60 || secondsE >= 60)
    return

  return directoryPoint(
    degreesN + minutesN / 60 + secondsN / 3600,
    degreesE + minutesE / 60 + secondsE / 3600,
    [48.4, 51.2, 12, 19]
  )
}

export function mapCzechLibrary(row: CzechLibrary): DirectoryLibrary | string {
  const recordId = directoryText(row.SGL?.[0]?.a)
  if (!recordId || !/^[A-Z]{3}\d{3}$/.test(recordId))
    return "Missing or unsupported SIGLA identity"
  if (row.STT?.length)
    return `Inactive or unlocated institution: ${row.STT[0].a ?? row.STT[0].c}`
  const label = row.NAZ?.[0]
  const name = label
    ? [label.a, label.b, label.c, label.d]
        .map(directoryText)
        .filter(Boolean)
        .join(" — ")
    : ""
  const geography = row.KRJ?.[0]
  if (!name || name.length > 255 || !geography?.a)
    return "Missing readable name or current region"
  const address = row.ADR?.[0]
  const urls = row.URL ?? []
  const homepage = urls.find((value) => !value.z && directoryUrl(value.u))
  const catalogue = urls.find(
    (value) => /online katalog/i.test(value.z ?? "") && directoryUrl(value.u)
  )
  const typeCodes = (row.TYP ?? []).map((value) => value.a)
  const types = [
    ...new Set(typeCodes.map((code) => TYPES[code]).filter(Boolean)),
  ]
  const libraryType = types.length === 1 ? types[0] : "Other"
  const location =
    row.ADR?.length === 1 ? czechCoordinates(address?.g) : undefined
  const warnings = [
    "Free-text opening schedules and personal contacts not imported",
  ]
  if (!location)
    warnings.push(
      row.ADR?.length && row.ADR.length > 1
        ? "Multiple addresses; institution pin omitted"
        : "No usable coordinates"
    )
  if (types.length !== 1)
    warnings.push("Unrecognized or mixed source classification; type Other")
  const phone = directoryText(row.TEL?.[0]?.a)
  const pragueDistrict =
    row.ADR?.length === 1
      ? /^Praha\s+([1-9]|1\d|2[0-2])$/.exec(address?.m ?? "")
      : null
  const sourceArea = directoryText(geography.b)
  const areaName =
    geography.a === "Hlavní město Praha" && sourceArea === "Praha"
      ? pragueDistrict
        ? `Praha ${pragueDistrict[1]}`
        : undefined
      : sourceArea === "Brno-město"
        ? "Město Brno"
        : sourceArea

  return {
    recordId,
    countryCode: "CZ",
    regionName: REGIONS[geography.a] ?? geography.a,
    areaName,
    warnings,
    data: {
      name,
      slug: directorySlug(name, `cz-${recordId}`),
      libraryType,
      operationalStatus: "unknown",
      sourceUrl: `https://aleph.nkp.cz/F/?func=find-c&local_base=ADR&ccl_term=sgl=${recordId}`,
      ...(location ? { location } : {}),
      ...(directoryText(address?.u)
        ? { streetAddress: directoryText(address?.u) }
        : {}),
      ...(directoryText(address?.m ?? row.MES?.[0]?.a)
        ? { city: directoryText(address?.m ?? row.MES?.[0]?.a) }
        : {}),
      ...(directoryText(address?.c)
        ? { postalCode: directoryText(address?.c) }
        : {}),
      ...(homepage ? { website: directoryUrl(homepage.u) } : {}),
      ...(catalogue ? { catalogueUrl: directoryUrl(catalogue.u) } : {}),
      ...(phone && phone.length <= 255 ? { phone } : {}),
    },
  }
}

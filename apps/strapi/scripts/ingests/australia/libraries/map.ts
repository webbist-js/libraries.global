import { createHash } from "node:crypto"

import timezone from "tz-lookup"

import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
} from "../../_shared/directory-fields"

const STATES = {
  ACT: "Australian Capital Territory",
  NSW: "New South Wales",
  TAS: "Tasmania",
  VIC: "Victoria",
  WA: "Western Australia",
}

export function mapHistoricalAustralianLibrary(
  row: Record<string, string>
): DirectoryLibrary | string {
  if (row.State === "QLD") return "Superseded by the 2026 Queensland directory"
  if (!/^CC BY(?: 3\.0 AU| 4\.0)?$/.test(row.source_licence))
    return `Upstream redistribution terms not established: ${row.source_licence}`
  const regionName = STATES[row.State]
  const name = directoryText(row.Library),
    recordId = directoryText(row.ID)
  if (
    !regionName ||
    !name ||
    name.length > 255 ||
    !recordId ||
    !/^\d+$/.test(recordId)
  )
    return "Missing or unsupported state/name/ID"
  const mobile = /\bmobile\b|\bbookmobile\b/i.test(name)
  const basePoint = directoryPoint(
    row.latitude,
    row.longitude,
    [-44, -9, 112, 154]
  )
  if (mobile && !basePoint)
    return "Mobile service has no base point for timezone lookup"
  const location = mobile ? undefined : basePoint

  return {
    countryCode: "AU",
    regionName,
    recordId,
    warnings: [
      "Historical 2016–2018 source; present operation not established",
      ...(!location
        ? [mobile ? "Bookmobile base pin omitted" : "No usable coordinates"]
        : []),
    ],
    data: {
      name,
      slug: directorySlug(name, `au-higgs-${recordId}`),
      libraryType: mobile ? "Mobile" : "Public",
      ...(mobile ? { timezone: timezone(basePoint!.lat, basePoint!.lng) } : {}),
      operationalStatus: "unknown",
      sourceUrl: `https://doi.org/10.25439/rmt.21944840.v1#record-${recordId}`,
      ...(location ? { location } : {}),
      ...(directoryText(row.Address) && row.Address.length <= 255
        ? { streetAddress: directoryText(row.Address) }
        : {}),
      ...(directoryText(row.Suburb) ? { city: directoryText(row.Suburb) } : {}),
      ...(directoryText(row.Postcode)
        ? { postalCode: directoryText(row.Postcode) }
        : {}),
    },
  }
}

/** Repair only the repeated publisher prefix found in the source's Directory URL column. */
export function queenslandDirectoryUrl(value: unknown) {
  const input = directoryText(value)
  if (!input) return
  const prefix = "https://plconnect.slq.qld.gov.au"
  const suffix = input.replace(
    /^(?:https:\/\/plconnect\.slq\.qld\.gov\.au)+/,
    ""
  )

  return /^\/directory\/[a-z0-9/_-]+$/i.test(suffix)
    ? `${prefix}${suffix}`
    : undefined
}

export function mapQueenslandLibrary(
  row: Record<string, any>
): DirectoryLibrary | string {
  const sourceUrl = queenslandDirectoryUrl(row["Directory URL"])
  const name = directoryText(row["Branch Name"])
  if (!sourceUrl || !name || name.length > 255)
    return "Missing stable directory URL or readable name"
  const recordId = new URL(sourceUrl).pathname.slice("/directory/".length)
  const mobile = /mobile|bookmobile/i.test(
    `${row["Branch Type"] ?? ""} ${name}`
  )
  const location = mobile
    ? undefined
    : directoryPoint(
        row["Latitude (Decimal)"],
        row["Longitude (Decimal)"],
        [-29.2, -9, 137, 154]
      )
  const phone = directoryText(row.Phone)

  return {
    countryCode: "AU",
    regionName: "Queensland",
    recordId,
    warnings: [
      "Free-text opening hours not converted to a schedule",
      ...(!location
        ? [mobile ? "Bookmobile base pin omitted" : "No usable coordinates"]
        : []),
    ],
    data: {
      name,
      slug: directorySlug(
        name,
        `au-slq-${createHash("sha256").update(recordId).digest("hex").slice(0, 12)}`
      ),
      libraryType: mobile ? "Mobile" : "Public",
      ...(mobile ? { timezone: "Australia/Brisbane" } : {}),
      operationalStatus: "unknown",
      sourceUrl,
      ...(location ? { location } : {}),
      ...(directoryText(row["Address Line 1"])
        ? { streetAddress: directoryText(row["Address Line 1"]) }
        : {}),
      ...(directoryText(row["Address Locality"])
        ? { city: directoryText(row["Address Locality"]) }
        : {}),
      ...(directoryText(row["Address Postcode"])
        ? { postalCode: directoryText(row["Address Postcode"]) }
        : {}),
      ...(phone && phone.length <= 255 ? { phone } : {}),
    },
  }
}

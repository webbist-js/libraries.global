import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import path from "node:path"

import { CANADIAN_PROVINCES, type CanadianFacility } from "./map"
import { parseCsv } from "../../_shared/csv"

export const CANADA_URL =
  "https://www150.statcan.gc.ca/n1/en/pub/21-26-0001/2020001/ODCAF_V1.0.zip"
export const CANADA_SHA256 =
  "648714793d1b5513cfc2b3cf455b4ac0a5a350579f2164dfea1d0fa239468c39"

export function parseCanadianArchive(base64: string): {
  rows: CanadianFacility[]
  dataSources: Record<string, string>[]
} {
  const archive = Buffer.from(base64, "base64")
  if (createHash("sha256").update(archive).digest("hex") !== CANADA_SHA256)
    throw new Error(
      "ODCAF v1.0 archive changed; review the release before importing"
    )
  const files = JSON.parse(
    execFileSync(
      "/usr/bin/python3",
      [path.join(__dirname, "read-archive.py")],
      {
        input: archive,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      }
    )
  )
  const rows = parseCsv(files.csv),
    dataSources = parseCsv(files.dataSourcesCsv)
  if (rows.length !== 7972 || dataSources.length !== 169)
    throw new Error("Incomplete ODCAF v1.0 archive")
  validateCanadianRows(rows)

  return { rows, dataSources }
}

export function validateCanadianRows(rows: CanadianFacility[]) {
  const ids = new Set<string>()
  for (const row of rows) {
    if (!/^[1-9]\d*$/.test(row.Index ?? "") || ids.has(row.Index))
      throw new Error("Duplicate or missing ODCAF identity")
    ids.add(row.Index)
    for (const field of [
      "Facility_Name",
      "ODCAF_Facility_Type",
      "Source_Facility_Type",
      "Provider",
      "Prov_Terr",
      "PRUID",
      "CSDUID",
      "Latitude",
      "Longitude",
    ])
      if (!(field in row))
        throw new Error(`ODCAF source schema changed: missing ${field}`)
    if (row.Prov_Terr !== ".." && !CANADIAN_PROVINCES[row.Prov_Terr])
      throw new Error("Unknown ODCAF province")
  }
}

import path from "node:path"

import { CANADIAN_PROVINCES, mapCanadianLibrary } from "./map"
import { CANADA_SHA256, CANADA_URL, parseCanadianArchive } from "./source"
import { flag, type IngestArgs } from "../../_shared/cli"
import {
  executeDirectoryIngest,
  type DirectoryLibrary,
} from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"
import type { RunLogEntry } from "../../_shared/run-log"

export async function runCanada(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    {
      offline: Boolean(args.snapshot),
      refresh: flag(args, "refresh"),
    }
  )
  const snapshot = await sources.read<string>(
    "archive",
    CANADA_URL,
    undefined,
    async () => {
      const response = await fetch(CANADA_URL, {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok)
        throw new Error(`Canadian directory HTTP ${response.status}`)

      return Buffer.from(await response.arrayBuffer()).toString("base64")
    }
  )
  const { rows } = parseCanadianArchive(snapshot.data)
  const libraries: DirectoryLibrary[] = [],
    skipped: Omit<RunLogEntry, "status">[] = []
  for (const row of rows) {
    const record = mapCanadianLibrary(row)
    if (typeof record === "string")
      skipped.push({
        recordId: `v1.0-${row.Index}`,
        name: row.Facility_Name,
        reason: record,
      })
    else libraries.push(record)
  }
  const regions = [...new Set(libraries.map((row) => row.regionName))].sort()

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "ca-statcan-odcaf",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: rows.length,
    libraries,
    skipped,
    details: {
      sourceVintage: "ODCAF v1.0; collected January–July 2020",
      archiveSha256: CANADA_SHA256,
      coverage:
        "Historical Canadian library locations; incomplete national baseline. Archives, administrative/system records and uncertain library identities excluded.",
      regions,
      uncoveredRegions: Object.values(CANADIAN_PROVINCES)
        .map(([name]) => name)
        .filter((name) => !regions.includes(name))
        .sort(),
      areaPlacement:
        "Province/territory only; source census subdivisions do not establish Atlas county/district Areas",
    },
  })
}

import path from "node:path"

import {
  ambiguousMexicanMunicipalities,
  mapMexicanLibrary,
  mexicanText,
} from "./map"
import { MEXICO_URL, validateMexicanSource } from "./source"
import { flag, type IngestArgs } from "../../_shared/cli"
import {
  executeDirectoryIngest,
  type DirectoryLibrary,
} from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"
import type { RunLogEntry } from "../../_shared/run-log"

export async function runMexico(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    {
      offline: Boolean(args.snapshot),
      refresh: flag(args, "refresh"),
    }
  )
  const snapshot = await sources.read<unknown>("libraries", MEXICO_URL)
  validateMexicanSource(snapshot.data)
  const ambiguousMunicipalities = ambiguousMexicanMunicipalities(snapshot.data)
  const libraries: DirectoryLibrary[] = [],
    skipped: Omit<RunLogEntry, "status">[] = []
  for (const row of snapshot.data) {
    const record = mapMexicanLibrary(row, ambiguousMunicipalities)
    if (typeof record === "string")
      skipped.push({
        recordId: String(row.rnbp_id),
        name: mexicanText(row.rnbp_nombre) ?? "",
        reason: record,
      })
    else libraries.push(record)
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "mx-sic-rnbp",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: snapshot.data.length,
    libraries,
    skipped,
    details: {
      coverage:
        "SIC National Network of Public Libraries; all 32 Mexican states. Directory membership does not establish current operation.",
      sourceVintage:
        "Publisher download listed 2025-02-07; individual records have their own modification dates",
      ambiguousMunicipalities: [...ambiguousMunicipalities].sort(),
      regions: [...new Set(libraries.map((row) => row.regionName))].sort(),
    },
  })
}

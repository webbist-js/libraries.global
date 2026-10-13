import path from "node:path"

import { buildGeography, observationFor } from "./geography"
import { mapLibrary } from "./map"
import { FINLAND_PLACES } from "./places"
import { DATASET_KEY, loadFinland, POPULATION_DATASET } from "./source"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeIngest, type PipelineLibrary } from "../../_shared/execute"
import { JsonSources } from "../../_shared/json-source"
import type { RunLogEntry } from "../../_shared/run-log"

export async function runFinland(args: IngestArgs) {
  const allowed = new Set([
    "dataset",
    "dry-run",
    "apply",
    "check-cms",
    "limit",
    "concurrency",
    "snapshot",
    "refresh",
    "year",
    "log",
  ])
  for (const key of Object.keys(args))
    if (!allowed.has(key)) throw new Error(`Unknown Finland flag --${key}`)
  const year = args.year ? Number(args.year) : 2025
  if (!Number.isInteger(year) || year < 1900 || year > 2100)
    throw new Error("Invalid population --year")
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: !!args.snapshot, refresh: flag(args, "refresh") }
  )
  const source = await loadFinland(sources, year)
  const geography = buildGeography(source)
  const libraries: PipelineLibrary[] = []
  const skipped: Omit<RunLogEntry, "status">[] = []
  for (const row of source.directory.items) {
    const record = mapLibrary(row, source.directory.cities, geography)
    if ("reason" in record) skipped.push(record)
    else
      libraries.push({
        ...record,
        countryKey: geography.find((place) => place.key === record.areaKey)!
          .country,
      })
  }

  return executeIngest({
    args,
    directory: __dirname,
    dataset: DATASET_KEY,
    populationDataset: POPULATION_DATASET,
    inputs: sources.inputs,
    year,
    boundaryDate: source.boundaryDate,
    libraryRetrievedAt: source.libraryRetrievedAt,
    sourceCount: source.directory.items.length,
    libraries,
    geography,
    skipped,
    placeOptions: FINLAND_PLACES,
    observationFor: (place) => observationFor(place, source),
  })
}

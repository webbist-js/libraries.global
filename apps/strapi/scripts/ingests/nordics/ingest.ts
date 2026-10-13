import { mkdirSync } from "node:fs"
import path from "node:path"

import { buildNordicGeography, nordicObservation } from "./geography"
import { mapWikidata } from "./map"
import { loadNordic, NORDICS, type NordicCountry } from "./source"
import { flag, type IngestArgs } from "../_shared/cli"
import { executeIngest } from "../_shared/execute"
import { JsonSources } from "../_shared/json-source"

export async function runNordic(args: IngestArgs) {
  const allowed = new Set([
    "dataset",
    "country",
    "dry-run",
    "apply",
    "check-cms",
    "limit",
    "concurrency",
    "snapshot",
    "refresh",
    "log",
  ])
  for (const key of Object.keys(args))
    if (!allowed.has(key)) throw new Error(`Unknown Nordic flag --${key}`)
  if (!Object.hasOwn(NORDICS, args.country ?? ""))
    throw new Error("Wikidata ingest requires --country=SE|NO|DK")
  const country = args.country as NordicCountry
  const config = NORDICS[country]
  const directory = path.join(__dirname, country.toLowerCase())
  mkdirSync(directory, { recursive: true })
  const sources = new JsonSources(
    args.snapshot ?? path.join(directory, ".cache"),
    { offline: !!args.snapshot, refresh: flag(args, "refresh") }
  )
  const source = await loadNordic(sources, country)
  const geography = buildNordicGeography(source)
  const mapped = mapWikidata(source.libraries, country, geography.places)

  return executeIngest({
    args,
    directory,
    dataset: "wikidata",
    populationDataset: config.populationDataset,
    inputs: sources.inputs,
    year: config.year,
    boundaryDate: config.boundaryDate,
    libraryRetrievedAt: source.libraryRetrievedAt,
    ...mapped,
    geography: geography.places,
    placeOptions: {
      attribution:
        country === "SE"
          ? "Statistics Sweden, CC0 1.0; municipality name aliases from Wikidata, CC0 1.0. https://www.scb.se/en/services/open-data-api/"
          : country === "NO"
            ? "Statistics Norway (SSB), administrative classifications, CC BY 4.0. https://www.ssb.no/en/klass"
            : "Statistics Denmark, FOLK1A, CC BY 4.0; municipality-to-region links from Wikidata, CC0 1.0. https://www.statbank.dk/FOLK1A",
      countries: {
        [country]: { iso3: config.iso3, regionType: config.regionType },
      },
    },
    observationFor: (place) => nordicObservation(place, source),
    details: {
      country,
      populationDiscrepancies: geography.discrepancies,
      missingMunicipality: mapped.libraries.filter((l) => !l.areaKey).length,
      coverage:
        "Wikidata physical-library records with a name and a current municipality or valid coordinates; this is a partial knowledge-graph baseline, not a complete national directory.",
    },
  })
}

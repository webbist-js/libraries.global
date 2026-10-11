import path from "node:path"

import { mapFrenchLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"

export const FRANCE_URL =
  "https://static.data.gouv.fr/resources/adresses-des-bibliotheques-publiques-2/20250827-130724/adresses-des-bibliotheques-publiques.json"

export async function runFrance(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await sources.read<any[]>("libraries", FRANCE_URL)
  if (!Array.isArray(snapshot.data) || snapshot.data.length !== 15704)
    throw new Error(
      "Unexpected French snapshot coverage; review a new release before importing"
    )
  const ids = snapshot.data.map((row) => row.code_bib)
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate French library IDs")
  const libraries = [],
    skipped = []
  for (const row of snapshot.data) {
    const record = mapFrenchLibrary(row)
    if (typeof record === "string")
      skipped.push({
        recordId: row.code_bib ?? "",
        name: row.nom_de_l_etablissement ?? "",
        reason: record,
      })
    else libraries.push(record)
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "fr-culture-libraries",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: snapshot.data.length,
    libraries,
    skipped,
    details: {
      sourceReferenceDate: "2025-06-05",
      activityYear: 2023,
      coverage: "Metropolitan France; visitor buildings and bookmobiles only",
    },
  })
}

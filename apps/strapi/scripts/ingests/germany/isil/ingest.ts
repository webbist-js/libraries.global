import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { mapGermanLibrary, type GermanLibrary } from "./map"
import type { IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"
import type { SourceFile } from "../../_shared/source-file"
import { assertIngestTarget } from "../../_shared/target"

export const SRU_URL =
  "https://services.dnb.de/sru/bib?operation=searchRetrieve&query=isil%3DDE-*&recordSchema=PicaPlus-xml&version=1.1"

/** PICA enrichment is mandatory: the RDF dump alone cannot establish type or region. */
export async function runGermany(args: IngestArgs) {
  assertIngestTarget(args)
  if (!args.snapshot)
    throw new Error(
      "Germany requires a complete, checksummed SRU snapshot (--snapshot)"
    )
  const sources = new JsonSources(args.snapshot, { offline: true })
  const snapshot = await sources.read<{
    records: GermanLibrary[]
    inputs: SourceFile[]
  }>("libraries", SRU_URL)
  const { records, inputs } = snapshot.data
  if (
    !Array.isArray(records) ||
    records.length < 10000 ||
    records.length > 50000 ||
    !inputs?.length
  )
    throw new Error("Incomplete German SRU coverage")
  for (const input of inputs) {
    if (
      !input.url.startsWith("https://services.dnb.de/sru/bib?") &&
      input.url !== "https://download.geonames.org/export/dump/DE.zip"
    )
      throw new Error("Unexpected SRU source")
    if (
      createHash("sha256").update(readFileSync(input.file)).digest("hex") !==
      input.sha256
    )
      throw new Error("SRU source checksum mismatch")
  }
  // Explicit operator holds preserve ambiguous legacy identities without editing source facts.
  const held = new Set((args["hold-records"] ?? "").split(",").filter(Boolean))
  if ([...held].some((id) => !records.some((record) => record.isil === id)))
    throw new Error("A held ISIL is absent from the source snapshot")
  const ids = new Set<string>()
  const libraries = []
  const skipped = []
  for (const record of records) {
    if (!record.isil || ids.has(record.isil))
      throw new Error("Missing or duplicate complete ISIL")
    ids.add(record.isil)
    if (held.has(record.isil)) {
      skipped.push({
        recordId: record.isil,
        name: record.name,
        reason:
          "Operator hold: existing library identity needs editorial reconciliation",
      })
      continue
    }
    const mapped = mapGermanLibrary(record)
    if (typeof mapped === "string")
      skipped.push({ recordId: record.isil, name: record.name, reason: mapped })
    else libraries.push(mapped)
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "de-isil",
    inputs: [...sources.inputs, ...inputs],
    retrievedAt: snapshot.retrievedAt,
    sourceCount: records.length,
    libraries,
    skipped,
  })
}

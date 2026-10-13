import { execFileSync } from "node:child_process"
import path from "node:path"
import { gunzipSync } from "node:zlib"

import { mapCzechLibrary, type CzechLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"

const URL = "https://aleph.nkp.cz/data/adr.xml.gz"

export async function runCzechia(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await sources.read<CzechLibrary[]>(
    "libraries",
    URL,
    undefined,
    async () => {
      const response = await fetch(URL, { signal: AbortSignal.timeout(30000) })
      if (!response.ok)
        throw new Error(`Czech directory HTTP ${response.status}`)
      const raw = Buffer.from(await response.arrayBuffer())
      // fetch may already decompress Content-Encoding: gzip, despite the .gz filename.
      const xml = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw

      return JSON.parse(
        execFileSync(
          "/usr/bin/python3",
          [path.join(__dirname, "parse-marc.py")],
          {
            input: xml,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
          }
        )
      )
    }
  )
  const rows = snapshot.data
  if (!Array.isArray(rows) || rows.length < 7000 || rows.length > 12000)
    throw new Error("Unexpected Czech directory coverage; review the source")
  const ids = rows.map((row) => row.SGL?.[0]?.a)
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate or missing SIGLA identities")
  const libraries = [],
    skipped = []
  for (const row of rows) {
    const record = mapCzechLibrary(row)
    if (typeof record === "string")
      skipped.push({
        recordId: row.SGL?.[0]?.a ?? "",
        name: row.NAZ?.[0]?.a ?? "",
        reason: record,
      })
    else libraries.push(record)
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "nkp-cadr",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: rows.length,
    libraries,
    skipped,
    details: {
      coverage:
        "Active institutions with a readable name, SIGLA and region; source STT entries excluded",
    },
  })
}

import { execFileSync } from "node:child_process"
import path from "node:path"

import { mapItalianLibrary, type ItalianLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"
import { assertIngestTarget } from "../../_shared/target"

export const ICCU_URL = "https://opendata.anagrafe.iccu.sbn.it/biblioteche.zip"

interface ItalianSnapshot {
  biblioteche?: ItalianLibrary[]
  metadati?: { "biblioteche-estratte"?: number; "data-estrazione"?: string }
}

export function validateItalianSnapshot(
  data: ItalianSnapshot
): ItalianLibrary[] {
  const rows = data?.biblioteche
  if (
    !Array.isArray(rows) ||
    rows.length < 10000 ||
    rows.length > 30000 ||
    data.metadati?.["biblioteche-estratte"] !== rows.length ||
    !Number.isFinite(Date.parse(data.metadati?.["data-estrazione"] ?? ""))
  )
    throw new Error("Incomplete or unexpected ICCU release; review coverage")
  const ids = rows.map((row) => row["codici-identificativi"]?.isil)
  if (
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Missing or duplicate ICCU ISIL identities")

  return rows
}

export async function runItaly(args: IngestArgs) {
  assertIngestTarget(args)
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await sources.read<ItalianSnapshot>(
    "libraries",
    ICCU_URL,
    undefined,
    async () => {
      const response = await fetch(ICCU_URL, {
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) throw new Error(`ICCU HTTP ${response.status}`)
      const chunks: Uint8Array[] = []
      let size = 0
      for await (const chunk of response.body!) {
        size += chunk.length
        if (size > 32 * 1024 * 1024)
          throw new Error("ICCU download exceeds budget")
        chunks.push(chunk)
      }

      return JSON.parse(
        execFileSync("/usr/bin/python3", [path.join(__dirname, "parse.py")], {
          input: Buffer.concat(chunks),
          encoding: "utf8",
          maxBuffer: 80 * 1024 * 1024,
        })
      )
    }
  )
  const rows = validateItalianSnapshot(snapshot.data)
  const libraries = [],
    skipped = []
  for (const row of rows) {
    const mapped = mapItalianLibrary(row)
    if (typeof mapped === "string")
      skipped.push({
        recordId: row["codici-identificativi"].isil,
        name: row.denominazioni?.ufficiale ?? "",
        reason: mapped,
      })
    else libraries.push(mapped)
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "it-iccu",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: rows.length,
    libraries,
    skipped,
    details: {
      sourceReferenceDate: snapshot.data.metadati?.["data-estrazione"],
      coverage:
        "National ICCU directory; excluded registration states and invalid rows reported individually",
      atlasReady: false,
    },
  })
}

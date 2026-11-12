import { createHash } from "node:crypto"
import path from "node:path"

import {
  JAPAN_COLUMNS,
  JAPAN_CURATED,
  JAPAN_RELEASE,
  japanUrls,
  mapJapaneseLibrary,
  type JapanList,
  type JapanRow,
} from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { parseCsv } from "../../_shared/csv"
import {
  executeDirectoryIngest,
  type DirectoryLibrary,
} from "../../_shared/directory"
import { reconcileCuratedLibraries } from "../../_shared/isil-registry"
import { JsonSources } from "../../_shared/json-source"
import type { RunLogEntry } from "../../_shared/run-log"
import { assertIngestTarget } from "../../_shared/target"

export interface JapanListSnapshot<T> {
  /** SHA-256 of the downloaded CSV bytes. */
  sha256: string
  rows: T[]
}

/** Read one library list by column position after checking every heading. */
export function parseJapanList(
  bytes: Buffer,
  list: JapanList
): JapanListSnapshot<JapanRow> {
  const parsed = parseCsv(bytes.toString("utf8"))
  const header = Object.keys(parsed[0] ?? {})
  JAPAN_COLUMNS.forEach(([field, pattern], index) => {
    if (!pattern.test(header[index] ?? ""))
      throw new Error(`Japanese ISIL ${list} list changed: column ${field}`)
  })

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    rows: parsed.map((row) => {
      const values = Object.values(row)

      return {
        ...(Object.fromEntries(
          JAPAN_COLUMNS.map(([field], index) => [field, values[index] ?? ""])
        ) as Omit<JapanRow, "list">),
        list,
      }
    }),
  }
}

/** The deleted list is used only to prove no withdrawn ISIL is imported. */
export function parseJapanDeleted(bytes: Buffer): JapanListSnapshot<string> {
  const parsed = parseCsv(bytes.toString("utf8"))
  if (!parsed.length || !("ISIL" in parsed[0]!))
    throw new Error("Japanese deleted ISIL list changed")

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    rows: parsed.map((row) => row.ISIL!),
  }
}

export function validateJapanSource(rows: JapanRow[], deleted: string[]) {
  if (rows.length < 6000 || rows.length > 10000)
    throw new Error("Unexpected Japanese ISIL coverage; review the release")
  const ids = new Set(rows.map((row) => row.recordId))
  if (ids.size !== rows.length || ids.has(""))
    throw new Error("Duplicate or missing Japanese ISIL")
  const withdrawn = deleted.filter((id) => ids.has(id))
  if (withdrawn.length)
    throw new Error(`Deleted ISILs are still listed: ${withdrawn.join(", ")}`)
}

async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Japanese ISIL HTTP ${response.status}`)

  return Buffer.from(await response.arrayBuffer())
}

export async function runJapan(args: IngestArgs) {
  assertIngestTarget(args)
  const release = args.release ?? JAPAN_RELEASE
  const urls = japanUrls(release)
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache", release),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshots: {
    data: JapanListSnapshot<JapanRow>
    retrievedAt: string
  }[] = []
  for (const list of ["public", "other"] as const)
    snapshots.push(
      await sources.read(list, urls[list], undefined, async () =>
        parseJapanList(await download(urls[list]), list)
      )
    )
  const lists = snapshots.map((snapshot) => snapshot.data)
  const deleted = await sources.read(
    "deleted",
    urls.deleted,
    undefined,
    async () => parseJapanDeleted(await download(urls.deleted))
  )
  const rows = lists.flatMap((list) => list.rows)
  validateJapanSource(rows, deleted.data.rows)
  const libraries: DirectoryLibrary[] = [],
    skipped: Omit<RunLogEntry, "status">[] = []
  for (const row of rows) {
    const record = mapJapaneseLibrary(row, release)
    if (typeof record === "string")
      skipped.push({ recordId: row.recordId, name: row.name, reason: record })
    else libraries.push(record)
  }
  const existingMatches = await reconcileCuratedLibraries(
    args,
    libraries,
    skipped,
    [
      {
        ...JAPAN_CURATED,
        evidence: "National Diet Library website",
        matches: (library) =>
          String(library.website ?? "").includes("ndl.go.jp"),
      },
    ]
  )

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "jp-ndl-isil",
    inputs: sources.inputs,
    retrievedAt: snapshots[0]!.retrievedAt,
    sourceCount: rows.length,
    libraries,
    skipped,
    existingMatches,
    details: {
      coverage:
        "Registered libraries and public reading rooms in Japan; not a census of buildings. Registration does not establish visitor access or current operation.",
      release,
      sourceSha256: {
        public: lists[0]!.sha256,
        other: lists[1]!.sha256,
        deleted: deleted.data.sha256,
      },
      deletedIsils: deleted.data.rows.length,
      curatedMatches: existingMatches.size,
    },
  })
}

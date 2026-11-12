import { createHash } from "node:crypto"
import path from "node:path"

import {
  mapSwissLibrary,
  SWISS_COLUMNS,
  SWISS_CURATED,
  SWISS_URL,
  type SwissIsilRow,
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

export interface SwissSnapshot {
  /** SHA-256 of the downloaded CSV bytes. */
  sha256: string
  rows: SwissIsilRow[]
}

/** Keep only the mapped columns: contacts, prose and holdings stay out of the replay snapshot. */
export function parseSwissCsv(bytes: Buffer): SwissSnapshot {
  const parsed = parseCsv(bytes.toString("utf8"))
  const header = Object.keys(parsed[0] ?? {})
  const missing = SWISS_COLUMNS.filter((column) => !header.includes(column))
  if (missing.length)
    throw new Error(`Swiss ISIL schema changed: missing ${missing.join(", ")}`)

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    rows: parsed.map((row) =>
      Object.fromEntries(SWISS_COLUMNS.map((column) => [column, row[column]!]))
    ),
  }
}

export function validateSwissSource(snapshot: SwissSnapshot) {
  const rows = snapshot?.rows
  if (!Array.isArray(rows) || rows.length < 2000 || rows.length > 4000)
    throw new Error("Unexpected Swiss ISIL coverage; review the release")
  const ids = new Set(rows.map((row) => row.ISIL))
  if (ids.size !== rows.length || ids.has(""))
    throw new Error("Duplicate or missing Swiss ISIL")
}

export async function runSwitzerland(args: IngestArgs) {
  assertIngestTarget(args)
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await sources.read<SwissSnapshot>(
    "libraries",
    SWISS_URL,
    undefined,
    async () => {
      const response = await fetch(SWISS_URL, {
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) throw new Error(`Swiss ISIL HTTP ${response.status}`)

      return parseSwissCsv(Buffer.from(await response.arrayBuffer()))
    }
  )
  validateSwissSource(snapshot.data)
  const libraries: DirectoryLibrary[] = [],
    skipped: Omit<RunLogEntry, "status">[] = []
  for (const row of snapshot.data.rows) {
    const record = mapSwissLibrary(row)
    if (typeof record === "string")
      skipped.push({
        recordId: row.ISIL,
        name: row["Name-Original"] ?? "",
        reason: record,
      })
    else libraries.push(record)
  }
  const existingMatches = await reconcileCuratedLibraries(
    args,
    libraries,
    skipped,
    Object.entries(SWISS_CURATED).map(([recordId, slug]) => {
      const street = snapshot.data.rows.find(
        (row) => row.ISIL === recordId
      )?.Strasse

      return {
        recordId,
        slug,
        evidence: "registry street address",
        matches: (library) =>
          Boolean(street) && library.streetAddress === street,
      }
    })
  )

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "ch-isil",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: snapshot.data.rows.length,
    libraries,
    skipped,
    existingMatches,
    details: {
      coverage:
        "Active Swiss institutions explicitly classified as libraries; inactive, non-library and foreign records excluded",
      sourceSha256: snapshot.data.sha256,
      curatedMatches: existingMatches.size,
    },
  })
}

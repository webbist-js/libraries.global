import path from "node:path"

import { mapHistoricalAustralianLibrary, mapQueenslandLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { parseCsv } from "../../_shared/csv"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources, sourceJson } from "../../_shared/json-source"

const RESOURCE = "0cfcb57e-4cfc-41ca-a337-39ce1cb99344"
const QLD_URL = `https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=${RESOURCE}`

export async function downloadQueensland(download = sourceJson) {
  const records: any[] = [],
    ids = new Set<number>()
  let total: number | undefined
  for (let offset = 0; offset < 10000; offset += 100) {
    const response = await download(
      `${QLD_URL}&limit=100&offset=${offset}&sort=_id`
    )
    const page = response.result
    if (
      !response.success ||
      !page ||
      !Array.isArray(page.records) ||
      !Number.isSafeInteger(page.total) ||
      page.total < 1
    )
      throw new Error("Invalid Queensland directory page")
    total ??= page.total
    if (total !== page.total)
      throw new Error("Queensland directory changed while paging")
    for (const row of page.records) {
      if (!Number.isSafeInteger(row._id) || ids.has(row._id))
        throw new Error("Duplicate or invalid Queensland row ID")
      ids.add(row._id)
      records.push(row)
    }
    if (!page.records.length) {
      if (records.length !== total)
        throw new Error("Incomplete Queensland directory")

      return records
    }
  }
  throw new Error("Queensland directory exceeds supported coverage")
}

export async function runAustralia(args: IngestArgs) {
  const queensland = args.dataset === "slq-directory"
  const directory = path.join(
    __dirname,
    queensland ? "queensland" : "historical"
  )
  const sources = new JsonSources(
    args.snapshot ?? path.join(directory, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  let rows: any[], retrievedAt: string
  if (queensland) {
    const snapshot = await sources.read<any[]>(
      "libraries",
      QLD_URL,
      undefined,
      downloadQueensland
    )
    rows = snapshot.data
    retrievedAt = snapshot.retrievedAt
    if (!Array.isArray(rows) || rows.length < 300 || rows.length > 500)
      throw new Error("Unexpected Queensland coverage; review the source")
  } else {
    const url = "https://ndownloader.figshare.com/files/38931368"
    const snapshot = await sources.read<string>(
      "libraries",
      url,
      undefined,
      async () => {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
        })
        if (!response.ok)
          throw new Error(`Australian source HTTP ${response.status}`)

        return response.text()
      }
    )
    rows = parseCsv(snapshot.data)
    retrievedAt = snapshot.retrievedAt
    if (
      rows.length !== 1443 ||
      new Set(rows.map((row) => row.ID)).size !== rows.length
    )
      throw new Error("Incomplete or duplicate Australian historical snapshot")
    const metadata = await sources.read<any>(
      "publisher",
      "https://api.figshare.com/v2/articles/21944840"
    )
    if (metadata.data.license?.name !== "CC BY-SA 4.0")
      throw new Error(
        "Australian dataset licence changed; review before importing"
      )
  }
  const libraries = [],
    skipped = []
  for (const row of rows) {
    const record = queensland
      ? mapQueenslandLibrary(row)
      : mapHistoricalAustralianLibrary(row)
    if (typeof record === "string")
      skipped.push({
        recordId: String(row.ID ?? row._id),
        name: row.Library ?? row["Branch Name"] ?? "",
        reason: record,
      })
    else libraries.push(record)
  }

  return executeDirectoryIngest({
    args,
    directory,
    dataset: queensland ? "slq-directory" : "au-public-libraries",
    inputs: sources.inputs,
    retrievedAt,
    sourceCount: rows.length,
    libraries,
    skipped,
    details: {
      sourceVintage: queensland ? "2026" : "2016–2018",
      coverage: queensland
        ? "Queensland public-library branches"
        : "ACT, NSW, Tasmania, Victoria and Western Australia; Queensland uses a separate current source",
    },
  })
}

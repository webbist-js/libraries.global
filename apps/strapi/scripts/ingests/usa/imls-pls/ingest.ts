/**
 * IMLS Public Libraries Survey (FY 2023) → libraries.global.
 *
 * Usage (from apps/strapi):
 *   npx tsx scripts/ingests/usa/imls-pls/ingest.ts --dry-run --state=NY
 *   npx tsx scripts/ingests/usa/imls-pls/ingest.ts --state=NY --limit=25
 *
 * Options:
 *   --dry-run        Map and report without calling Strapi (no token needed)
 *   --state=NY,NJ    Only these states (USPS codes)
 *   --limit=N        Stop after N outlets
 *   --file=path.zip  Use a local copy of pls_fy2023_csv.zip
 *   --log=path       Run log (default: imls-pls.ingest-log.json here)
 *
 * Every library is created as a draft with source "imls-pls" and a source
 * record FSCSKEY-FSCS_SEQ. Outlets already matched to a source record are
 * left alone, so a re-run only adds what's missing.
 *
 * Env (live runs): STRAPI_URL, STRAPI_API_TOKEN
 */

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import {
  DATASET_KEY,
  mapOutlet,
  type AdminRow,
  type MappedOutlet,
  type OutletRow,
} from "./map"
import { flag, limitOf, listOf, parseArgs } from "../../_shared/cli"
import { parseCsv } from "../../_shared/csv"
import { RunLog } from "../../_shared/run-log"
import { fetchSourceFile, unzip } from "../../_shared/source-file"

const ZIP_URL =
  "https://www.imls.gov/sites/default/files/2025-08/pls_fy2023_csv.zip"

const args = parseArgs()
const DRY_RUN = flag(args, "dry-run")
const LIMIT = limitOf(args)
const STATES = listOf(args, "state")
const LOG_PATH = args.log ?? path.join(__dirname, "imls-pls.ingest-log.json")

function findCsv(dir: string, pattern: RegExp): string {
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
    )
  const match = walk(dir).find((f) => pattern.test(f))
  if (!match) throw new Error(`No file matching ${pattern} in ${dir}`)

  return match
}

// The files are Windows-1252; latin1 reads them without mangling bytes.
const readRows = (path: string) => parseCsv(readFileSync(path, "latin1"))

async function run() {
  const zip = await fetchSourceFile(
    ZIP_URL,
    path.join(__dirname, ".cache"),
    args.file
  )
  const dir = unzip(zip.file)
  const outlets: OutletRow[] = readRows(findCsv(dir, /outlet.*\.csv$/i))
  const admins: AdminRow[] = readRows(findCsv(dir, /_AE_.*\.csv$/i))
  const adminByKey = new Map(admins.map((a) => [a.FSCSKEY, a]))

  const log = new RunLog(LOG_PATH, {
    dataset: DATASET_KEY,
    startedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    input: [zip],
    args,
  })

  const rows = outlets.filter((r) => !STATES || STATES.includes(r.STABR))
  console.log(
    `IMLS PLS: ${outlets.length} outlets, ${rows.length} selected${STATES ? ` (${STATES.join(", ")})` : ""}`
  )
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"} | Limit: ${LIMIT}\n`)

  // Map everything first so slug clashes inside the dataset are settled
  // before anything is written.
  const mapped: MappedOutlet[] = []
  const slugs = new Map<string, string>()
  for (const row of rows) {
    if (mapped.length >= LIMIT) break
    const result = mapOutlet(row, adminByKey.get(row.FSCSKEY))
    if (!result.ok) {
      log.add({
        recordId: result.recordId,
        name: result.name,
        status: "skipped",
        reason: result.reason,
      })
      continue
    }
    const { outlet } = result
    if (slugs.has(outlet.data.slug)) {
      const seq = outlet.recordId.split("-").at(-1)
      outlet.warnings.push(
        `Slug ${outlet.data.slug} also used by ${slugs.get(outlet.data.slug)}`
      )
      outlet.data.slug = `${outlet.data.slug}-${seq}`
    }
    slugs.set(outlet.data.slug, outlet.recordId)
    mapped.push(outlet)
  }

  if (DRY_RUN) {
    for (const o of mapped) {
      log.add({
        recordId: o.recordId,
        name: o.data.name,
        status: "dry-run",
        slug: o.data.slug,
        ...(o.warnings.length > 0 ? { warnings: o.warnings } : {}),
      })
    }
    report(log, mapped)

    return
  }

  // Loaded only for live runs: the client exits without a token.
  const { StrapiClient } = await import("../../../strapi-client")
  const strapi = new StrapiClient()
  const existing = await strapi.librariesBySourceRecord(DATASET_KEY)
  const retrievedAt = new Date().toISOString().slice(0, 10)

  const continentId = await strapi.findOrCreateContinent(
    "North America",
    "north-america",
    "NA"
  )
  const countryId = await strapi.findOrCreateCountry(
    "United States",
    "united-states",
    continentId,
    { iso2: "US", iso3: "USA", regionTypeLabel: "State" }
  )

  for (const [i, o] of mapped.entries()) {
    const known = existing.get(o.recordId)
    if (known) {
      log.add({
        recordId: o.recordId,
        name: o.data.name,
        status: "exists",
        documentId: known,
      })
      continue
    }

    try {
      const regionId = await strapi.findOrCreateRegion(
        o.geo.regionName,
        o.geo.regionSlug,
        countryId,
        continentId,
        { typeLabel: o.state === "DC" ? "Federal District" : "State" }
      )
      const areaId =
        o.geo.areaName && o.geo.areaSlug
          ? await strapi.findOrCreateArea(
              o.geo.areaName,
              o.geo.areaSlug,
              regionId,
              countryId,
              { typeLabel: o.geo.areaTypeLabel }
            )
          : null

      // A slug taken by a record from elsewhere gets the outlet sequence.
      if (await strapi.libraryExistsBySlug(o.data.slug)) {
        o.data.slug = `${o.data.slug}-${o.recordId.split("-").at(-1)}`
      }

      const created = await strapi.createLibrary({
        ...o.data,
        sourceRecords: [
          { dataset: DATASET_KEY, recordId: o.recordId, retrievedAt },
        ],
        continent: { connect: [{ documentId: continentId }] },
        country: { connect: [{ documentId: countryId }] },
        region: { connect: [{ documentId: regionId }] },
        ...(areaId ? { area: { connect: [{ documentId: areaId }] } } : {}),
      })
      console.log(`[OK]   ${o.data.name} → ${created.documentId}`)
      log.add({
        recordId: o.recordId,
        name: o.data.name,
        status: "created",
        documentId: created.documentId,
        slug: o.data.slug,
        ...(o.warnings.length > 0 ? { warnings: o.warnings } : {}),
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error(`[ERR]  ${o.data.name}: ${reason}`)
      log.add({
        recordId: o.recordId,
        name: o.data.name,
        status: "error",
        reason,
      })
    }

    if ((i + 1) % 25 === 0) log.save()
    await new Promise((resolve) => setTimeout(resolve, 80))
  }

  report(log, mapped)
}

function tally(values: string[]): string {
  const counts: Record<string, number> = {}
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", ")
}

function report(log: RunLog, mapped: MappedOutlet[]) {
  log.save()

  const skipped = log.entries.filter((e) => e.status === "skipped")
  const warnings = mapped.flatMap((o) =>
    o.warnings.map((w) => w.replaceAll(/\d[\d.,]*/g, "#"))
  )

  console.log(`Counts:     ${JSON.stringify(log.counts())}`)
  console.log(`Types:      ${tally(mapped.map((o) => o.data.libraryType))}`)
  console.log(
    `Status:     ${tally(mapped.map((o) => o.data.operationalStatus))}`
  )
  console.log(
    `Operator:   ${tally(mapped.map((o) => o.data.operatorType ?? "(none)"))}`
  )
  console.log(`Areas:      ${new Set(mapped.map((o) => o.geo.areaSlug)).size}`)
  if (skipped.length > 0)
    console.log(`Skipped:    ${tally(skipped.map((e) => e.reason ?? ""))}`)
  if (warnings.length > 0) console.log(`Warnings:   ${tally(warnings)}`)
  console.log(`\nLog saved to ${LOG_PATH}`)
}

run().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})

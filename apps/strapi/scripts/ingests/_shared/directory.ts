import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { concurrencyOf, flag, limitOf, type IngestArgs } from "./cli"
import {
  checkLibrarySlugs,
  importLibraryDrafts,
  validateLibraries,
  type PreparedLibrary,
} from "./pipeline"
import { ingestDatabase } from "./population"
import { RunLog, type RunLogEntry } from "./run-log"
import type { SourceFile } from "./source-file"
import { slugify } from "./text"
import { DATASET_SEED } from "../../../src/seeds/datasets"
import type { StrapiEntity } from "../../strapi-client"

export interface DirectoryLibrary extends PreparedLibrary {
  countryCode: string
  regionName: string
  areaName?: string
}

export function directoryPlaceKey(name: string) {
  return slugify(
    name.replaceAll(
      /\b(department|département|du|okres|district|kraj)\b/gi,
      " "
    )
  ).replaceAll("-", "")
}

/** Match within the supplied parent; names never move a place between countries or regions. */
export function matchDirectoryPlace(places: StrapiEntity[], name: string) {
  const key = directoryPlaceKey(name)
  const found = places.filter(
    (place) => directoryPlaceKey(String(place.name)) === key
  )
  if (found.length > 1) throw new Error(`Ambiguous place ${name}`)

  return found[0]
}

/** Directories with existing geography reuse the same validation, checkpoints and draft writer. */
export async function executeDirectoryIngest(options: {
  args: IngestArgs
  directory: string
  dataset: string
  inputs: SourceFile[]
  retrievedAt: string
  sourceCount: number
  libraries: DirectoryLibrary[]
  skipped: Omit<RunLogEntry, "status">[]
  details?: Record<string, unknown>
}) {
  const { args, directory, dataset, libraries, inputs } = options
  const apply = flag(args, "apply")
  if (apply && flag(args, "dry-run"))
    throw new Error("Choose --apply or --dry-run")
  const concurrency = concurrencyOf(args)
  const limit = limitOf(args)
  validateLibraries(libraries)
  if (options.sourceCount !== libraries.length + options.skipped.length)
    throw new Error("Every source row must be mapped or have a skip reason")
  const seed = DATASET_SEED.find((item) => item.key === dataset)
  if (
    !seed ||
    !["permitted", "permitted_with_attribution"].includes(seed.redistribution)
  )
    throw new Error(`Dataset ${dataset} has no confirmed redistribution terms`)
  const runs = path.join(directory, ".runs")
  mkdirSync(runs, { recursive: true })
  const runId = new Date().toISOString().replaceAll(":", "-")
  const logPath = args.log ?? path.join(runs, `${runId}.ingest-log.json`)
  const reportPath = path.join(
    runs,
    `${runId}.${apply ? "apply" : "plan"}.json`
  )
  const log = new RunLog(logPath, {
    dataset,
    startedAt: new Date().toISOString(),
    dryRun: !apply,
    input: inputs,
    args,
  })
  options.skipped.forEach((row) => log.add({ ...row, status: "skipped" }))
  const report: Record<string, any> = {
    dataset,
    dryRun: !apply,
    concurrency,
    source: options.sourceCount,
    mapped: libraries.length,
    skipped: options.skipped.length,
    missingCoordinates: libraries.filter((row) => !row.data.location).length,
    types: Object.fromEntries(
      [...new Set(libraries.map((row) => row.data.libraryType))].map((type) => [
        type,
        libraries.filter((row) => row.data.libraryType === type).length,
      ])
    ),
    input: inputs,
    ...options.details,
  }
  const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2))
  let database: any, connection: any
  try {
    if (!apply && !flag(args, "check-cms")) {
      libraries.forEach((row) =>
        log.add({
          recordId: row.recordId,
          name: row.data.name,
          status: "dry-run",
          slug: row.data.slug,
          warnings: row.warnings,
        })
      )
      report.cmsChecked = false

      return report
    }
    if (apply && !process.env.STRAPI_BRIDGE_SECRET)
      throw new Error("STRAPI_BRIDGE_SECRET is required for draft writes")
    const { StrapiClient } = await import("../../strapi-client")
    const client = new StrapiClient()
    database = ingestDatabase()
    if (apply) {
      connection = await database.client.acquireConnection()
      const lock = await database
        .raw("SELECT pg_try_advisory_lock(7420110, hashtext(?)) AS locked", [
          dataset,
        ])
        .connection(connection)
      if (!lock.rows[0].locked)
        throw new Error("This Dataset ingest is already running")
    }
    const codes = [...new Set(libraries.map((row) => row.countryCode))]
    const countries = await client.findAll("countries", {
      filters: { iso2: { $in: codes } },
      populate: ["continent"],
      status: "draft",
    })
    const regions = await client.findAll("regions", {
      filters: { country: { iso2: { $in: codes } } },
      populate: ["country"],
      status: "draft",
    })
    const areas = await client.findAll("areas", {
      filters: { country: { iso2: { $in: codes } } },
      populate: ["country", "region"],
      status: "draft",
    })
    const resolved = new Map<
      string,
      { country: string; region: string; continent: string; area?: string }
    >()
    for (const row of libraries) {
      const found = countries.filter(
        (country) => country.iso2 === row.countryCode
      )
      if (found.length !== 1)
        throw new Error(`Missing or ambiguous country ${row.countryCode}`)
      const country = found[0]
      const region = matchDirectoryPlace(
        regions.filter(
          (place) => (place.country as any)?.documentId === country.documentId
        ),
        row.regionName
      )
      if (!region)
        throw new Error(
          `Region ${row.regionName} is missing in ${row.countryCode}`
        )
      const continentId = (country.continent as any)?.documentId
      if (!continentId)
        throw new Error(`Country ${row.countryCode} has no continent`)
      const area = row.areaName
        ? matchDirectoryPlace(
            areas.filter(
              (place) =>
                (place.country as any)?.documentId === country.documentId &&
                (place.region as any)?.documentId === region.documentId
            ),
            row.areaName
          )
        : undefined
      if (row.areaName && !area) {
        const other = matchDirectoryPlace(
          areas.filter(
            (place) => (place.country as any)?.documentId === country.documentId
          ),
          row.areaName
        )
        if (other) {
          log.add({
            recordId: row.recordId,
            name: row.data.name,
            status: "skipped",
            reason: `Source area ${row.areaName} contradicts region ${row.regionName}; editorial review required`,
          })
          continue
        }
        row.warnings.push(`Area ${row.areaName} not matched; region retained`)
      }
      resolved.set(row.recordId, {
        country: country.documentId,
        region: region.documentId,
        continent: continentId,
        area: area?.documentId,
      })
    }
    const ready = libraries.filter((row) => resolved.has(row.recordId))
    report.geographyConflicts = libraries.length - ready.length
    report.mapped = ready.length
    report.skipped = options.skipped.length + report.geographyConflicts
    report.missingCoordinates = ready.filter((row) => !row.data.location).length
    report.types = Object.fromEntries(
      [...new Set(ready.map((row) => row.data.libraryType))].map((type) => [
        type,
        ready.filter((row) => row.data.libraryType === type).length,
      ])
    )
    // Never combine REST relations with a different DATABASE_* target.
    for (const country of countries) {
      const row = await database("countries")
        .where({ document_id: country.documentId, iso_2: country.iso2 })
        .first()
      if (!row) throw new Error(`REST and database disagree on ${country.iso2}`)
    }
    for (const [table, ids] of [
      ["regions", new Set([...resolved.values()].map((row) => row.region))],
      [
        "areas",
        new Set([...resolved.values()].map((row) => row.area).filter(Boolean)),
      ],
      [
        "continents",
        new Set([...resolved.values()].map((row) => row.continent)),
      ],
    ] as const) {
      const rows = await database(table)
        .whereIn("document_id", [...ids])
        .distinct("document_id")
      if (rows.length !== ids.size)
        throw new Error(`REST and database disagree on ${table}`)
    }
    const existing = await client.librariesBySourceRecord(dataset)
    await checkLibrarySlugs(client, ready, existing)
    report.cmsChecked = true
    report.existing = ready.filter((row) => existing.has(row.recordId)).length
    report.toCreate = Math.min(ready.length - report.existing, limit)
    report.missingAreas = ready.filter(
      (row) => row.areaName && !resolved.get(row.recordId)?.area
    ).length
    report.placement = ready.map((row) => ({
      recordId: row.recordId,
      ...resolved.get(row.recordId),
    }))
    save()
    if (!apply) {
      ready.forEach((row) =>
        log.add({
          recordId: row.recordId,
          name: row.data.name,
          status: existing.has(row.recordId) ? "exists" : "dry-run",
          slug: row.data.slug,
          warnings: row.warnings,
        })
      )

      return report
    }
    const registered = await client.findAll("datasets", {
      filters: { key: { $eq: dataset } },
    })
    if (!registered.length) await client.post("/datasets", { data: seed })
    if (registered.length > 1)
      throw new Error(`Duplicate registered Dataset ${dataset}`)
    const connect = (documentId: string) => ({ connect: [{ documentId }] })
    report.created = await importLibraryDrafts({
      client,
      dataset,
      records: ready,
      existing,
      retrievedAt: options.retrievedAt,
      log,
      limit,
      concurrency,
      relations: (row) => {
        const place = resolved.get(row.recordId)!

        return {
          country: connect(place.country),
          region: connect(place.region),
          continent: connect(place.continent),
          ...(place.area ? { area: connect(place.area) } : {}),
        }
      },
    })

    return report
  } catch (error) {
    report.error = (error as Error).message
    throw error
  } finally {
    log.save()
    report.counts = log.counts()
    save()
    if (connection) {
      await database
        .raw("SELECT pg_advisory_unlock(7420110, hashtext(?))", [dataset])
        .connection(connection)
      await database.client.releaseConnection(connection)
    }
    await database?.destroy()
    const { placement: _placement, input: _input, ...summary } = report
    console.log(JSON.stringify({ ...summary, reportPath, logPath }, null, 2))
  }
}

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { flag, limitOf, concurrencyOf, type IngestArgs } from "./cli"
import type { SourcePlace } from "./geography"
import {
  checkLibrarySlugs,
  validateLibraries,
  importLibraryDrafts,
  type PreparedLibrary,
} from "./pipeline"
import {
  applyPlaces,
  planPlaces,
  type PlacePlan,
  type PlaceOptions,
} from "./places"
import {
  ingestDatabase,
  placeReportingCodes,
  storeOwnedPopulation,
} from "./population"
import { RunLog, type RunLogEntry } from "./run-log"
import type { SourceFile } from "./source-file"
import { DATASET_SEED } from "../../../src/seeds/datasets"

const TABLE = {
  country: "countries",
  region: "regions",
  area: "areas",
} as const

export interface PipelineLibrary extends PreparedLibrary {
  countryKey: string
  areaKey?: string
}

/** The country adapters prepare and validate sources; this runner owns CMS writes and resume. */
export async function executeIngest(options: {
  args: IngestArgs
  directory: string
  dataset: string
  populationDataset: string
  inputs: SourceFile[]
  year: number
  boundaryDate: string
  libraryRetrievedAt: string
  sourceCount: number
  libraries: PipelineLibrary[]
  geography: SourcePlace[]
  skipped: Omit<RunLogEntry, "status">[]
  placeOptions: PlaceOptions
  observationFor: (place: SourcePlace) => Record<string, unknown>
  details?: Record<string, unknown>
}) {
  const {
    args,
    directory,
    dataset,
    populationDataset,
    inputs,
    year,
    boundaryDate,
    libraryRetrievedAt,
    sourceCount,
    libraries,
    geography,
    placeOptions,
    observationFor,
    details,
  } = options
  const apply = flag(args, "apply")
  if (apply && flag(args, "dry-run"))
    throw new Error("Choose --apply or --dry-run")
  const limit = limitOf(args)
  const concurrency = concurrencyOf(args)
  validateLibraries(libraries)
  const countries = Object.keys(placeOptions.countries)
  const logPath = args.log ?? path.join(directory, `${dataset}.ingest-log.json`)
  const log = new RunLog(logPath, {
    dataset,
    startedAt: new Date().toISOString(),
    dryRun: !apply,
    input: inputs,
    args,
  })
  for (const row of options.skipped) log.add({ ...row, status: "skipped" })
  const report: Record<string, any> = {
    dataset: dataset,
    dryRun: !apply,
    concurrency,
    year,
    boundaryDate: boundaryDate,
    input: inputs,
    libraries: {
      source: sourceCount,
      mapped: libraries.length,
      skipped: log.counts().skipped,
      missingCoordinates: libraries.filter((record) => !record.data.location)
        .length,
      types: Object.fromEntries(
        [...new Set(libraries.map((record) => record.data.libraryType))].map(
          (type) => [
            type,
            libraries.filter((record) => record.data.libraryType === type)
              .length,
          ]
        )
      ),
    },
    geography: Object.fromEntries(
      countries.map((country) => [
        country,
        {
          regions: geography.filter(
            (place) => place.country === country && place.level === "region"
          ).length,
          areas: geography.filter(
            (place) => place.country === country && place.level === "area"
          ).length,
          population: geography.find((place) => place.key === country)!
            .population,
        },
      ])
    ),
    ...details,
    populationEstimates: geography.length,
    pendingPublication:
      "New places and libraries are drafts; existing population fields are enriched without publishing drafts.",
  }
  const runs = path.join(directory, ".runs")
  mkdirSync(runs, { recursive: true })
  const reportFile = path.join(
    runs,
    `${new Date().toISOString().replaceAll(":", "-")}.${apply ? "apply" : "plan"}.json`
  )
  const saveReport = () =>
    writeFileSync(reportFile, JSON.stringify(report, null, 2))
  let database: any
  let connection: any
  try {
    if (!apply && !flag(args, "check-cms")) {
      const identities = new Set<string>()
      const slugs = new Set<string>()
      for (const record of libraries) {
        if (identities.has(record.recordId) || slugs.has(record.data.slug))
          throw new Error(`Duplicate identity ${record.recordId}`)
        identities.add(record.recordId)
        slugs.add(record.data.slug)
        log.add({
          recordId: record.recordId,
          name: record.data.name,
          status: "dry-run",
          slug: record.data.slug,
          warnings: record.warnings,
        })
      }
      report.cmsChecked = false

      return report
    }
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
    const plan: PlacePlan = await planPlaces(
      client,
      geography,
      await placeReportingCodes(database, countries),
      placeOptions
    )
    const databaseCountries = await database("countries")
      .whereIn("iso_2", countries)
      .where("locale", "en")
      .select("iso_2", "document_id")
    for (const country of databaseCountries) {
      if (
        plan.actions.find((action) => action.source.key === country.iso_2)
          ?.existing?.documentId !== country.document_id
      )
        throw new Error(
          `REST preflight did not find the database Country ${country.iso_2}`
        )
    }
    const databaseEurope = await database("continents")
      .where({ slug: "europe", locale: "en" })
      .first()
    if (
      databaseEurope &&
      plan.continent?.documentId !== databaseEurope.document_id
    )
      throw new Error(
        "REST preflight did not find the database Continent Europe"
      )
    // A REST server and an unrelated database must never be combined in one run.
    if (
      plan.continent &&
      !(await database("continents")
        .where({ document_id: plan.continent.documentId })
        .first())
    )
      throw new Error("REST and DATABASE_* point at different atlas databases")
    for (const action of plan.actions.filter((item) => item.existing)) {
      if (
        !(await database(TABLE[action.source.level])
          .where({ document_id: action.existing!.documentId })
          .first())
      )
        throw new Error(`REST and database disagree on ${action.source.key}`)
    }
    const existing = await client.librariesBySourceRecord(dataset)
    await checkLibrarySlugs(client, libraries, existing)
    const registered = await client.findAll("datasets", {
      filters: { key: { $in: [dataset, populationDataset] } },
    })
    const missingDatasets = DATASET_SEED.filter(
      (seed) =>
        [dataset, populationDataset].includes(seed.key) &&
        !registered.some((dataset) => dataset.key === seed.key)
    )
    report.cmsChecked = true
    report.missingDatasets = missingDatasets.map((seed) => seed.key)
    report.places = plan.actions.map((action) => ({
      key: action.source.key,
      name: action.source.name,
      existingName: action.existing?.name,
      slug: action.slug,
      status: action.existing ? "exists" : "planned",
      documentId: action.existing?.documentId,
    }))
    report.legacyPlaces = plan.legacy
    report.libraries.existing = libraries.filter((record) =>
      existing.has(record.recordId)
    ).length
    report.libraries.toCreate = Math.min(
      libraries.length - report.libraries.existing,
      limit
    )
    saveReport()
    if (!apply) {
      for (const record of libraries)
        log.add({
          recordId: record.recordId,
          name: record.data.name,
          status: existing.has(record.recordId) ? "exists" : "dry-run",
          slug: record.data.slug,
          warnings: record.warnings,
        })

      return report
    }
    for (const seed of missingDatasets)
      await client.post("/datasets", { data: seed })
    const resolved = await applyPlaces(
      client,
      plan,
      (action, documentId) => {
        const entry = report.places.find(
          (place: any) => place.key === action.source.key
        )
        Object.assign(entry, {
          documentId,
          status: action.existing ? "exists" : "created",
        })
        saveReport()
      },
      placeOptions
    )
    report.population = await storeOwnedPopulation(
      database,
      geography.map((place) => ({
        table: TABLE[place.level],
        documentId: resolved.ids.get(place.key)!,
        iso2: place.country,
        observation: observationFor(place),
      }))
    )
    saveReport()
    const connect = (id: string) => ({ connect: [{ documentId: id }] })
    const areas = new Map(
      geography
        .filter((place) => place.level === "area")
        .map((place) => [place.key, place])
    )
    report.libraries.created = await importLibraryDrafts({
      client,
      dataset: dataset,
      records: libraries,
      existing,
      retrievedAt: libraryRetrievedAt,
      log,
      limit,
      concurrency,
      relations: (record) => {
        const area = record.areaKey ? areas.get(record.areaKey)! : undefined

        return {
          continent: connect(resolved.continentId),
          country: connect(resolved.ids.get(record.countryKey)!),
          ...(area
            ? {
                region: connect(resolved.ids.get(area.parent!)!),
                area: connect(resolved.ids.get(area.key)!),
              }
            : {}),
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
    saveReport()
    if (connection) {
      await database
        .raw("SELECT pg_advisory_unlock(7420110, hashtext(?))", [dataset])
        .connection(connection)
      await database.client.releaseConnection(connection)
    }
    await database?.destroy()
    console.log(
      JSON.stringify(
        {
          ...report,
          input: inputs.map((input) => ({
            file: input.file,
            sha256: input.sha256,
          })),
          places: report.places
            ? {
                created: report.places.filter(
                  (place: any) => place.status === "created"
                ).length,
                existing: report.places.filter(
                  (place: any) => place.status === "exists"
                ).length,
                planned: report.places.filter(
                  (place: any) => place.status === "planned"
                ).length,
              }
            : undefined,
          reportFile,
          logPath,
        },
        null,
        2
      )
    )
  }
}

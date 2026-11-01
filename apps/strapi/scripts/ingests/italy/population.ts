import { readFileSync } from "node:fs"
import path from "node:path"

import { ITALIAN_REGIONS } from "./iccu/map"
import { italianProvinceAliases } from "./iccu/provinces"
import { flag, type IngestArgs } from "../_shared/cli"
import { matchDirectoryPlace } from "../_shared/directory"
import {
  ingestDatabase,
  storeOwnedPopulation,
  type OwnedPopulation,
} from "../_shared/population"
import { assertIngestTarget } from "../_shared/target"

interface ItalianPopulationObservation extends Record<string, unknown> {
  reportingCode: string
  parentReportingCode?: string
  level: "country" | "region" | "area"
  iso2: string
  year: number
  name: string
  population: number
  boundaryVersion: string
  licence: string
  method: string
  sourceUrl: string
  key: string
  retrievedAt: string
}

export function validateItalianPopulation(input: unknown) {
  if (
    !input ||
    typeof input !== "object" ||
    !("country" in input) ||
    input.country !== "IT" ||
    !("observations" in input) ||
    !Array.isArray(input.observations) ||
    input.observations.length !== 128 ||
    input.observations.some((row) => !row || typeof row !== "object")
  )
    throw new Error(
      "Expected a complete Italian administrative population plan"
    )
  const rows = input.observations as ItalianPopulationObservation[]
  if (rows.length !== 128)
    throw new Error(
      "Expected a complete Italian administrative population plan"
    )
  const codes = new Set<string>()
  for (const row of rows) {
    if (
      codes.has(row.reportingCode) ||
      row.iso2 !== "IT" ||
      row.year !== 2023 ||
      row.boundaryVersion !== "20240101" ||
      row.licence !== "CC BY 4.0" ||
      row.method !== "sum_complete_children" ||
      row.sourceUrl !==
        "https://www.istat.it/notizia/dati-per-sezioni-di-censimento/" ||
      row.key !== `istat:IT:2023:${row.level}:${row.reportingCode}` ||
      !Number.isSafeInteger(row.population) ||
      row.population <= 0 ||
      typeof row.name !== "string" ||
      !row.name ||
      typeof row.retrievedAt !== "string" ||
      !Number.isFinite(Date.parse(row.retrievedAt))
    )
      throw new Error("Invalid Italian population provenance or identity")
    codes.add(row.reportingCode)
    if (
      (row.level === "country" && row.reportingCode !== "ITA") ||
      (row.level === "region" && !/^IT-R\d{2}$/.test(row.reportingCode)) ||
      (row.level === "area" && !/^IT-P\d{3}$/.test(row.reportingCode)) ||
      !["country", "region", "area"].includes(row.level)
    )
      throw new Error("Invalid Italian reporting code")
  }
  const countries = rows.filter((row) => row.level === "country")
  const regions = rows.filter((row) => row.level === "region")
  const provinces = rows.filter((row) => row.level === "area")
  if (
    countries.length !== 1 ||
    regions.length !== 20 ||
    provinces.length !== 107 ||
    countries[0].population !== 58_971_230 ||
    regions.some((row) => row.parentReportingCode !== "ITA") ||
    regions.reduce((sum, row) => sum + row.population, 0) !==
      countries[0].population ||
    provinces.some(
      (row) =>
        !regions.some(
          (region) => region.reportingCode === row.parentReportingCode
        )
    ) ||
    regions.some(
      (region) =>
        provinces
          .filter((row) => row.parentReportingCode === region.reportingCode)
          .reduce((sum, row) => sum + row.population, 0) !== region.population
    )
  )
    throw new Error("Italian population hierarchy does not reconcile")

  return { countries, regions, provinces }
}

export async function runItalyPopulation(args: IngestArgs) {
  assertIngestTarget({ ...args, "check-cms": "true" })
  const input = JSON.parse(
    readFileSync(
      args.input ??
        path.resolve(
          __dirname,
          "../../../../analysis/data/europe-staging/italy/administrative.json"
        ),
      "utf8"
    )
  )
  const { countries, regions, provinces } = validateItalianPopulation(input)
  const database = ingestDatabase()
  try {
    const unique = (
      rows: {
        id: number
        document_id: string
        name: string
        regionDocumentId?: string
      }[]
    ) => [
      ...new Map(
        rows.map((row) => [
          row.document_id,
          {
            ...row,
            documentId: row.document_id,
          },
        ])
      ).values(),
    ]
    const localCountries = unique(
      await database("countries")
        .where({ iso_2: "IT", locale: "en" })
        .select("id", "document_id", "name")
    )
    if (localCountries.length !== 1)
      throw new Error("Missing or ambiguous Italy")
    const localRegions = unique(
      await database("regions as p")
        .join("regions_country_lnk as l", "l.region_id", "p.id")
        .join("countries as c", "c.id", "l.country_id")
        .where({ "c.iso_2": "IT", "p.locale": "en" })
        .select("p.id", "p.document_id", "p.name")
    )
    const localAreas = unique(
      await database("areas as p")
        .join("areas_country_lnk as c", "c.area_id", "p.id")
        .join("countries as co", "co.id", "c.country_id")
        .join("areas_region_lnk as l", "l.area_id", "p.id")
        .join("regions as r", "r.id", "l.region_id")
        .where({ "co.iso_2": "IT", "p.locale": "en" })
        .select(
          "p.id",
          "p.document_id",
          "p.name",
          "r.document_id as regionDocumentId"
        )
    )
    const owners = new Map<string, string>()
    const plan: OwnedPopulation[] = [
      {
        table: "countries",
        documentId: localCountries[0].documentId,
        iso2: "IT",
        observation: countries[0],
      },
    ]
    for (const row of regions) {
      const name = ITALIAN_REGIONS[row.name.toUpperCase()] ?? row.name
      const place = matchDirectoryPlace(localRegions, name, [
        row.name,
        ...(name === "Aosta Valley" ? ["Valled'Aosta", "Valle d'Aosta"] : []),
      ])
      if (!place || [...owners.values()].includes(place.documentId))
        throw new Error(`Unresolved population Region ${row.name}`)
      owners.set(row.reportingCode, place.documentId)
      plan.push({
        table: "regions",
        documentId: place.documentId,
        iso2: "IT",
        observation: row,
      })
    }
    const areaOwners = new Set<string>()
    for (const row of provinces) {
      const place = matchDirectoryPlace(
        localAreas.filter(
          (area) =>
            area.regionDocumentId === owners.get(row.parentReportingCode)
        ),
        row.name,
        italianProvinceAliases(row.name)
      )
      if (!place || areaOwners.has(place.documentId))
        throw new Error(`Unresolved population province ${row.name}`)
      areaOwners.add(place.documentId)
      plan.push({
        table: "areas",
        documentId: place.documentId,
        iso2: "IT",
        observation: row,
      })
    }
    const result = flag(args, "apply")
      ? await storeOwnedPopulation(database, plan)
      : undefined
    console.log(
      JSON.stringify({
        country: "IT",
        year: 2023,
        owners: plan.length,
        regions: owners.size,
        provinces: areaOwners.size,
        applied: flag(args, "apply"),
        result,
      })
    )
  } finally {
    await database.destroy()
  }
}

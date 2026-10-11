import { createHash } from "node:crypto"

import {
  aggregatePopulation,
  populationCountryCode,
  POPULATION_REFERENCE_YEAR,
  type PopulationObservation,
  worldBankPopulation,
  WORLD_BANK_COUNTRIES_URL,
  WORLD_BANK_POPULATION_URL,
  worldBankWorldPopulation,
} from "@repo/shared-data"

import { withLeaderLock } from "./leader-lock"
import {
  populationPlan,
  storePopulationPlan,
  readPopulationEstimates,
} from "./population-storage"

const LOCK = 7_420_107
const OBSERVATION_FIELDS = [
  "key",
  "level",
  "reportingCode",
  "iso2",
  "name",
  "population",
  "year",
  "source",
  "sourceUrl",
  "licence",
  "retrievedAt",
  "method",
]

export async function readPopulationObservations(strapi: any) {
  const rows = await readPopulationEstimates(
    strapi.db.connection,
    ["countries"],
    (row: PopulationObservation) =>
      row.level === "country" &&
      row.year === POPULATION_REFERENCE_YEAR &&
      row.key.startsWith("world-bank:country:")
  )
  if (rows.length > 512)
    throw new Error("Population observation budget exceeded")
  const codes = new Set<string>()
  const observations: PopulationObservation[] = rows.map((row: any) => {
    const population = row.population === null ? null : Number(row.population)
    if (
      codes.has(row.reportingCode) ||
      !/^[A-Z]{3}$/.test(row.reportingCode) ||
      (population !== null &&
        (!Number.isSafeInteger(population) || population <= 0))
    )
      throw new Error("Invalid population observation")
    codes.add(row.reportingCode)

    return Object.fromEntries(
      OBSERVATION_FIELDS.map((field) => [
        field,
        field === "population" ? population : row[field],
      ])
    ) as unknown as PopulationObservation
  })

  return observations
}

/** Derived fields update every locale/version without publishing unrelated draft edits. */
async function updateDerivedPopulation(
  strapi: any,
  uid: string,
  documentId: string,
  data: Record<string, unknown>
) {
  await strapi.db.query(uid).updateMany({
    where: {
      documentId,
      // The scheduled World Bank run must not replace a newer national estimate.
      ...(Number.isInteger(data.populationYear)
        ? {
            $or: [
              { populationYear: { $null: true } },
              { populationYear: { $lte: data.populationYear } },
            ],
          }
        : {}),
    },
    data,
  })
}

export async function ingestPopulation(
  strapi: any,
  options: { dryRun?: boolean; fetch?: typeof fetch } = {}
) {
  const download = options.fetch ?? fetch
  const inputs = await Promise.all(
    [WORLD_BANK_COUNTRIES_URL, WORLD_BANK_POPULATION_URL].map(async (url) => {
      const response = await download(url, {
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok)
        throw new Error(`Population source HTTP ${response.status}`)

      return response.json()
    })
  )
  const observations = worldBankPopulation(
    inputs[0],
    inputs[1],
    new Date().toISOString()
  )
  const world = worldBankWorldPopulation(
    inputs[1],
    observations[0]!.retrievedAt
  )
  const countries = await strapi.documents("api::country.country").findMany({
    locale: "en",
    status: "published",
    fields: ["documentId", "name", "iso2", "iso3"],
    populate: { continent: { fields: ["documentId", "slug"] } },
    limit: 513,
  })
  if (countries.length > 512)
    throw new Error("Country population budget exceeded")
  const byCode = new Map(observations.map((row) => [row.reportingCode, row]))
  const plan = countries.map((country: any) => ({
    country,
    match: populationCountryCode(country, observations),
  }))
  const storagePlan = await populationPlan(strapi.db.connection, [
    ...observations,
    world,
  ])
  const report = {
    year: POPULATION_REFERENCE_YEAR,
    observations: observations.length,
    estimatesStored: storagePlan.length,
    worldPopulation: world.population,
    matched: plan.filter((row: any) => row.match && !row.match.parent).length,
    parentReportingAreas: plan
      .filter((row: any) => row.match?.parent)
      .map((row: any) => row.country.name),
    missing: plan
      .filter((row: any) => !row.match)
      .map((row: any) => ({
        name: row.country.name,
        iso2: row.country.iso2,
        iso3: row.country.iso3,
      })),
    dryRun: options.dryRun === true,
  }
  if (options.dryRun) return report
  const result = await withLeaderLock(strapi, LOCK, async () => {
    await strapi.db.transaction(async ({ trx }) => {
      await storePopulationPlan(
        trx,
        await populationPlan(trx, [...observations, world])
      )
      for (const { country, match } of plan) {
        if (!match) continue
        if (match.parent) {
          await updateDerivedPopulation(
            strapi,
            "api::country.country",
            country.documentId,
            {
              populationReportingCode: match.code,
              populationCoverage: {
                complete: false,
                reason: "parent_reporting_area",
                comparisonCode: match.code,
              },
            }
          )
          continue
        }
        const observation = byCode.get(match.code)!
        await updateDerivedPopulation(
          strapi,
          "api::country.country",
          country.documentId,
          {
            populationCount: observation.population?.toString() ?? null,
            populationYear: observation.year,
            populationSource: observation.source,
            populationSourceUrl: observation.sourceUrl,
            populationLicence: observation.licence,
            populationRetrievedAt: observation.retrievedAt,
            populationReportingCode: observation.reportingCode,
            populationMethod: "direct",
            populationCoverage: { complete: observation.population !== null },
          }
        )
      }
      const continents = await strapi
        .documents("api::continent.continent")
        .findMany({
          locale: "en",
          status: "published",
          fields: ["documentId", "slug"],
          limit: 20,
        })
      for (const continent of continents) {
        const children = plan.filter(
          (row: any) =>
            row.country.continent?.documentId === continent.documentId
        )
        const codes = children.map(
          (row: any) => row.match?.code ?? row.country.iso3 ?? row.country.iso2
        )
        const total = aggregatePopulation(codes, observations)
        await updateDerivedPopulation(
          strapi,
          "api::continent.continent",
          continent.documentId,
          {
            // CMS membership has not been audited as a complete geographic partition.
            // A subtotal must never be presented as the continent's population.
            population: null,
            populationYear: null,
            populationSource: "Sum of World Bank country observations",
            populationSourceUrl: WORLD_BANK_POPULATION_URL,
            populationLicence: "CC BY 4.0",
            populationRetrievedAt: observations[0]!.retrievedAt,
            populationReportingCode: continent.slug,
            populationMethod: "sum_complete_children",
            populationCoverage: {
              ...total.coverage,
              complete: false,
              scope: "cms_country_catalogue",
              reason: "unverified_geographic_coverage",
            },
          }
        )
      }
    })

    return report
  })
  if (!result.ran) throw new Error("Population import already running")

  return result.result
}

export function populationVersion(
  observations: PopulationObservation[]
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...observations].sort((a, b) => a.key.localeCompare(b.key))
      )
    )
    .digest("hex")
    .slice(0, 16)
}

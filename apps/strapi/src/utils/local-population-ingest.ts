import {
  atlasLocalGeography,
  onsLocalPopulation,
  onsLocalPopulationUrl,
  POPULATION_REFERENCE_YEAR,
} from "@repo/shared-data"

import { withLeaderLock } from "./leader-lock"
import {
  populationPlan,
  storePopulationPlan,
  readPopulationEstimates,
} from "./population-storage"

export async function readLocalPopulation(strapi: any) {
  const rows = await readPopulationEstimates(
    strapi.db.connection,
    ["areas", "regions"],
    (row: any) =>
      row.level === "area" &&
      row.year === POPULATION_REFERENCE_YEAR &&
      row.boundaryVersion === atlasLocalGeography.version &&
      row.key.startsWith("ons:area:")
  )
  if (rows.length > 1024)
    throw new Error("Local population catalogue exceeds budget")
  const expected = new Set(atlasLocalGeography.areas.map((area) => area.code)),
    seen = new Set<string>()
  for (const row of rows) {
    row.population = Number(row.population)
    if (
      !expected.has(row.reportingCode) ||
      seen.has(row.reportingCode) ||
      !Number.isSafeInteger(row.population) ||
      row.population <= 0 ||
      row.year !== POPULATION_REFERENCE_YEAR
    )
      throw new Error("Invalid local population catalogue")
    seen.add(row.reportingCode)
  }
  if (seen.size !== expected.size)
    throw new Error("Local population import is not ready")

  return rows
}

export async function ingestLocalPopulation(
  strapi: any,
  options: { dryRun?: boolean; fetch?: typeof fetch } = {}
) {
  const codes = atlasLocalGeography.areas.map((area) => area.code),
    observations = []
  const retrievedAt = new Date().toISOString(),
    download = options.fetch ?? fetch
  // Respect Nomis concurrency limits; each response must cover its exact requested code set.
  for (let start = 0; start < codes.length; start += 64) {
    const batch = codes.slice(start, start + 64)
    const response = await download(onsLocalPopulationUrl(batch), {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    })
    if (!response.ok)
      throw new Error(`Local population source HTTP ${response.status}`)
    observations.push(
      ...onsLocalPopulation(await response.json(), batch, retrievedAt)
    )
  }
  const storagePlan = await populationPlan(
    strapi.db.connection,
    observations.map((row) => ({
      ...row,
      boundaryVersion: atlasLocalGeography.version,
      parentReportingCode: "GBR",
    }))
  )
  const report = {
    year: POPULATION_REFERENCE_YEAR,
    observations: observations.length,
    cmsAreasUpdated: storagePlan.filter((row) => row.owner.table === "areas")
      .length,
    cmsRegionsUpdated: storagePlan.filter(
      (row) => row.owner.table === "regions"
    ).length,
    boundaryVersion: atlasLocalGeography.version,
    dryRun: options.dryRun === true,
  }
  if (options.dryRun) return report
  const result = await withLeaderLock(strapi, 7420107, async () => {
    await strapi.db.transaction(async ({ trx }) => {
      await storePopulationPlan(
        trx,
        await populationPlan(
          trx,
          observations.map((row) => ({
            ...row,
            boundaryVersion: atlasLocalGeography.version,
            parentReportingCode: "GBR",
          }))
        )
      )
    })

    return report
  })
  if (!result.ran) throw new Error("Population import already running")

  return result.result
}

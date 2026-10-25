import type { PopulationObservation } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { readPopulationEstimates } from "./population-storage"

const PROFILES: Record<string, string> = {
  SE: "SWE",
  NO: "NOR",
  DK: "DNK",
  FI: "FIN",
  AX: "ALA",
}

type ContextObservation = Partial<PopulationObservation> & {
  key: string
  level: string
  reportingCode: string
  year: number
  population: number | null
  boundaryVersion?: string
}

/** Read geographic observations, never the Library index. Preserve each release's year. */
export async function atlasPopulationContext(
  strapi: Core.Strapi,
  country: string
) {
  if (country !== "all" && !Object.hasOwn(PROFILES, country))
    throw new RangeError("Unsupported population country")
  const matches = (row: ContextObservation) => matchesCountry(row, country)
  const rows = await readPopulationEstimates(
    strapi.db.connection,
    country === "all" ? ["countries"] : ["countries", "regions", "areas"],
    matches
  )
  if (rows.length > 4096) throw new Error("Population context exceeds budget")
  const latest = new Map<string, ContextObservation>()
  for (const row of rows) {
    const key = `${row.level}:${row.reportingCode}`
    const prior = latest.get(key)
    if (
      prior?.year === row.year &&
      (prior.population !== row.population ||
        prior.boundaryVersion !== row.boundaryVersion)
    )
      throw new Error("Conflicting population releases")
    if (!prior || prior.year < row.year) latest.set(key, row)
  }
  if (country !== "all")
    await attachPlaceNames(strapi, country, latest, matches)

  return {
    country,
    iso3: PROFILES[country],
    observations: [...latest.values()].map((row) =>
      row.reportingCode === "FIN-mainland"
        ? { ...row, reportingCode: "FIN", name: "Finland (mainland)" }
        : row
    ),
  }
}

async function attachPlaceNames(
  strapi: Core.Strapi,
  country: string,
  latest: Map<string, ContextObservation>,
  matches: (row: ContextObservation) => boolean
) {
  // Names belong to geographic documents. Restrict the query before its budget,
  // so adding another country's places cannot exhaust this country's catalogue.
  for (const table of ["countries", "regions", "areas"]) {
    const places = await strapi.db
      .connection(table)
      .where({ locale: "en" })
      .whereNotNull("published_at")
      .whereRaw("population_estimates::text LIKE ?", [`%:${country}:%`])
      .select("name", "population_estimates")
      .limit(4097)
    if (places.length > 4096)
      throw new Error("Population geography exceeds budget")
    for (const place of places) attachPlaceName(latest, place, matches)
  }
}

function matchesCountry(row: ContextObservation, country: string) {
  return country === "all"
    ? row.level === "country" &&
        [...Object.values(PROFILES), "FIN-mainland"].includes(
          row.reportingCode
        ) &&
        Object.keys(PROFILES).some(
          (code) => row.iso2 === code || row.key?.includes(`:${code}:`)
        )
    : row.iso2 === country ||
        (typeof row.key === "string" && row.key.includes(`:${country}:`))
}

function attachPlaceName(
  latest: Map<string, ContextObservation>,
  place: {
    name: string
    population_estimates: string | ContextObservation[] | null
  },
  matches: (row: ContextObservation) => boolean
) {
  for (const row of typeof place.population_estimates === "string"
    ? JSON.parse(place.population_estimates)
    : (place.population_estimates ?? [])) {
    const item = latest.get(`${row.level}:${row.reportingCode}`)
    if (matches(row) && item?.key === row.key)
      latest.set(`${row.level}:${row.reportingCode}`, {
        ...item,
        name: place.name,
      })
  }
}

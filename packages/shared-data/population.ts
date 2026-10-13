export const POPULATION_REFERENCE_YEAR = 2024
export const WORLD_BANK_POPULATION_SOURCE = "World Bank WDI · SP.POP.TOTL"
export const WORLD_BANK_POPULATION_URL = `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=${POPULATION_REFERENCE_YEAR}&format=json&per_page=400&source=2`
export const WORLD_BANK_COUNTRIES_URL =
  "https://api.worldbank.org/v2/country?format=json&per_page=400"

export interface PopulationObservation {
  key: string
  level: "world" | "country" | "region" | "area" | "continent"
  reportingCode: string
  iso2: string | null
  name: string
  population: number | null
  year: number
  source: string
  sourceUrl: string
  licence: string
  retrievedAt: string
  method: "direct" | "sum_complete_children"
}

function completePage(value: unknown): Record<string, any>[] {
  if (
    !Array.isArray(value) ||
    value[0]?.pages !== 1 ||
    !Array.isArray(value[1]) ||
    value[0]?.total !== value[1].length
  )
    throw new Error("Incomplete World Bank response")

  return value[1]
}

/** A country's population observation year is never inferred from retrieval date. */
export function worldBankPopulation(
  economies: unknown,
  data: unknown,
  retrievedAt: string
): PopulationObservation[] {
  if (!Number.isFinite(Date.parse(retrievedAt)))
    throw new Error("Invalid population retrieval date")
  const countries = completePage(economies).filter(
    (country) => country.region?.id !== "NA"
  )
  const codes = new Set(countries.map((country) => country.id))
  if (codes.size !== countries.length || codes.size < 200)
    throw new Error("Incomplete or duplicate World Bank economies")
  const values = new Map<string, number | null>()
  for (const row of completePage(data)) {
    if (!codes.has(row.countryiso3code)) continue
    if (
      values.has(row.countryiso3code) ||
      row.date !== String(POPULATION_REFERENCE_YEAR) ||
      row.indicator?.id !== "SP.POP.TOTL"
    )
      throw new Error("Duplicate or mismatched population observation")
    if (
      row.value !== null &&
      (!Number.isSafeInteger(row.value) || row.value <= 0)
    )
      throw new Error("Invalid population denominator")
    values.set(row.countryiso3code, row.value)
  }
  if (values.size !== codes.size)
    throw new Error("Incomplete country population observations")

  return countries.map((country) => {
    if (!/^[A-Z]{3}$/.test(country.id) || !/^[A-Z]{2}$/.test(country.iso2Code))
      throw new Error("Invalid World Bank economy code")

    return {
      key: `world-bank:country:${country.id}:${POPULATION_REFERENCE_YEAR}`,
      level: "country",
      reportingCode: country.id,
      iso2: country.iso2Code,
      name: country.name,
      population: values.get(country.id)!,
      year: POPULATION_REFERENCE_YEAR,
      source: WORLD_BANK_POPULATION_SOURCE,
      sourceUrl: WORLD_BANK_POPULATION_URL,
      licence: "CC BY 4.0",
      retrievedAt,
      method: "direct",
    }
  })
}

/** Use the source's world observation, rather than summing incomplete country coverage. */
export function worldBankWorldPopulation(
  data: unknown,
  retrievedAt: string
): PopulationObservation {
  const rows = completePage(data).filter((row) => row.countryiso3code === "WLD")
  const row = rows[0]
  if (
    rows.length !== 1 ||
    !row ||
    row.date !== String(POPULATION_REFERENCE_YEAR) ||
    row.indicator?.id !== "SP.POP.TOTL" ||
    !Number.isSafeInteger(row.value) ||
    row.value <= 0
  )
    throw new Error("Invalid World Bank world observation")

  return {
    key: `world-bank:world:WLD:${POPULATION_REFERENCE_YEAR}`,
    level: "world",
    reportingCode: "WLD",
    iso2: null,
    name: "World",
    population: row.value,
    year: POPULATION_REFERENCE_YEAR,
    source: WORLD_BANK_POPULATION_SOURCE,
    sourceUrl: WORLD_BANK_POPULATION_URL,
    licence: "CC BY 4.0",
    retrievedAt,
    method: "direct",
  }
}

/** UK nations are separate CMS Countries but share the UK's global reporting area. */
const UK_NATIONS = new Set(["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"])

export function populationCountryCode(
  country: { iso2?: string | null; iso3?: string | null },
  observations: Pick<PopulationObservation, "iso2" | "reportingCode">[]
): { code: string; parent: boolean } | null {
  const iso2 = country.iso2?.trim().toUpperCase(),
    iso3 = country.iso3?.trim().toUpperCase()
  if (iso2 && UK_NATIONS.has(iso2)) {
    if (iso3 && iso3 !== iso2.slice(3))
      throw new Error("Conflicting Atlas country ISO codes")

    return { code: "GBR", parent: true }
  }
  const fromIso2 = observations.find((row) => row.iso2 === iso2)?.reportingCode
  if (iso3 && fromIso2 && iso3 !== fromIso2)
    throw new Error("Conflicting Atlas country ISO codes")
  const code = iso3 || fromIso2

  return code && observations.some((row) => row.reportingCode === code)
    ? { code, parent: false }
    : null
}

/** Sum only an explicitly complete, disjoint set of reporting areas in one year. */
export function aggregatePopulation(
  expected: string[],
  observations: PopulationObservation[]
) {
  const unique = [...new Set(expected)]
  const rows = unique.map((code) =>
    observations.find((row) => row.reportingCode === code)
  )
  const complete =
    unique.length > 0 &&
    rows.every((row) => row && row.population !== null) &&
    new Set(rows.map((row) => row?.year)).size === 1

  return {
    population: complete
      ? rows.reduce((sum, row) => sum + row!.population!, 0)
      : null,
    year: complete ? rows[0]!.year : null,
    coverage: {
      expected: unique.length,
      observed: rows.filter(
        (row) => row?.population !== null && row !== undefined
      ).length,
      complete,
    },
  }
}

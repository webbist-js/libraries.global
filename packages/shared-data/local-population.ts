import {
  POPULATION_REFERENCE_YEAR,
  type PopulationObservation,
} from "./population"

export const ONS_LOCAL_POPULATION_SOURCE =
  "ONS mid-year population estimates · Nomis NM_2002_1"
export const ONS_LOCAL_POPULATION_URL =
  "https://www.nomisweb.co.uk/datasets/pestsyoala"
export function onsLocalPopulationUrl(codes: string[]): string {
  if (
    !codes.length ||
    codes.length > 64 ||
    codes.some((code) => !/^[EWSN]\d{8}$/.test(code))
  )
    throw new Error("Invalid ONS reporting codes")

  return `https://www.nomisweb.co.uk/api/v01/dataset/NM_2002_1.data.json?geography=${codes.join(",")}&date=${POPULATION_REFERENCE_YEAR}&gender=0&c_age=200&measures=20100`
}
/** All sexes, all ages, persons, fixed year, exact boundary codes; reject partial/revised geographies. */
export function onsLocalPopulation(
  input: any,
  codes: string[],
  retrievedAt: string
): PopulationObservation[] {
  if (
    !Number.isFinite(Date.parse(retrievedAt)) ||
    input?.header?.truncated !== "false" ||
    !Array.isArray(input.obs) ||
    input.obs.length !== codes.length
  )
    throw new Error("Incomplete ONS population response")
  const expected = new Set(codes),
    seen = new Set<string>()

  return input.obs.map((row: any) => {
    const code = row.geography?.geogcode,
      population = row.obs_value?.value
    if (
      !expected.has(code) ||
      seen.has(code) ||
      row.dataset?.value !== "NM_2002_1" ||
      Number(row.time?.value) !== POPULATION_REFERENCE_YEAR ||
      row.gender?.value !== 0 ||
      row.c_age?.value !== 200 ||
      row.measures?.value !== 20100 ||
      row.unit?.value !== "PER" ||
      row.obs_status?.value !== "A" ||
      !Number.isSafeInteger(population) ||
      population <= 0
    )
      throw new Error("Invalid ONS population observation")
    seen.add(code)

    return {
      key: `ons:area:${code}:${POPULATION_REFERENCE_YEAR}`,
      level: "area",
      reportingCode: code,
      iso2: "GB",
      name: row.geography.description,
      population,
      year: POPULATION_REFERENCE_YEAR,
      source: ONS_LOCAL_POPULATION_SOURCE,
      sourceUrl: ONS_LOCAL_POPULATION_URL,
      licence: "Open Government Licence v3.0",
      retrievedAt,
      method: "direct",
    }
  })
}

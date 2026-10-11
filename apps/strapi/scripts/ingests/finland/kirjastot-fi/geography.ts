import { POPULATION_URL, type FinlandSource } from "./source"
import type { SourcePlace } from "../../_shared/geography"
import { slugify } from "../../_shared/text"

export { nameKey, type SourcePlace } from "../../_shared/geography"

function itemName(item: any): string {
  const name = item?.classificationItemNames?.[0]?.name
  if (typeof name !== "string" || !name.trim())
    throw new Error("Classification item has no name")

  return name.trim()
}

function classificationMap(rows: any[], date: string, target: string) {
  if (!Array.isArray(rows) || rows.length === 0)
    throw new Error("Empty classification")
  const result = new Map<
    string,
    { name: string; regionName: string; region: string }
  >()
  for (const row of rows) {
    const code = row.sourceItem?.code
    const region = row.targetItem?.code
    if (
      !/^\d{3}$/.test(code) ||
      !(target === "maakunta" ? /^\d{2}$/ : /^\d{3}$/).test(region) ||
      result.has(code) ||
      row.sourceItem.localId !== `kunta_1_${date}/${code}` ||
      row.targetItem.localId !== `${target}_1_${date}/${region}`
    )
      throw new Error(`Invalid or duplicate classification ${code}`)
    result.set(code, {
      name: itemName(row.sourceItem),
      regionName: itemName(row.targetItem),
      region,
    })
  }

  return result
}

export function populationValues(
  data: any,
  areaCode: string,
  year: number
): Map<string, number> {
  if (
    data.class !== "dataset" ||
    data.version !== "2.0" ||
    JSON.stringify(data.id) !==
      JSON.stringify([areaCode, "contentscode", "timeperiod_y"]) ||
    data.size?.[1] !== 1 ||
    data.size?.[2] !== 1
  )
    throw new Error("Unexpected population dimensions")
  const category = data.dimension?.[areaCode]?.category
  const times = Object.keys(data.dimension?.timeperiod_y?.category?.index ?? {})
  const metrics = Object.keys(
    data.dimension?.contentscode?.category?.index ?? {}
  )
  if (
    times.length !== 1 ||
    times[0] !== String(year) ||
    metrics.length !== 1 ||
    metrics[0] !== "vaerak-vaesto"
  )
    throw new Error("Population year or measure mismatch")
  const indices = category?.index
  if (!indices || Object.keys(indices).length !== data.size[0])
    throw new Error("Incomplete population index")
  const values = new Map<string, number>()
  const used = new Set<number>()
  for (const [code, index] of Object.entries<number>(indices)) {
    const value = data.value?.[index]
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= data.size[0] ||
      used.has(index) ||
      !Number.isSafeInteger(value) ||
      value <= 0
    )
      throw new Error(`Missing or invalid population for ${code}`)
    used.add(index)
    values.set(code, value)
  }

  return values
}

export function buildGeography(source: FinlandSource): SourcePlace[] {
  const maps = source.classifications.map((rows) =>
    classificationMap(rows, source.boundaryDate, "maakunta")
  )
  if (maps.length !== 3)
    throw new Error("Expected Finnish, English and Swedish classifications")
  const [fi, en, sv] = maps
  const subregions = classificationMap(
    source.subregions,
    source.boundaryDate,
    "seutukunta"
  )
  for (const map of [...maps.slice(1), subregions]) {
    if (map.size !== fi.size || [...fi.keys()].some((key) => !map.has(key)))
      throw new Error("Classification coverage mismatch")
  }
  const values = populationValues(
    source.population,
    source.areaCode,
    source.year
  )
  const valueOf = (code: string) => {
    const value = values.get(code)
    if (value === undefined) throw new Error(`No population for ${code}`)

    return value
  }
  const populationMunicipalities = [...values.keys()].filter((code) =>
    code.startsWith("KU")
  )
  if (
    populationMunicipalities.length !== fi.size ||
    [...fi.keys()].some((code) => !values.has(`KU${code}`))
  )
    throw new Error(
      "Population and municipality classification cover different places"
    )
  const regions = new Map<string, SourcePlace>()
  const areas: SourcePlace[] = []
  for (const [code, item] of fi) {
    if (
      en.get(code)!.region !== item.region ||
      sv.get(code)!.region !== item.region
    )
      throw new Error(`Region changed across translations for ${code}`)
    const aland = item.region === "21"
    const country = aland ? "AX" : "FI"
    const regionCode = aland
      ? `SK${subregions.get(code)!.region}`
      : `MK${item.region}`
    if (aland && !/^SK21[123]$/.test(regionCode))
      throw new Error(`Unknown Åland subregion ${regionCode}`)
    const regionName = aland
      ? subregions.get(code)!.regionName
      : en.get(code)!.regionName
    const regionKey = `${country}:${regionCode}`
    regions.set(regionKey, {
      key: regionKey,
      level: "region",
      country,
      parent: country,
      code: regionCode,
      name: regionName,
      names: aland
        ? [regionName, ...(regionCode === "SK211" ? ["Mariehamn"] : [])]
        : maps.map((map) => map.get(code)!.regionName),
      slug: `${slugify(regionName)}-${country.toLowerCase()}-${regionCode.toLowerCase()}`,
      population: valueOf(regionCode),
      method: "direct",
    })
    const name = aland ? sv.get(code)!.name : item.name
    areas.push({
      key: `${country}:KU${code}`,
      level: "area",
      country,
      parent: regionKey,
      code: `KU${code}`,
      name,
      names: maps.flatMap((map) => {
        const official = map.get(code)!.name

        return [official, ...official.split(" - ")]
      }),
      slug: `${slugify(name)}-${country.toLowerCase()}-${code}`,
      population: valueOf(`KU${code}`),
      method: "direct",
    })
  }
  for (const region of regions.values()) {
    const sum = areas
      .filter((area) => area.parent === region.key)
      .reduce((total, area) => total + area.population, 0)
    if (sum !== region.population)
      throw new Error(`Municipality populations do not sum to ${region.code}`)
  }
  const mainland = [...regions.values()]
    .filter((region) => region.country === "FI")
    .reduce((total, region) => total + region.population, 0)
  const aland = [...regions.values()]
    .filter((region) => region.country === "AX")
    .reduce((total, region) => total + region.population, 0)
  if (aland !== valueOf("MK21") || mainland + aland !== valueOf("SSS"))
    throw new Error(
      "Regional populations do not reconcile with Finland and Åland totals"
    )

  return [
    {
      key: "FI",
      level: "country",
      country: "FI",
      code: "FIN-mainland",
      name: "Finland",
      names: ["Finland"],
      slug: "finland",
      population: mainland,
      method: "sum_complete_children",
      coverage: {
        scope: "mainland_finland",
        excludedCountryIso2: ["AX"],
        children: [...regions.values()]
          .filter((region) => region.country === "FI")
          .map((region) => region.code),
      },
    },
    {
      key: "AX",
      level: "country",
      country: "AX",
      code: "ALA",
      name: "Åland",
      names: ["Åland", "Aland", "Åland Islands"],
      slug: "aland",
      population: aland,
      method: "direct",
    },
    ...[...regions.values()].sort((a, b) => a.key.localeCompare(b.key)),
    ...areas.sort((a, b) => a.key.localeCompare(b.key)),
  ]
}

export function observationFor(place: SourcePlace, source: FinlandSource) {
  return {
    key: `statfin:${place.key}:${source.year}:${source.boundaryDate}`,
    level: place.level,
    iso2: place.country,
    name: place.name,
    reportingCode: place.code,
    population: place.population,
    year: source.year,
    source: "Statistics Finland, population structure (11ra)",
    sourceUrl: POPULATION_URL,
    licence: "CC BY 4.0",
    retrievedAt: source.retrievedAt,
    method: place.method,
    boundaryVersion: `statfin-${source.boundaryDate}`,
    ...(place.coverage ? { coverage: place.coverage } : {}),
  }
}

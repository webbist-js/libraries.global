import { NORDICS, SCB_URL, SSB_URL, type NordicSource } from "./source"
import type { SourcePlace } from "../_shared/geography"
import { slugify } from "../_shared/text"

/** JSON-stat1 (Denmark) and JSON-stat2; Region must be first and every cell present. */
export function populationTotals(
  input: any,
  expected: Record<string, string[] | null>
) {
  const data = input.dataset
    ? {
        ...input.dataset,
        id: input.dataset.dimension.id,
        size: input.dataset.dimension.size,
      }
    : input
  const dimensions = Object.keys(expected)
  if (
    JSON.stringify(data.id) !== JSON.stringify(dimensions) ||
    data.size.length !== dimensions.length
  )
    throw new Error("Unexpected population dimensions")
  const codes: string[][] = []
  for (const [i, dimension] of dimensions.entries()) {
    const index = data.dimension[dimension]?.category?.index
    if (!index || Object.keys(index).length !== data.size[i])
      throw new Error("Incomplete population dimension")
    const ordered = Object.keys(index).sort((a, b) => index[a] - index[b])
    if (ordered.some((code, position) => index[code] !== position))
      throw new Error("Invalid population indices")
    const selected = expected[dimension]
    if (
      selected &&
      (ordered.length !== selected.length ||
        selected.some((code) => !ordered.includes(code)))
    )
      throw new Error(`Wrong population selection: ${dimension}`)
    codes.push(ordered)
  }
  const cellsPerRegion = data.size
    .slice(1)
    .reduce((a: number, b: number) => a * b, 1)
  const cellCount = data.size[0] * cellsPerRegion
  if (Object.keys(data.value).length !== cellCount)
    throw new Error("Incomplete population cells")
  const totals = new Map<string, number>()
  for (let r = 0; r < codes[0].length; r++) {
    let total = 0
    for (let c = 0; c < cellsPerRegion; c++) {
      const value = data.value[r * cellsPerRegion + c]
      if (!Number.isSafeInteger(value) || value < 0)
        throw new Error("Suppressed or invalid population cell")
      total += value
    }
    if (!Number.isSafeInteger(total) || total <= 0)
      throw new Error(`Invalid population total ${codes[0][r]}`)
    totals.set(codes[0][r], total)
  }

  return {
    totals,
    labels: data.dimension[dimensions[0]].category.label as Record<
      string,
      string
    >,
    note: data.note as string[] | undefined,
  }
}

export function buildNordicGeography(source: NordicSource) {
  const country = source.country
  const config = NORDICS[country]
  const selections =
    country === "SE"
      ? {
          Region: null,
          Civilstand: ["SC"],
          Alder: ["TotSA"],
          Kon: ["TotSa"],
          ContentsCode: ["000007ME"],
          Tid: ["2025"],
        }
      : country === "NO"
        ? {
            Region: null,
            Kjonn: ["1", "2"],
            Alder: [
              ...Array.from({ length: 105 }, (_, i) =>
                String(i).padStart(3, "0")
              ),
              "105+",
            ],
            ContentsCode: ["Personer1"],
            Tid: ["2026"],
          }
        : {
            OMRÅDE: null,
            KØN: ["TOT"],
            ALDER: ["IALT"],
            CIVILSTAND: ["TOT"],
            ContentsCode: ["FOLK1A"],
            Tid: ["2026K1"],
          }
  const values = populationTotals(source.population, selections)
  const places: SourcePlace[] = []
  const key = (level: string, code: string) => `${country}:${level}:${code}`
  function add(
    level: SourcePlace["level"],
    code: string,
    name: string,
    parent?: string,
    names: string[] = [],
    typeLabel?: string
  ) {
    const population = values.totals.get(code)
    if (
      !population ||
      !name ||
      places.some((p) => p.level === level && p.code === code)
    )
      throw new Error(`Missing or duplicate place ${country} ${code}`)
    places.push({
      key: level === "country" ? country : key(level, code),
      level,
      country,
      code,
      name,
      names: [...new Set([name, ...names])],
      slug:
        level === "country"
          ? slugify(name)
          : `${slugify(name)}-${country.toLowerCase()}-${code}`,
      parent,
      population,
      method: "direct",
      ...(typeLabel ? { typeLabel } : {}),
    })
  }
  const countryCode = country === "SE" ? "00" : country === "NO" ? "0" : "000"
  add("country", countryCode, config.name)
  if (country === "SE") {
    for (const [code] of values.totals)
      if (code.length === 2 && code !== "00") {
        const label = values.labels[code]
        add("region", code, label.replace(/ county$/i, ""), country, [label])
      }
    for (const [code] of values.totals)
      if (/^\d{4}$/.test(code)) {
        const name = values.labels[code]
        const aliases = source
          .hierarchy!.filter((row) => row.code.value === code)
          .map((row) => row.areaLabel.value)
        add("area", code, name, key("region", code.slice(0, 2)), [
          ...aliases,
          `${name} Kommun`,
          `${name}s Kommun`,
          `${name}s stad`,
        ])
      }
  } else if (country === "NO") {
    for (const row of source.counties.codes.filter(
      (c: any) => c.code !== "99"
    )) {
      if (!/^\d{2}$/.test(row.code))
        throw new Error("Invalid Norwegian county classification")
      const names = row.name.split(" - ")
      add("region", row.code, names[0], country, [
        row.name,
        ...names,
        ...(row.code === "31" ? ["Ãstfold"] : []),
      ])
    }
    for (const row of source.municipalities.codes.filter(
      (c: any) => c.code !== "9999"
    )) {
      if (!/^\d{4}$/.test(row.code))
        throw new Error("Invalid Norwegian municipality classification")
      const names = row.name.split(" - ")
      add("area", row.code, names[0], key("region", row.code.slice(0, 2)), [
        row.name,
        ...names,
        values.labels[row.code],
        names[0].replace(/ \([^)]*\)$/, ""),
        `${names[0]} kommune`,
      ])
    }
  } else {
    for (const [code] of values.totals)
      if (/^08[1-5]$/.test(code))
        add(
          "region",
          code,
          values.labels[code].replace(/^Region /, ""),
          country,
          [values.labels[code]]
        )
    const areas = new Map<string, string>()
    for (const row of source.hierarchy!) {
      const code = row.code?.value,
        region = row.regionCode?.value
      if (
        !/^\d{3}$/.test(code) ||
        !/^DK-8[1-5]$/.test(region) ||
        areas.has(code)
      )
        throw new Error(`Ambiguous Danish municipality ${code}`)
      areas.set(code, `0${region.slice(3)}`)
    }
    if (areas.size !== 98)
      throw new Error("Danish hierarchy must contain 98 municipalities")
    const seedAliases: Record<string, string[]> = {
      "101": ["København"],
      "173": ["Lyngby-Tårbæk Kommune"],
      "159": ["Gladsaxe Municipality"],
      "851": ["Ålborg Kommune"],
      "820": ["Vesthimmerland Kommune"],
    }
    for (const [code, parent] of areas)
      add("area", code, values.labels[code], key("region", parent), [
        source.hierarchy!.find((row) => row.code.value === code)!.areaLabel
          .value,
        `${values.labels[code]} Kommune`,
        ...(seedAliases[code] ?? []),
      ])
    // FOLK1A reports Christiansø under Hovedstaden, outside the 98 municipalities.
    add(
      "area",
      "411",
      values.labels["411"],
      key("region", "084"),
      [],
      "Administrative area"
    )
  }
  const expectedCounts =
    country === "SE" ? [21, 290] : country === "NO" ? [15, 357] : [5, 99]
  if (
    places.filter((p) => p.level === "region").length !== expectedCounts[0] ||
    places.filter((p) => p.level === "area").length !== expectedCounts[1] ||
    places.length !== values.totals.size
  )
    throw new Error("Incomplete or unexpected Nordic geography")
  for (const place of places.filter((p) => p.parent))
    if (
      !places.some(
        (p) =>
          p.key === place.parent &&
          p.country === place.country &&
          p.level === (place.level === "area" ? "region" : "country")
      )
    )
      throw new Error(`Invalid parent ${place.key}`)
  const discrepancies: {
    place: string
    published: number
    childSum: number
    difference: number
  }[] = []
  for (const place of places.filter((p) => p.level !== "area")) {
    const childSum = places
      .filter((p) => p.parent === place.key)
      .reduce((sum, p) => sum + p.population, 0)
    if (childSum !== place.population)
      discrepancies.push({
        place: place.key,
        published: place.population,
        childSum,
        difference: childSum - place.population,
      })
  }
  if (
    discrepancies.length &&
    (country !== "SE" ||
      !values.note?.some((note) => /controlled random uncertainty/.test(note)))
  )
    throw new Error(
      `Population does not reconcile: ${JSON.stringify(discrepancies)}`
    )
  if (country === "SE")
    for (const place of places)
      place.coverage = {
        disclosureControl: "SCB Cell Key Method (CKM)",
        totalsMayDifferFromComponentSums: true,
      }
  if (country === "NO")
    for (const place of places)
      place.coverage = {
        calculation:
          "Sum of all 106 disjoint age categories for both sexes in SSB table 07459",
        referenceDate: "2026-01-01",
      }

  return { places, discrepancies }
}

export function nordicObservation(place: SourcePlace, source: NordicSource) {
  const config = NORDICS[source.country]

  return {
    key: `${config.populationDataset}:${place.key}:${config.year}:${config.boundaryDate}`,
    level: place.level,
    reportingCode: place.level === "country" ? config.iso3 : place.code,
    parentReportingCode: place.parent
      ? place.parent.split(":").at(-1)
      : undefined,
    population: place.population,
    year: config.year,
    boundaryVersion: config.boundaryDate,
    source:
      source.country === "SE"
        ? "Statistics Sweden"
        : source.country === "NO"
          ? "Statistics Norway"
          : "Statistics Denmark",
    sourceUrl:
      source.country === "SE"
        ? SCB_URL
        : source.country === "NO"
          ? SSB_URL
          : "https://www.statbank.dk/FOLK1A",
    licence: source.country === "SE" ? "CC0 1.0" : "CC BY 4.0",
    retrievedAt: source.populationRetrievedAt,
    method: place.method,
    coverage: {
      ...place.coverage,
      ...(source.country === "SE"
        ? { referenceDate: "2025-12-31" }
        : { referenceDate: "2026-01-01" }),
      ...(place.code === "411" && source.country === "DK"
        ? {
            administrativeStatus:
              "Christiansø is outside the 98 municipalities; statistical reporting area in Hovedstaden",
          }
        : {}),
    },
  }
}

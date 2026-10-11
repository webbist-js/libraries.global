import type { JsonSources } from "../_shared/json-source"

export const NORDICS = {
  SE: {
    name: "Sweden",
    iso3: "SWE",
    entity: "Q34",
    property: "P525",
    language: "sv",
    timezone: "Europe/Stockholm",
    populationDataset: "scb-population",
    year: 2025,
    boundaryDate: "2025-01-01",
    regionType: "County",
  },
  NO: {
    name: "Norway",
    iso3: "NOR",
    entity: "Q20",
    property: "P2504",
    language: "nb,nn",
    timezone: "Europe/Oslo",
    populationDataset: "ssb-population",
    year: 2026,
    boundaryDate: "2026-01-01",
    regionType: "County",
  },
  DK: {
    name: "Denmark",
    iso3: "DNK",
    entity: "Q35",
    property: "P1168",
    language: "da",
    timezone: "Europe/Copenhagen",
    populationDataset: "dst-population",
    year: 2026,
    boundaryDate: "2026-01-01",
    regionType: "Region",
  },
} as const
export type NordicCountry = keyof typeof NORDICS
export type Binding = Record<string, { value: string; "xml:lang"?: string }>
export const SCB_URL =
  "https://api.scb.se/OV0104/v1/doris/en/ssd/START/BE/BE0101/BE0101A/BefolkningCKM"
export const SSB_URL = "https://data.ssb.no/api/v0/en/table/07459"
export const DST_URL = "https://api.statbank.dk/v1/data"
export const CLASSIFICATION_URL = (classification: number) =>
  `https://data.ssb.no/api/klass/v1/classifications/${classification}/codesAt?date=2026-01-01`
export const DST_METADATA_URL =
  "https://api.statbank.dk/v1/tableinfo/FOLK1A?format=JSON&lang=en"
export const sparqlUrl = (query: string) =>
  `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`

export function libraryQuery(country: NordicCountry) {
  const c = NORDICS[country]

  return `SELECT ?library ?libraryLabel ?coord ?website ?address ?areaCode ?kind WHERE { ?library wdt:P17 wd:${c.entity}; wdt:P31/wdt:P279* wd:Q7075. FILTER NOT EXISTS { ?library wdt:P576 ?end } FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q212805 } FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q28324850 } OPTIONAL { ?library wdt:P625 ?coord } OPTIONAL { ?library wdt:P856 ?website } OPTIONAL { ?library wdt:P6375 ?address } OPTIONAL { ?library wdt:P131* ?area. ?area wdt:${c.property} ?areaCode } OPTIONAL { VALUES ?kind { wd:Q28564 wd:Q1622062 wd:Q856234 wd:Q22806 wd:Q385994 wd:Q1438040 } ?library wdt:P31/wdt:P279* ?kind } SERVICE wikibase:label { bd:serviceParam wikibase:language "${c.language},en" } }`
}

export const DANISH_HIERARCHY_QUERY =
  'SELECT ?area ?areaLabel ?code ?regionCode WHERE { ?area wdt:P17 wd:Q35; wdt:P1168 ?code; wdt:P131/wdt:P300 ?regionCode. FILTER(?regionCode IN ("DK-81","DK-82","DK-83","DK-84","DK-85")) FILTER NOT EXISTS{?area wdt:P576 ?end} SERVICE wikibase:label{bd:serviceParam wikibase:language "da,en"} }'
export const SWEDISH_ALIASES_QUERY =
  'SELECT ?area ?areaLabel ?code WHERE { ?area wdt:P17 wd:Q34; wdt:P525 ?code. FILTER NOT EXISTS{?area wdt:P576 ?end} SERVICE wikibase:label{bd:serviceParam wikibase:language "sv,en"} }'
export function libraryIdentifiersQuery(country: NordicCountry) {
  return `SELECT DISTINCT ?library WHERE { ?library wdt:P17 wd:${NORDICS[country].entity}; wdt:P31/wdt:P279* wd:Q7075. FILTER NOT EXISTS { ?library wdt:P576 ?end } FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q212805 } FILTER NOT EXISTS { ?library wdt:P31/wdt:P279* wd:Q28324850 } } ORDER BY ?library`
}

export function mobileQuery(country: NordicCountry) {
  return `SELECT DISTINCT ?library WHERE { ?library wdt:P17 wd:${NORDICS[country].entity}; wdt:P31/wdt:P279* wd:Q720920. FILTER NOT EXISTS { ?library wdt:P576 ?end } }`
}

export function classifyMobileLibraries(
  rows: Binding[],
  mobileRows: Binding[]
) {
  const entityId = (value: string) =>
    value.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/)?.[1]
  const mobileIds = new Set(
    mobileRows.map((row) => entityId(row.library?.value ?? ""))
  )
  if (mobileIds.has(undefined))
    throw new Error("Invalid mobile library identifier")

  return rows.flatMap((row) =>
    mobileIds.has(entityId(row.library.value))
      ? [
          row,
          { ...row, kind: { value: "http://www.wikidata.org/entity/Q720920" } },
        ]
      : [row]
  )
}

export function scbQuery(metadata: any) {
  const selections: Record<string, string[]> = {
    Region: metadata.variables.find((v: any) => v.code === "Region").values,
    Civilstand: ["SC"],
    Alder: ["TotSA"],
    Kon: ["TotSa"],
    ContentsCode: ["000007ME"],
    Tid: ["2025"],
  }

  return pxQuery(metadata, selections)
}

export function ssbQuery(metadata: any, counties: any, municipalities: any) {
  const regions = [
    "0",
    ...counties.codes
      .filter((c: any) => c.code !== "99")
      .map((c: any) => c.code),
    ...municipalities.codes
      .filter((c: any) => c.code !== "9999")
      .map((c: any) => c.code),
  ]
  const variable = (code: string) =>
    metadata.variables.find((v: any) => v.code === code).values

  return pxQuery(metadata, {
    Region: regions,
    Kjonn: variable("Kjonn"),
    Alder: variable("Alder"),
    ContentsCode: ["Personer1"],
    Tid: ["2026"],
  })
}

function pxQuery(metadata: any, selections: Record<string, string[]>) {
  if (
    JSON.stringify(metadata.variables.map((v: any) => v.code)) !==
    JSON.stringify(Object.keys(selections))
  )
    throw new Error("Population metadata dimensions changed")

  return {
    query: metadata.variables.map((v: any) => {
      const values = selections[v.code]
      if (!values.length || values.some((value) => !v.values.includes(value)))
        throw new Error(`Population selection is unavailable: ${v.code}`)

      return { code: v.code, selection: { filter: "item", values } }
    }),
    response: { format: "json-stat2" },
  }
}

export function dstQuery(metadata: any) {
  const selections: Record<string, string[]> = {
    OMRÅDE: metadata.variables
      .find((v: any) => v.id === "OMRÅDE")
      .values.map((v: any) => v.id),
    KØN: ["TOT"],
    ALDER: ["IALT"],
    CIVILSTAND: ["TOT"],
    Tid: ["2026K1"],
  }
  if (
    JSON.stringify(metadata.variables.map((v: any) => v.id)) !==
    JSON.stringify(Object.keys(selections))
  )
    throw new Error("Danish population dimensions changed")

  return {
    table: "FOLK1A",
    format: "JSONSTAT",
    lang: "en",
    valuePresentation: "Code",
    variables: metadata.variables.map((v: any) => {
      const values = selections[v.id]
      if (
        values.some(
          (value) => !v.values.some((candidate: any) => candidate.id === value)
        )
      )
        throw new Error(`Danish selection is unavailable: ${v.id}`)

      return { code: v.id, values }
    }),
  }
}

export async function loadNordic(sources: JsonSources, country: NordicCountry) {
  let counties: any, municipalities: any, hierarchy: Binding[] | undefined
  let metadata: any, population: any, populationRetrievedAt: string
  if (country === "SE") {
    metadata = (await sources.read("population-metadata", SCB_URL)).data
    const result = await sources.read("population", SCB_URL, scbQuery(metadata))
    population = result.data
    populationRetrievedAt = result.retrievedAt
    hierarchy = bindings(
      (
        await sources.read(
          "municipality-aliases",
          sparqlUrl(SWEDISH_ALIASES_QUERY)
        )
      ).data
    )
  } else if (country === "NO") {
    counties = (await sources.read("counties", CLASSIFICATION_URL(104))).data
    municipalities = (
      await sources.read("municipalities", CLASSIFICATION_URL(131))
    ).data
    metadata = (await sources.read("population-metadata", SSB_URL)).data
    const result = await sources.read(
      "population",
      SSB_URL,
      ssbQuery(metadata, counties, municipalities)
    )
    population = result.data
    populationRetrievedAt = result.retrievedAt
  } else {
    metadata = (await sources.read("population-metadata", DST_METADATA_URL))
      .data
    hierarchy = bindings(
      (
        await sources.read(
          "municipal-hierarchy",
          sparqlUrl(DANISH_HIERARCHY_QUERY)
        )
      ).data
    )
    const result = await sources.read("population", DST_URL, dstQuery(metadata))
    population = result.data
    populationRetrievedAt = result.retrievedAt
  }
  let query = libraryQuery(country)
  let expectedIds: string[] | undefined
  if (country === "NO") {
    const identifiers = bindings(
      (
        await sources.read(
          "library-identifiers",
          sparqlUrl(libraryIdentifiersQuery(country))
        )
      ).data
    )
    expectedIds = identifiers.map((row) => {
      const id = row.library?.value.match(
        /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/
      )?.[1]
      if (!id) throw new Error("Invalid Norwegian library identifier")

      return id
    })
    if (
      expectedIds.some((id) => !id) ||
      new Set(expectedIds).size !== expectedIds.length
    )
      throw new Error("Invalid or duplicate Norwegian library identifiers")
    // Bind the small Norwegian set first, avoiding a global optional property-path traversal.
    query = query.replace(
      "WHERE {",
      `WHERE { VALUES ?library { ${expectedIds.map((id) => `wd:${id}`).join(" ")} }`
    )
  }
  const libraries = await sources.read("libraries", sparqlUrl(query))
  if (expectedIds) {
    const actual = new Set(
      bindings(libraries.data).map((row) => row.library.value.split("/").at(-1))
    )
    if (
      actual.size !== expectedIds.length ||
      expectedIds.some((id) => !actual.has(id))
    )
      throw new Error("Incomplete Norwegian library detail snapshot")
  }

  const mobileLibraries = await sources.read(
    "mobile-libraries",
    sparqlUrl(mobileQuery(country))
  )

  return {
    country,
    metadata,
    population,
    populationRetrievedAt,
    counties,
    municipalities,
    hierarchy,
    libraries: classifyMobileLibraries(
      bindings(libraries.data),
      bindings(mobileLibraries.data, true)
    ),
    libraryRetrievedAt: libraries.retrievedAt,
  }
}

export function bindings(response: any, allowEmpty = false): Binding[] {
  if (
    !Array.isArray(response.results?.bindings) ||
    (!allowEmpty && !response.results.bindings.length)
  )
    throw new Error("Empty or invalid Wikidata result")

  return response.results.bindings
}
export type NordicSource = Awaited<ReturnType<typeof loadNordic>>

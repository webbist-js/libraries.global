import { type JsonSources, libraryDirectory } from "../../_shared/json-source"

export const DATASET_KEY = "kirjastot-fi"
export const POPULATION_DATASET = "statfin-population"
export const DIRECTORY_URL =
  "https://api.kirjastot.fi/v4/library?langcode=fi&with=primaryContactInfo&refs=city"
export const POPULATION_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11ra.px"
const CLASSIFICATIONS_URL =
  "https://api.stat.fi/classificationservice/open/api/classifications/v2/correspondenceTables/"

export function classificationUrl(
  date: string,
  target: "maakunta" | "seutukunta",
  language: string
) {
  return `${CLASSIFICATIONS_URL}kunta_1_${date}%23${target}_1_${date}/maps?content=data&format=json&lang=${language}&meta=min`
}

export function populationQuery(metadata: any, year: number) {
  const area = metadata.variables?.find((v: any) =>
    /^alue_.*_\d{8}$/.test(v.code)
  )
  const date = area?.code.match(/(\d{8})$/)?.[1]
  const time = metadata.variables?.find((v: any) => v.code === "timeperiod_y")
  if (!date || !time?.values.includes(String(year)))
    throw new Error(
      `Population table has no supported geography or year ${year}`
    )
  const values = area.values.filter(
    (code: string) => code === "SSS" || /^(KU\d{3}|MK\d{2}|SK21\d)$/.test(code)
  )

  return {
    date,
    areaCode: area.code,
    body: {
      query: [
        { code: area.code, selection: { filter: "item", values } },
        {
          code: "contentscode",
          selection: { filter: "item", values: ["vaerak-vaesto"] },
        },
        {
          code: "timeperiod_y",
          selection: { filter: "item", values: [String(year)] },
        },
      ],
      response: { format: "json-stat2" },
    },
  }
}

export async function loadFinland(sources: JsonSources, year: number) {
  const metadata = await sources.read<any>(
    "population-metadata",
    POPULATION_URL
  )
  const query = populationQuery(metadata.data, year)
  const classifications: any[][] = []
  for (const language of ["fi", "en", "sv"]) {
    const snapshot = await sources.read<any[]>(
      `municipalities-${query.date}-${language}`,
      classificationUrl(query.date, "maakunta", language)
    )
    classifications.push(snapshot.data)
  }
  const subregions = await sources.read<any[]>(
    `subregions-${query.date}-sv`,
    classificationUrl(query.date, "seutukunta", "sv")
  )
  const population = await sources.read<any>(
    `population-${year}-${query.date}`,
    POPULATION_URL,
    query.body
  )
  const directory = await sources.read<any>(
    "libraries-fi",
    DIRECTORY_URL,
    undefined,
    () => libraryDirectory(DIRECTORY_URL)
  )

  return {
    classifications,
    subregions: subregions.data,
    population: population.data,
    directory: directory.data,
    year,
    boundaryDate: query.date,
    areaCode: query.areaCode,
    retrievedAt: population.retrievedAt,
    libraryRetrievedAt: directory.retrievedAt,
  }
}

export type FinlandSource = Awaited<ReturnType<typeof loadFinland>>

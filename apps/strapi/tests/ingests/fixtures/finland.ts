import type { FinlandSource } from "../../../scripts/ingests/finland/kirjastot-fi/source"

const municipalities = [
  { code: "091", region: "01", name: "Helsinki", subregion: "011" },
  { code: "698", region: "19", name: "Rovaniemi", subregion: "191" },
  { code: "478", region: "21", name: "Mariehamn", subregion: "211" },
  { code: "170", region: "21", name: "Jomala", subregion: "212" },
]
const regionNames = {
  "01": ["Uusimaa", "Uusimaa", "Nyland"],
  "19": ["Lappi", "Lapland", "Lappland"],
  "21": ["Ahvenanmaa", "Åland", "Åland"],
}
const item = (classification: string, code: string, name: string) => ({
  code,
  localId: `${classification}_1_20260101/${code}`,
  classificationItemNames: [{ name }],
})

export function finlandFixture(): FinlandSource {
  const counts = {
    SSS: 1100,
    KU091: 800,
    KU698: 200,
    KU478: 60,
    KU170: 40,
    MK01: 800,
    MK19: 200,
    MK21: 100,
    SK211: 60,
    SK212: 40,
  }
  const codes = Object.keys(counts)

  return {
    classifications: [0, 1, 2].map((language) =>
      municipalities.map((municipality) => ({
        sourceItem: item(
          "kunta",
          municipality.code,
          language === 0 && municipality.code === "478"
            ? "Maarianhamina - Mariehamn"
            : municipality.name
        ),
        targetItem: item(
          "maakunta",
          municipality.region,
          regionNames[municipality.region][language]
        ),
      }))
    ),
    subregions: municipalities.map((municipality) => ({
      sourceItem: item("kunta", municipality.code, municipality.name),
      targetItem: item(
        "seutukunta",
        municipality.subregion,
        {
          "011": "Helsinki",
          "191": "Rovaniemi",
          "211": "Mariehamns stad",
          "212": "Ålands landsbygd",
        }[municipality.subregion]
      ),
    })),
    population: {
      version: "2.0",
      class: "dataset",
      id: ["alue_23_20260101", "contentscode", "timeperiod_y"],
      size: [codes.length, 1, 1],
      dimension: {
        alue_23_20260101: {
          category: {
            index: Object.fromEntries(
              codes.map((code, index) => [code, index])
            ),
          },
        },
        contentscode: { category: { index: { "vaerak-vaesto": 0 } } },
        timeperiod_y: { category: { index: { "2025": 0 } } },
      },
      value: Object.values(counts),
    },
    directory: { items: [], cities: {}, total: 0 },
    year: 2025,
    boundaryDate: "20260101",
    areaCode: "alue_23_20260101",
    retrievedAt: "2026-10-11T12:00:00Z",
    libraryRetrievedAt: "2026-10-11T12:00:00Z",
  }
}

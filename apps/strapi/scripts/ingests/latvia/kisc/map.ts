import {
  array,
  columns,
  object,
  sourceString,
} from "../../_shared/expansion-contract"
import { candidate, syntheticId } from "../../_shared/expansion-map"

export function mapLatvia(raw: unknown) {
  return array(raw).flatMap((value) => {
    const row = object(value)
    columns(row, [
      "Nozare",
      "Objekta nosaukums",
      "ISIL kods",
      "Adrese",
      "LAT",
      "LON",
      "Objekta veids",
      "Objekta URL",
    ])
    if (sourceString(row.Nozare).trim() !== "Bibliotēkas") return []
    const kind = sourceString(row["Objekta veids"])
    const type = kind.startsWith("Latvijas Nacionālā")
      ? "National"
      : kind.startsWith("Publiskā bibliotēka")
        ? "Public"
        : kind.startsWith("Augstākās izglītības")
          ? "Academic"
          : kind.startsWith("Vispārējās un profesionālās")
            ? "Other"
            : kind.startsWith("Speciālā")
              ? "Special"
              : "Other"
    const isil = sourceString(row["ISIL kods"]).trim()
    if (isil && !/^LV-[\w-]+$/.test(isil))
      throw new Error("Invalid Latvian ISIL")

    return [
      candidate(
        isil || syntheticId([row["Objekta nosaukums"], row.Adrese]),
        row["Objekta nosaukums"],
        "https://data.gov.lv/dati/dataset/latvijas-kulturas-institucijas",
        {
          type,
          address: row.Adrese,
          phone: row["Tālrunis"],
          website: row["Objekta URL"],
          area: row["Adreses ATVK kods"],
          lat: row.LAT,
          lon: row.LON,
          bounds: [55.6, 58.2, 20.8, 28.3],
        }
      ),
    ]
  })
}

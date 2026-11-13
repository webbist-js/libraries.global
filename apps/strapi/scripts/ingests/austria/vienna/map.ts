import { columns } from "../../_shared/expansion-contract"
import {
  candidate,
  geoFeatures,
  syntheticId,
} from "../../_shared/expansion-map"

export function mapVienna(raw: unknown) {
  return geoFeatures(raw).map((feature) => {
    const row = feature.properties
    columns(row, ["NAME", "ADRESSE", "WEBLINK1", "BEZIRK"])
    if (!/^BUECHEREIOGD\.\d+$/.test(String(feature.id ?? "")))
      throw new Error("Missing Vienna feature identity")

    return candidate(
      syntheticId([row.NAME, row.ADRESSE]),
      row.NAME,
      "https://www.data.gv.at/datasets/2adc5a86-faa3-4b63-acff-a66128b811b7",
      {
        type: "Public",
        region: "Vienna",
        area: String(row.BEZIRK),
        city: "Wien",
        address: row.ADRESSE,
        phone: row.TELEFON,
        website: row.WEBLINK1,
        lat: feature.geometry?.coordinates[1],
        lon: feature.geometry?.coordinates[0],
        bounds: [48.1, 48.4, 16.1, 16.7],
      }
    )
  })
}

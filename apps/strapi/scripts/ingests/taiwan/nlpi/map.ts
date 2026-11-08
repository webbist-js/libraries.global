import { array, columns, object } from "../../_shared/expansion-contract"
import { candidate, syntheticId } from "../../_shared/expansion-map"

export function mapTaiwan(raw: unknown) {
  return array(raw).flatMap((value) => {
    const group = object(value)
    columns(group, ["縣市", "圖書館資訊"])

    return array(group["圖書館資訊"]).map((value) => {
      const row = object(value)
      columns(row, [
        "Name",
        "Address",
        "ZipCode",
        "Longitude",
        "Latitude",
        "URL",
      ])

      return candidate(
        syntheticId([group["縣市"], row.Name, row.Address]),
        row.Name,
        "https://data.gov.tw/dataset/99567",
        {
          type: "Public",
          region: group["縣市"],
          area: row.Area,
          address: row.Address,
          postcode: row.ZipCode,
          phone: row.TEL,
          website: row.URL,
          lat: row.Latitude,
          lon: row.Longitude,
          bounds: [20, 27, 118, 123],
        }
      )
    })
  })
}

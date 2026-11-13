import { array, at, columns, object } from "../../_shared/expansion-contract"
import { candidate, syntheticId } from "../../_shared/expansion-map"

export function mapGraz(raw: unknown) {
  const root = object(raw)
  if (root.error || root.exceededTransferLimit)
    throw new Error("Incomplete Graz ArcGIS export")
  if (
    (at(root.spatialReference, "latestWkid") ??
      at(root.spatialReference, "wkid")) !== 4326
  )
    throw new Error("Graz export must request outSR=4326")

  return array(root.features).map((feature) => {
    const row = object(at(feature, "attributes"))
    columns(row, ["NAME", "STRASSENNAME", "HAUSNR", "PLZ", "ORT"])
    const address = [row.STRASSENNAME, row.HAUSNR].filter(Boolean).join(" ")

    // OBJEKT_ID is an ArcGIS OID: it can change when the publisher rebuilds the layer.
    return candidate(
      syntheticId([row.NAME, address, row.PLZ]),
      row.NAME,
      "https://www.data.gv.at/datasets/4904b8e4-a002-4bcd-bda3-d496eab8fda4",
      {
        type: "Other",
        region: "Styria",
        area: "Graz",
        city: row.ORT,
        address,
        postcode: row.PLZ,
        lat: at(feature, "geometry", "y"),
        lon: at(feature, "geometry", "x"),
        bounds: [46.9, 47.2, 15.2, 15.7],
      }
    )
  })
}

import {
  candidate,
  geoFeatures,
  nlbAttributes,
  syntheticId,
} from "../../_shared/expansion-map"

export function mapSingapore(raw: unknown) {
  return geoFeatures(raw).map((feature) => {
    const row = nlbAttributes(feature.properties.Description)
    const address = [
      row.ADDRESSBLOCKHOUSENUMBER,
      row.ADDRESSSTREETNAME,
      row.ADDRESSBUILDINGNAME,
      row.ADDRESSFLOORNUMBER ? `Level ${row.ADDRESSFLOORNUMBER}` : "",
    ]
      .filter(Boolean)
      .join(" ")

    // GeoJSON Name often identifies a map feature rather than a durable NLB branch.
    return candidate(
      syntheticId([row.NAME, address]),
      row.NAME,
      "https://data.gov.sg/datasets/d_27b8dae65d9ca1539e14d09578b17cbf/view",
      {
        type: "Other",
        region: "Singapore",
        address,
        postcode: row.ADDRESSPOSTALCODE,
        website: row.HYPERLINK,
        lat: feature.geometry?.coordinates[1],
        lon: feature.geometry?.coordinates[0],
        bounds: [1.1, 1.5, 103.5, 104.2],
      }
    )
  })
}

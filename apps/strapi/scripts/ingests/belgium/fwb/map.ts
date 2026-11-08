import { array, columns, object } from "../../_shared/expansion-contract"
import { candidate, syntheticId } from "../../_shared/expansion-map"

export function mapBelgium(raw: unknown) {
  // Require the full exports/json array, never a single /records page.
  return array(raw).map((value) => {
    const row = object(value)
    columns(row, [
      "denomination",
      "province",
      "adresse",
      "cp",
      "ville",
      "categorie",
      "geolocalisation",
    ])
    const result = candidate(
      syntheticId([row.denomination, row.adresse, row.cp, row.ville]),
      row.denomination,
      "https://www.odwb.be/explore/dataset/les-bibliotheques-publiques-en-federation-wallonie-bruxelles/",
      {
        type: "Other",
        region: row.province,
        area: row.ville,
        city: row.ville,
        address: row.adresse,
        postcode: row.cp,
        phone: row.telephone,
        website: row.web,
        lat: row.geolocalisation?.lat,
        lon: row.geolocalisation?.lon,
        bounds: [49.4, 51.6, 2.4, 6.5],
      }
    )
    result.warnings.push(
      `Source category: ${row.categorie}; distinguish branches, support operators and mobile services`
    )

    return result
  })
}

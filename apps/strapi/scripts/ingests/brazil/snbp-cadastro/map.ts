import { array, columns, object } from "../../_shared/expansion-contract"
import { candidate, syntheticId } from "../../_shared/expansion-map"

export function mapBrazil(raw: unknown) {
  return array(raw).map((value) => {
    const row = object(value)
    columns(row, [
      "NOME DA BIBLIOTECA",
      "UF",
      "NOME MUNICIPIO",
      "ENDEREÇO",
      "CEP",
      "TIPO BIBLIOTECA",
    ])
    if (
      !["PÚBLICA", "COMUNITÁRIA"].includes(
        String(row["TIPO BIBLIOTECA"]).trim().toUpperCase()
      )
    )
      throw new Error("Unsupported SNBP library category")
    const result = candidate(
      `2025-2026:${syntheticId([row.UF, row["NOME MUNICIPIO"], row["NOME DA BIBLIOTECA"], row["ENDEREÇO"]])}`,
      row["NOME DA BIBLIOTECA"],
      "https://dados.cultura.gov.br/dataset/sistema-nacional-de-bibliotecas-publicas-snbp",
      {
        type: "Public",
        region: row.UF,
        area: row["NOME MUNICIPIO"],
        city: row["NOME MUNICIPIO"],
        address: row["ENDEREÇO"],
        postcode: /^\d{5}-?\d{3}$/.test(String(row.CEP).trim())
          ? String(row.CEP).replace(/^(\d{5})-?(\d{3})$/, "$1-$2")
          : undefined,
      }
    )
    result.warnings.push(
      `Source type: ${row["TIPO BIBLIOTECA"]}; affiliation: ${row.VINCULO ?? "unknown"}; no source coordinates`
    )

    return result
  })
}

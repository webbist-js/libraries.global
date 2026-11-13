import {
  array,
  columns,
  object,
  sourceString,
} from "../../_shared/expansion-contract"
import { candidate } from "../../_shared/expansion-map"

export function mapKenya(raw: unknown) {
  return array(raw).flatMap((value) => {
    const row = object(value)
    const field = (prefix: string) => {
      const keys = Object.keys(row).filter((key) => key.startsWith(prefix))
      if (keys.length !== 1)
        throw new Error(`Missing or ambiguous ALVA header ${prefix}`)

      return row[keys[0]]
    }
    columns(row, ["OBJECTID"])
    if (sourceString(field("Country / ")).trim() !== "Kenya") return []
    if (!/^\d+$/.test(String(row.OBJECTID)))
      throw new Error("Invalid ALVA OBJECTID")
    const address = field("Street Address / ")
    const result = candidate(
      String(row.OBJECTID),
      field("Name of Library / "),
      "https://osf.io/entpf/",
      {
        type: "Other",
        address: /p\.?\s*o\.?\s*box/i.test(sourceString(address))
          ? undefined
          : address,
        city: field("Name of community or town / "),
      }
    )
    result.warnings.push(
      `Historical 2022 record; source type: ${field("Type of library / ")}; reconcile post-devolution operators; coordinates withheld`
    )

    return [result]
  })
}

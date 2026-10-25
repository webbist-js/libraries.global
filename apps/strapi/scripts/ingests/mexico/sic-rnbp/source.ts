import { MEXICAN_STATES, type MexicanLibrary } from "./map"

export const MEXICO_URL =
  "https://sic.cultura.gob.mx/opendata/d/0_rnbp_directorio.json"

export function validateMexicanSource(
  data: unknown
): asserts data is MexicanLibrary[] {
  if (!Array.isArray(data) || data.length < 7000 || data.length > 9000)
    throw new Error("Unexpected Mexican directory coverage; review the release")
  const ids = new Set<string>(),
    states = new Set<number>()
  for (const row of data) {
    if (!row || typeof row !== "object")
      throw new Error("Invalid Mexican directory row")
    const id = String(row.rnbp_id ?? "")
    if (!/^[1-9]\d*$/.test(id) || ids.has(id))
      throw new Error("Duplicate or missing Mexican library ID")
    ids.add(id)
    const state = Number(row.estado_id)
    if (!MEXICAN_STATES[state]) throw new Error("Unknown Mexican state code")
    states.add(state)
    for (const field of [
      "rnbp_nombre",
      "nom_ent",
      "nom_mun",
      "municipio_id",
      "gmaps_latitud",
      "gmaps_longitud",
    ])
      if (!(field in row))
        throw new Error(`Mexican source schema changed: missing ${field}`)
  }
  if (states.size !== 32) throw new Error("Incomplete Mexican state coverage")
}

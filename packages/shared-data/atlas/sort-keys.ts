/** Canonical collation is shared by Meili cursors, place keys and exports. */
export function foldAtlasName(value: string): string {
  if (value.includes("\0"))
    throw new RangeError("Atlas names cannot contain NUL")

  return value
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, " ")
}

export function atlasHex(value: string): string {
  return Array.from(new TextEncoder().encode(foldAtlasName(value)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export const atlasNameSortKey = (name: string): string => `n${atlasHex(name)}00`
export const atlasPlaceSortKey = (cityOrRegion: string, name: string): string =>
  `p${atlasHex(cityOrRegion)}00${atlasHex(name)}00`

export function atlasCityKey(
  city: string | null | undefined,
  parentId: string | null
): string | null {
  const name = city ? atlasHex(city) : ""

  return name && parentId ? `city:${parentId}:${name}` : null
}

export function atlasKeysetFilter(
  field: "name_sort" | "place_sort",
  lastKey: string,
  lastId: number
): string {
  const hex = lastKey.slice(1)
  let separators = 0
  for (let i = 0; i < hex.length; i += 2) {
    if (hex.slice(i, i + 2) === "00") separators++
  }
  if (
    lastKey[0] !== (field === "name_sort" ? "n" : "p") ||
    hex.length % 2 !== 0 ||
    !/^[0-9a-f]+$/.test(hex) ||
    !hex.endsWith("00") ||
    separators !== (field === "name_sort" ? 1 : 2) ||
    !Number.isSafeInteger(lastId) ||
    lastId < 1
  )
    throw new RangeError("Invalid Atlas continuation")
  const key = JSON.stringify(lastKey)

  return `(${field} > ${key} OR (${field} = ${key} AND atlas_id > ${lastId}))`
}

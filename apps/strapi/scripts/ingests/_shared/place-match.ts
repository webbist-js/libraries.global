/**
 * Matches a dataset's place names to the atlas's own Regions and Areas.
 * Datasets and GeoNames (the gazetteer's source) spell the same place
 * differently: "ST JOHNS" and "Saint Johns County", "LA SALLE" and "LaSalle
 * County", "ALEXANDRIA" and "City of Alexandria". So names are compared by a
 * key that ignores case, accents, punctuation and spacing, expands common
 * abbreviations, and drops the words that only say what kind of place it is.
 */

const ABBREVIATIONS: Record<string, string> = {
  st: "saint",
  ste: "sainte",
  mt: "mount",
  ft: "fort",
}

const KIND_WORDS = new Set([
  "and",
  "area",
  "borough",
  "census",
  "city",
  "county",
  "district",
  "island",
  "islands",
  "municipality",
  "municipio",
  "of",
  "parish",
  "planning",
  "region",
  "the",
])

export function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/['’`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .filter((word) => !KIND_WORDS.has(word))
    .join("")
}

// A city and a county can share a key (Virginia's "Richmond County" and
// "City of Richmond"). Only a name that says which can settle it.
function kindOf(name: string): "city" | "county" | null {
  if (/\b(county|parish|borough)\b/i.test(name)) return "county"
  if (/\bcity\b/i.test(name)) return "city"

  return null
}

/** The one place whose key equals the name's, or null when none or several do. */
export function matchPlace<T extends { name: string }>(
  name: string,
  places: T[]
): T | null {
  const key = placeKey(name)
  if (!key) return null

  const hits = places.filter((p) => placeKey(p.name) === key)
  if (hits.length === 1) return hits[0]!

  const kind = kindOf(name)
  const sameKind = kind ? hits.filter((p) => kindOf(p.name) === kind) : []

  return sameKind.length === 1 ? sameKind[0]! : null
}

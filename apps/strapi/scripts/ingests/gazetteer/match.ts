import type { ExistingPlace, SourcePlace } from "./types"
import { transliterate } from "../_shared/text"

/** Words that name a kind of place rather than the place. */
const TYPE_WORDS = new Set([
  "county",
  "region",
  "province",
  "canton",
  "district",
  "oblast",
  "voivodeship",
  "municipality",
  "department",
  "prefecture",
  "governorate",
  "parish",
  "state",
  "of",
  "the",
])

const words = (s: string) =>
  transliterate(s)
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    // Dropped, not split on, like `slugify`: "Hawke's Bay" = "Hawkes Bay".
    .replaceAll(/['\u2019]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * A name reduced for comparison: case, accents, punctuation and type words
 * ("County", "Canton of", plus `extra`, the country's own labels) ignored.
 * A name made only of type words keeps them. A name in a non-Latin script
 * normalises to "" and never matches.
 */
export function normaliseName(
  name: string,
  extra: readonly string[] = []
): string {
  const all = words(name)
  const drop = new Set([...TYPE_WORDS, ...extra.flatMap(words)])
  const kept = all.filter((w) => !drop.has(w))

  return (kept.length > 0 ? kept : all).join(" ")
}

/**
 * Existing places whose name (or alias) matches the source's name or one of
 * its alternate names, ignoring any place already tied to a different
 * GeoNames id. May return more than one hit: callers decide what to do with
 * an ambiguous name (see `planChildren`).
 */
export function nameHits(
  source: SourcePlace,
  existing: readonly ExistingPlace[],
  opts: { typeWords?: readonly string[]; aliases?: Record<string, string> } = {}
): ExistingPlace[] {
  const norm = (n: string) => normaliseName(n, opts.typeWords)
  const keys = new Set(
    [source.name, ...source.altNames].map(norm).filter(Boolean)
  )

  return existing.filter((e) => {
    if (e.geonamesId && source.geonamesId && e.geonamesId !== source.geonamesId)
      return false
    const alias = opts.aliases?.[e.name]
    const names = alias ? [e.name, alias] : [e.name]

    return names.some((n) => {
      const k = norm(n)

      return k !== "" && keys.has(k)
    })
  })
}

/**
 * The existing place a source place is (spec §6.5): same `geonamesId`, same
 * GSS code, else exactly one existing place whose name (or alias) matches
 * the source's name or one of its alternate names. A place already tied to
 * a different GeoNames id is never matched by name.
 */
export function findMatch(
  source: SourcePlace,
  existing: readonly ExistingPlace[],
  opts: { typeWords?: readonly string[]; aliases?: Record<string, string> } = {}
): ExistingPlace | null {
  if (source.geonamesId) {
    const byId = existing.find((e) => e.geonamesId === source.geonamesId)
    if (byId) return byId
  }
  // A GSS code is matched like an id, but a different GSS code doesn't block
  // a name match (codes change when councils are restructured).
  if (source.gssCode) {
    const byGss = existing.find((e) => e.gssCode === source.gssCode)
    if (byGss) return byGss
  }
  const hits = nameHits(source, existing, opts)

  return hits.length === 1 ? hits[0]! : null
}

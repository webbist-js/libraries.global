/**
 * Text helpers shared by dataset ingests. Many public datasets publish names
 * and addresses in capitals, so `properCase` turns "O'NEILL'S 1ST ST" into
 * "O'Neill's 1st St" without flattening acronyms or Roman numerals.
 */

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "upon",
])

const KEEP_UPPER = new Set([
  "II",
  "III",
  "IV",
  "VI",
  "VII",
  "VIII",
  "IX",
  "XI",
  "XII",
  "PO",
  "NE",
  "NW",
  "SE",
  "SW",
  "YMCA",
  "YWCA",
  "SUNY",
  "CUNY",
  "NYPL",
])

function capitalise(word: string): string {
  if (!word) return word
  if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase()

  const lower = word.toLowerCase()

  // Ordinals and other digit-led tokens: 1ST → 1st, 42ND → 42nd
  if (/^\d/.test(lower)) return lower

  // McKinley, McDonough
  if (/^mc[a-z]{2,}/.test(lower)) {
    return `Mc${lower.charAt(2).toUpperCase()}${lower.slice(3)}`
  }

  // O'Neill, D'Youville, but Children's and Farmers'
  const apostrophe = lower.indexOf("'")
  if (apostrophe > 0 && lower.length - apostrophe > 2) {
    const head = lower.slice(0, apostrophe + 1)
    const tail = lower.slice(apostrophe + 1)

    return `${head.charAt(0).toUpperCase()}${head.slice(1)}${tail.charAt(0).toUpperCase()}${tail.slice(1)}`
  }

  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
}

/** Proper-case a string published in capitals. */
export function properCase(input: string): string {
  const words = input.trim().replaceAll(/\s+/g, " ").split(" ")

  return words
    .map((word, i) =>
      word
        .split("-")
        .map((part, j) => {
          const small = part.toLowerCase()
          if (i > 0 && j === 0 && SMALL_WORDS.has(small)) return small

          return capitalise(part)
        })
        .join("-")
    )
    .join(" ")
}

/** URL slug: ASCII, lowercase, hyphen-separated. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/['\u2019]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
}

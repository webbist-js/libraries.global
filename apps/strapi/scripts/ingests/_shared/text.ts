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
          // "(RAQUEL" and "\"OLD\"": the word inside starts a phrase.
          const open = /^[("“]+/.exec(part)?.[0] ?? ""
          const word = part.slice(open.length)
          const small = word.toLowerCase()
          if (i > 0 && j === 0 && !open && SMALL_WORDS.has(small)) return small

          return `${open}${capitalise(word)}`
        })
        .join("-")
    )
    .join(" ")
}

/**
 * Letters Unicode's NFKD normalisation can't decompose into a base letter
 * plus a combining accent, mapped to their nearest ASCII spelling. Every
 * world place must be importable, so these can't just fall out as "".
 */
const TRANSLITERATIONS: Record<string, string> = {
  "\u0142": "l", // Polish \u0142
  "\u0141": "L", // Polish \u0141
  "\u00F8": "o", // Scandinavian \u00F8
  "\u00D8": "O", // Scandinavian \u00D8
  "\u00E6": "ae", // Scandinavian \u00E6
  "\u00C6": "Ae", // Scandinavian \u00C6
  "\u00DF": "ss", // German \u00DF
  "\u1E9E": "SS", // German capital \u1E9E
  "\u0111": "d", // Vietnamese/Croatian \u0111
  "\u0110": "D", // Vietnamese/Croatian \u0110
  "\u00F0": "d", // Icelandic \u00F0
  "\u00D0": "D", // Icelandic \u00D0
  "\u0131": "i", // Turkish dotless \u0131
  "\u00FE": "th", // Icelandic \u00FE
  "\u00DE": "Th", // Icelandic \u00DE
  "\u0153": "oe", // French \u0153
  "\u0152": "Oe", // French \u0152
  "\u0127": "h", // Maltese \u0127
  "\u0126": "H", // Maltese \u0126
  "\u0140": "l", // Catalan \u0140
  "\u013F": "L", // Catalan \u013F
}

const TRANSLITERATE_RE = new RegExp(
  `[${Object.keys(TRANSLITERATIONS).join("")}]`,
  "g"
)

/** Replace letters NFKD can't split into a base letter and an accent. */
export function transliterate(input: string): string {
  return input.replaceAll(TRANSLITERATE_RE, (ch) => TRANSLITERATIONS[ch]!)
}

/** URL slug: ASCII, lowercase, hyphen-separated. */
export function slugify(input: string): string {
  return transliterate(input)
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/['\u2019]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("-")
}

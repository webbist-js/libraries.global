/** Configured literal word policy. Empty/unsupported dictionaries do not claim language coverage. */
function matcher(language: string, dictionaries: Record<string, string[]>) {
  const key = Object.hasOwn(dictionaries, language)
    ? language
    : language.split("-")[0]
  const terms = Object.hasOwn(dictionaries, key) ? dictionaries[key] : []
  if (!terms?.length) return null
  const escaped = terms.map((term) =>
    term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  )

  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${escaped.join("|")})(?![\p{L}\p{N}])`,
    "giu"
  )
}

export function inspectContent(
  value: string,
  language: string,
  dictionaries: Record<string, string[]>
) {
  const pattern = matcher(language, dictionaries)

  return {
    language,
    terms: pattern ? [...new Set(value.match(pattern))] : [],
    covered: Boolean(pattern),
  }
}
export function maskContent(
  value: string,
  language: string,
  dictionaries: Record<string, string[]>
) {
  const pattern = matcher(language, dictionaries)

  return pattern
    ? value.replace(pattern, (term) => "•".repeat([...term].length))
    : value
}

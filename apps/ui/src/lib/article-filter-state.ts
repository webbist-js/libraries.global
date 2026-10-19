import {
  ARTICLE_QUERY_KEYS,
  articleBrowseSearchParams,
  parseArticleBrowseQuery,
  type ArticleBrowseResult,
  type ArticleFacetKey,
} from "@repo/shared-data"

const matches = (
  facet: { value: string; slug?: string; code?: string },
  value: string
) =>
  facet.value === value ||
  facet.slug === value ||
  facet.code === value.toUpperCase()

export function changeArticleFacet(
  encoded: string,
  key: ArticleFacetKey,
  values: string[],
  facets: ArticleBrowseResult["facets"]
): URLSearchParams {
  const next = new URLSearchParams(encoded)
  next.delete("page")
  const name = ARTICLE_QUERY_KEYS[key]
  if (key === "origins") {
    next.delete("origin")
    next.set("collection", values.length ? values.join(",") : "all")
  } else if (values.length) next.set(name, values.join(","))
  else if (key === "countries" || key === "languages") next.set(name, "all")
  else next.delete(name)
  if (key === "continents") {
    next.set("country", "all")
    next.delete("region")
    next.delete("area")
  }
  if (key === "countries") {
    next.delete("region")
    next.delete("area")
  }
  if (key === "regions") next.delete("area")
  if (
    (key === "areas" || key === "regions" || key === "countries") &&
    values.length
  ) {
    const rows = values.flatMap((value) =>
      facets[key].filter((facet) => matches(facet, value))
    )
    for (const [parent, field] of [
      ["continent", "continentDocumentId"],
      ["country", "countryDocumentId"],
      ["region", "regionDocumentId"],
    ] as const) {
      if (key === "countries" && parent !== "continent") continue
      if (key === "regions" && parent === "region") continue
      const ids = [...new Set(rows.map((row) => row[field]).filter(Boolean))]
      if (ids.length) next.set(parent, ids.join(","))
    }
  }

  return next
}
export function clearArticleFacets(encoded: string): URLSearchParams {
  const next = new URLSearchParams(encoded)
  for (const [key, query] of Object.entries(ARTICLE_QUERY_KEYS))
    if (key !== "origins") next.delete(query)
  next.set("country", "all")
  next.set("lang", "all")
  next.delete("page")

  return next
}
/** An explicit language (including all) wins over the reader's default. */
export function knowledgeBrowseParams(
  locale: string,
  input: Record<string, unknown>,
  defaultLanguage = locale
): string {
  const query = parseArticleBrowseQuery(input)
  const requested = Array.isArray(input.lang) ? input.lang[0] : input.lang
  if (!query.filters.languages?.length && requested !== "all")
    query.filters.languages = [defaultLanguage]
  const params = new URLSearchParams(articleBrowseSearchParams(query))
  params.set("preferredLocale", locale)
  if (requested === "all") params.set("lang", "all")

  return params.toString()
}

export function articlePreviewParams(
  encoded: string,
  kind: "journal" | "knowledge",
  locale: string,
  defaultLanguage = locale
): string {
  const input: Record<string, string> = {
    ...Object.fromEntries(new URLSearchParams(encoded)),
    page: "1",
  }
  if (kind === "knowledge")
    return knowledgeBrowseParams(locale, input, defaultLanguage)
  const query = parseArticleBrowseQuery(input)
  if (!query.filters.languages?.length && input.lang !== "all")
    query.filters.languages = [defaultLanguage]
  const params = new URLSearchParams(articleBrowseSearchParams(query))
  params.set("preferredLocale", locale)
  if (input.lang === "all") params.set("lang", "all")

  return params.toString()
}
export const articleFacetMatches = matches

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
export function articlePreviewParams(
  encoded: string,
  kind: "journal" | "knowledge",
  locale: string
): string {
  const params = Object.fromEntries(new URLSearchParams(encoded))
  const query = parseArticleBrowseQuery(params)
  if (kind === "journal" && !params.origin && !params.collection)
    query.filters.origins = ["community"]

  return `${articleBrowseSearchParams({ ...query, page: 1 })}&preferredLocale=${encodeURIComponent(locale)}`
}
export const articleFacetMatches = matches

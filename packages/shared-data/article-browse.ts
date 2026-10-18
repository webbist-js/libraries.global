/** The public discovery contract shared by Journal and Knowledge. */
export const ARTICLE_FACETS = [
  "languages",
  "continents",
  "countries",
  "regions",
  "areas",
  "libraries",
  "topics",
  "authors",
  "events",
  "origins",
  "sections",
] as const
export type ArticleFacetKey = (typeof ARTICLE_FACETS)[number]
export type ArticleSort = "newest" | "oldest" | "title"
export type ArticleFacetValue = {
  value: string
  label: string
  count: number
  slug?: string
  code?: string
  continentDocumentId?: string
  countryDocumentId?: string
  regionDocumentId?: string
}
export type ArticleBrowseQuery = {
  filters: Partial<Record<ArticleFacetKey, string[]>>
  sort: ArticleSort
  page: number
  pageSize: number
  documentIds?: string[]
  q?: string
}
export type ArticleBrowseItem = {
  documentId: string
  locale: string
  title: string
  slug: string
  summary: string | null
  author: string | null
  authorUsername: string | null
  publicationOrigin: "index" | "community" | null
  publishedAt: string
  updatedAt: string | null
  featured: boolean
  readingTimeMinutes: number
  place: string | null
  section: {
    documentId: string
    slug: string
    name: string
    icon?: string
    tint?: string
  } | null
  sectionSlugs: string[]
  heroImage: { url: string; alternativeText: string | null } | null
  facets: Partial<Record<ArticleFacetKey, Omit<ArticleFacetValue, "count">[]>>
}
export type ArticleBrowseResult = {
  items: ArticleBrowseItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  facets: Record<ArticleFacetKey, ArticleFacetValue[]>
  editorialItems: ArticleBrowseItem[]
  editorPick: ArticleBrowseItem | null
  appliedFilters: ArticleBrowseQuery["filters"]
}

export const ARTICLE_QUERY_KEYS: Record<ArticleFacetKey, string> = {
  languages: "lang",
  continents: "continent",
  countries: "country",
  regions: "region",
  areas: "area",
  libraries: "library",
  topics: "topic",
  authors: "author",
  events: "event",
  origins: "origin",
  sections: "section",
}
const VALUE = /^[\p{L}\p{N}][\p{L}\p{N}_.:@-]{0,119}$/u
const LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const MAX_SELECTIONS = 20

function values(input: unknown): string[] {
  const strings =
    typeof input === "string" ? [input] : Array.isArray(input) ? input : []

  return [
    ...new Set(
      strings
        .slice(0, MAX_SELECTIONS)
        .flatMap((value) =>
          typeof value === "string"
            ? value.slice(0, 4096).split(",").slice(0, MAX_SELECTIONS)
            : []
        )
    ),
  ]
    .filter((value) => VALUE.test(value))
    .slice(0, MAX_SELECTIONS)
}
function boundedInteger(
  input: unknown,
  fallback: number,
  maximum: number
): number {
  if (typeof input !== "string" || !/^\d+$/.test(input)) return fallback

  return Math.max(1, Math.min(Number(input), maximum))
}

/** No arbitrary Strapi filters, populate, status or sort expression crosses this seam. */
export function parseArticleBrowseQuery(
  input: Record<string, unknown>
): ArticleBrowseQuery {
  const filters: ArticleBrowseQuery["filters"] = {}
  for (const key of ARTICLE_FACETS) {
    let selected = values(
      key === "origins"
        ? (input.collection ?? input.origin)
        : input[ARTICLE_QUERY_KEYS[key]]
    )
    if (key === "languages")
      selected = selected.filter(
        (value) => value !== "all" && LANGUAGE.test(value)
      )
    if (key === "origins")
      selected = selected.filter(
        (value) => value === "index" || value === "community"
      )
    if (key === "countries")
      selected = selected.filter((value) => value !== "all")
    if (selected.length) filters[key] = selected
  }
  const sort: ArticleSort =
    input.sort === "oldest" || input.sort === "title" ? input.sort : "newest"
  const documentIds = values(input.documentId)

  return {
    filters,
    sort,
    page: boundedInteger(input.page, 1, 10_000),
    pageSize: boundedInteger(input.pageSize, 9, 50),
    ...(documentIds.length ? { documentIds } : {}),
    ...(typeof input.q === "string" && input.q.trim()
      ? { q: input.q.trim().replaceAll(/\s+/gu, " ").slice(0, 120) }
      : {}),
  }
}

export function articleBrowseSearchParams(query: ArticleBrowseQuery): string {
  const params = new URLSearchParams({
    sort: query.sort,
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  for (const key of ARTICLE_FACETS) {
    const values = query.filters[key]
    if (values?.length) params.set(ARTICLE_QUERY_KEYS[key], values.join(","))
  }
  if (query.q) params.set("q", query.q)
  if (query.documentIds?.length)
    params.set("documentId", query.documentIds.join(","))

  return params.toString()
}

export function emptyArticleFacets(): ArticleBrowseResult["facets"] {
  return {
    languages: [],
    continents: [],
    countries: [],
    regions: [],
    areas: [],
    libraries: [],
    topics: [],
    authors: [],
    events: [],
    origins: [],
    sections: [],
  }
}

/** OR within one dimension, AND between dimensions. Slugs and canonical IDs both work. */
export function articleMatches(
  item: ArticleBrowseItem,
  query: ArticleBrowseQuery,
  except?: ArticleFacetKey
): boolean {
  if (query.documentIds?.length && !query.documentIds.includes(item.documentId))
    return false

  if (query.q) {
    const normalized = (value: string) =>
      value.normalize("NFKD").replaceAll(/\p{M}/gu, "").toLowerCase()
    const text = normalized(
      [
        item.title,
        item.summary,
        item.author,
        item.place,
        ...Object.values(item.facets).flatMap((facets) =>
          (facets ?? []).map((facet) => facet.label)
        ),
      ]
        .filter(Boolean)
        .join(" ")
    )
    if (
      !normalized(query.q)
        .split(" ")
        .every((word) => text.includes(word))
    )
      return false
  }

  return ARTICLE_FACETS.every((key) => {
    const selected = query.filters[key]
    if (key === except || !selected?.length) return true

    return (item.facets[key] ?? []).some((facet) =>
      selected.some(
        (value) =>
          value === facet.value ||
          value === facet.slug ||
          value.toUpperCase() === facet.code
      )
    )
  })
}

function sortArticles(
  items: ArticleBrowseItem[],
  sort: ArticleSort
): ArticleBrowseItem[] {
  return [...items].sort((a, b) => {
    const primary =
      sort === "title"
        ? a.title.localeCompare(b.title)
        : a.publishedAt.localeCompare(b.publishedAt) *
          (sort === "oldest" ? 1 : -1)

    return (
      primary ||
      a.documentId.localeCompare(b.documentId) ||
      a.locale.localeCompare(b.locale)
    )
  })
}

/** Items, totals and disjunctive facets use the same publication/language predicate. */
export function aggregateArticleBrowse(
  items: ArticleBrowseItem[],
  query: ArticleBrowseQuery,
  featuredDocumentId: string | null = null,
  preferredLocale = "en"
): ArticleBrowseResult {
  const published = items.filter((item) => !!item.publishedAt)
  const matched = sortArticles(
    published.filter((item) => articleMatches(item, query)),
    query.sort
  )
  const facets = emptyArticleFacets()
  for (const key of ARTICLE_FACETS) {
    const counts = new Map<string, ArticleFacetValue>()
    for (const item of published) {
      if (!articleMatches(item, query, key)) continue
      const seen = new Set<string>()
      for (const value of item.facets[key] ?? []) {
        if (seen.has(value.value)) continue
        seen.add(value.value)
        const prior = counts.get(value.value)
        counts.set(value.value, { ...value, count: (prior?.count ?? 0) + 1 })
      }
    }
    facets[key] = [...counts.values()].sort(
      (a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value)
    )
  }
  // Editorial prominence is independent of the community list's origin filter,
  // but respects language, place and other reader selections.
  const editorialQuery = {
    ...query,
    filters: { ...query.filters, origins: ["index"] },
  }
  const languagePreference = [
    ...new Set([...(query.filters.languages ?? []), preferredLocale, "en"]),
  ]
  const languageRank = (item: ArticleBrowseItem) => {
    const position = languagePreference.indexOf(item.locale)

    return position === -1 ? languagePreference.length : position
  }
  const preferLanguage = (left: ArticleBrowseItem, right: ArticleBrowseItem) =>
    languageRank(left) - languageRank(right) ||
    left.locale.localeCompare(right.locale)
  const editorialDocuments = new Map<string, ArticleBrowseItem>()
  for (const item of published) {
    if (!articleMatches(item, editorialQuery)) continue
    const prior = editorialDocuments.get(item.documentId)
    if (!prior || preferLanguage(item, prior) < 0)
      editorialDocuments.set(item.documentId, item)
  }
  const editorialItems = sortArticles(
    [...editorialDocuments.values()],
    "newest"
  )
  const pickQuery = { ...query, filters: { ...query.filters } }
  delete pickQuery.filters.origins
  const editorPick =
    published
      .filter(
        (item) =>
          item.documentId === featuredDocumentId &&
          articleMatches(item, pickQuery)
      )
      .sort(preferLanguage)[0] ?? null
  if (editorPick?.publicationOrigin === "index") {
    const position = editorialItems.indexOf(editorPick)
    if (position !== -1) editorialItems.splice(position, 1)
    editorialItems.unshift(editorPick)
  }

  return {
    items: matched.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize
    ),
    total: matched.length,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.ceil(matched.length / query.pageSize),
    facets,
    editorialItems: editorialItems.slice(0, 3),
    editorPick,
    appliedFilters: query.filters,
  }
}

/** Resolve only an exact known code, slug or country name. Never infer a location. */
export function canonicalReaderCountry(
  country: string | null | undefined,
  available: readonly ArticleFacetValue[]
): string | null {
  const candidate = country?.trim().toLocaleLowerCase("en")
  if (!candidate) return null
  const matches = available.filter((value) =>
    [value.value, value.slug, value.code, value.label].some(
      (part) => part?.toLocaleLowerCase("en") === candidate
    )
  )

  return matches.length === 1 ? matches[0]!.value : null
}

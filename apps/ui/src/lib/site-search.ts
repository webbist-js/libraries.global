/** Public, bounded result contract; no CMS documents or account data reach the modal. */
export const SITE_SEARCH_GROUPS = [
  "libraries",
  "places",
  "journal",
  "knowledge",
  "events",
  "pages",
] as const
export type SiteSearchGroup = (typeof SITE_SEARCH_GROUPS)[number]
export const SITE_SEARCH_SCOPES = [
  "all",
  "libraries",
  "journal",
  "knowledge",
  "events",
] as const
export type SiteSearchScope = (typeof SITE_SEARCH_SCOPES)[number]
export type SiteSearchItem = {
  id: string
  group: SiteSearchGroup
  title: string
  summary: string
  href: string
}
export type SiteSearchResponse = {
  items: SiteSearchItem[]
  counts: Partial<Record<SiteSearchGroup, number>>
  estimated: SiteSearchGroup[]
  unavailable: SiteSearchGroup[]
}
export function inSearchScope(group: SiteSearchGroup, scope: SiteSearchScope) {
  return (
    scope === "all" ||
    group === scope ||
    (scope === "libraries" && group === "places")
  )
}
export function rememberSearch(
  recent: readonly string[],
  query: string
): string[] {
  const value = query.trim().slice(0, 120)

  return value
    ? [
        value,
        ...recent.filter(
          (item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase()
        ),
      ].slice(0, 5)
    : [...recent]
}

/** Failed sources are unknown; a partial total is a lower bound, never a false zero. */
export function searchScopeCount(
  data: SiteSearchResponse | undefined,
  scope: SiteSearchScope,
  locale: string
): string {
  if (!data) return "—"
  const groups = SITE_SEARCH_GROUPS.filter((group) =>
    inSearchScope(group, scope)
  )
  if (groups.every((group) => data.unavailable.includes(group))) return "—"
  const total = groups.reduce(
    (sum, group) => sum + (data.counts[group] ?? 0),
    0
  )
  const approximate = groups.some((group) => data.estimated.includes(group))
  const partial = groups.some((group) => data.unavailable.includes(group))

  return `${approximate ? "≈" : ""}${total.toLocaleString(locale)}${partial ? "+" : ""}`
}

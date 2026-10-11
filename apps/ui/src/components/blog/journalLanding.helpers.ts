import { TYPE_TINT } from "@/lib/design-tokens"

/** Articles per page in the Journal's "All articles" list. */
export const JOURNAL_PAGE_SIZE = 9

export const JOURNAL_SORTS = ["newest", "oldest", "title"] as const
export type JournalSort = (typeof JOURNAL_SORTS)[number]

export type JournalView = "grid" | "list"

/** The landing's list state, kept in the URL so it survives reloads and shares. */
export type JournalQuery = {
  section: string | null
  sort: JournalSort
  page: number
  view: JournalView
  /** Requested article language; null means the default choice. */
  lang: string | null
}

export const DEFAULT_JOURNAL_QUERY: JournalQuery = {
  section: null,
  sort: "newest",
  page: 1,
  view: "grid",
  lang: null,
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/
const MAX_PAGE = 10_000

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Reads `?section=&sort=&page=&view=&lang=`, dropping anything malformed. */
export function parseJournalQuery(params: SearchParams): JournalQuery {
  const section = first(params.section)
  const sort = first(params.sort)
  const page = Number.parseInt(first(params.page) ?? "", 10)
  const view = first(params.view)
  const lang = first(params.lang)

  return {
    section: section && SLUG.test(section) ? section : null,
    sort: JOURNAL_SORTS.includes(sort as JournalSort)
      ? (sort as JournalSort)
      : "newest",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
    view: view === "list" ? "list" : "grid",
    lang: lang && LOCALE.test(lang) ? lang : null,
  }
}

/**
 * The landing URL for `base` with `changes` applied. Changing the section,
 * sort or language starts again at page 1; defaults are left out.
 */
export function journalHref(
  base: JournalQuery,
  changes: Partial<JournalQuery> = {},
  hash?: string
): string {
  const resetsPage =
    ("section" in changes && changes.section !== base.section) ||
    ("sort" in changes && changes.sort !== base.sort) ||
    ("lang" in changes && changes.lang !== base.lang)
  const next: JournalQuery = {
    ...base,
    ...changes,
    page: changes.page ?? (resetsPage ? 1 : base.page),
  }

  const params = new URLSearchParams()
  if (next.section) params.set("section", next.section)
  if (next.sort !== "newest") params.set("sort", next.sort)
  if (next.page > 1) params.set("page", String(next.page))
  if (next.view !== "grid") params.set("view", next.view)
  if (next.lang) params.set("lang", next.lang)

  const query = params.toString()

  return `/journal${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

/** Strapi sort for a list order; `id` breaks ties so pages never overlap. */
export function journalSortParam(sort: JournalSort): string[] {
  switch (sort) {
    case "oldest":
      return ["publishedAt:asc", "id:asc"]
    case "title":
      return ["title:asc", "id:asc"]

    default:
      return ["publishedAt:desc", "id:desc"]
  }
}

export type PageGap = "gap-start" | "gap-end"

/** Page numbers to show: all of them up to 7, else the ends and a window. */
export function pageWindow(
  current: number,
  total: number
): (number | PageGap)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const start = Math.max(2, Math.min(current - 1, total - 4))
  const end = Math.min(total - 1, Math.max(current + 1, 5))
  const pages: (number | PageGap)[] = [1]
  if (start > 2) pages.push("gap-start")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push("gap-end")
  pages.push(total)

  return pages
}

/** "Showing 10–18 of 27" bounds; zeros when the page is past the end. */
export function showingRange(
  page: number,
  pageSize: number,
  total: number
): { from: number; to: number } {
  const from = (page - 1) * pageSize + 1
  if (total === 0 || from > total) return { from: 0, to: 0 }

  return { from, to: Math.min(page * pageSize, total) }
}

type Named = { name?: string | null } | null | undefined

export type PlaceLibrary = {
  area?: Named
  region?: Named
  country?: Named
}

/**
 * Where an article is set, from its first linked library: the most specific
 * place we know plus the country ("Radlett, England"), or null when the
 * article links no library with a location.
 */
export function placeLabel(
  libraries: readonly PlaceLibrary[] | null | undefined
): string | null {
  for (const library of libraries ?? []) {
    const local = library.area?.name || library.region?.name || null
    const country = library.country?.name || null
    const parts = [local, country].filter(
      (part, i, all): part is string => !!part && all.indexOf(part) === i
    )
    if (parts.length > 0) return parts.join(", ")
  }

  return null
}

/**
 * The article language to show: the one asked for if it has articles, else
 * the route locale, else the default locale (English), else any that has.
 */
export function resolveJournalLanguage({
  requested,
  available,
  routeLocale,
  defaultLocale,
}: {
  requested: string | null
  available: readonly string[]
  routeLocale: string
  defaultLocale: string
}): string {
  for (const code of [requested, routeLocale, defaultLocale]) {
    if (code && available.includes(code)) return code
  }

  return available[0] ?? defaultLocale
}

export const SECTION_TINTS = {
  purple: TYPE_TINT.national,
  green: TYPE_TINT.public,
  blue: TYPE_TINT.academic,
  rust: TYPE_TINT.special,
  neutral: TYPE_TINT.neutral,
} as const

export type SectionTint = keyof typeof SECTION_TINTS

export const DEFAULT_SECTION_ICON = "mdi:book-open-page-variant-outline"

const ICON = /^[a-z0-9-]+:[a-z0-9-]+$/

/** A section's icon and colours, from its Strapi fields with safe fallbacks. */
export function sectionVisual(
  section: { icon?: string | null; tint?: string | null } | null | undefined
): { icon: string; bg: string; fg: string } {
  const icon =
    section?.icon && ICON.test(section.icon)
      ? section.icon
      : DEFAULT_SECTION_ICON
  const tint =
    section?.tint && section.tint in SECTION_TINTS
      ? SECTION_TINTS[section.tint as SectionTint]
      : SECTION_TINTS.neutral

  return { icon, ...tint }
}

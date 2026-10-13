/**
 * The sitemap is an index (`/sitemap.xml`) of files split by category and
 * locale, each capped at `URLS_PER_FILE` URLs: `/sitemaps/pages-en-1.xml`,
 * `journal-en-1.xml`, `regions-en-1.xml`, `libraries-en-1.xml` and on. The
 * protocol allows 50,000 URLs a file; 10,000 keeps each one cheap to build
 * and to crawl, and an index of up to 50,000 files covers any index size.
 */
export const URLS_PER_FILE = 10_000
export const MAX_SITEMAP_URLS = 50_000
export const MAX_SITEMAP_BYTES = 50 * 1024 * 1024

export const SITEMAP_SEGMENTS = [
  "pages",
  "continents",
  "countries",
  "regions",
  "events",
  "drives",
  "libraries",
  "journal",
  "knowledge",
  "legal",
  "profiles",
] as const

export type SitemapSegment = (typeof SITEMAP_SEGMENTS)[number]

export type SitemapFile = {
  segment: SitemapSegment
  locale: string
  /** 1-based. */
  page: number
}

export function sitemapFileName({ segment, locale, page }: SitemapFile) {
  return `${segment}-${locale}-${page}.xml`
}

const FILE_NAME = new RegExp(
  String.raw`^(${SITEMAP_SEGMENTS.join("|")})-([a-z]{2}(?:-[A-Za-z]{2,4})?)-([1-9]\d{0,6})\.xml$`
)

/** The file a `/sitemaps/<name>` request asks for, or null for anything else. */
export function parseSitemapFileName(name: string): SitemapFile | null {
  const match = FILE_NAME.exec(name)
  if (!match) return null

  return {
    segment: match[1] as SitemapSegment,
    locale: match[2]!,
    page: Number(match[3]),
  }
}

/** Files needed for `total` URLs (none for none). */
export function filesFor(total: number): number {
  return Math.ceil(Math.max(0, total) / URLS_PER_FILE)
}

/** The URLs for 1-based `page` of an in-memory list. */
export function pageOf<T>(items: T[], page: number): T[] {
  if (page < 1) return []

  return items.slice((page - 1) * URLS_PER_FILE, page * URLS_PER_FILE)
}

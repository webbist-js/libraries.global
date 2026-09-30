import "server-only"

import type { Locale } from "next-intl"

/**
 * `GET /api/libraries/slugs`: the path of every published library, capped
 * per page by Strapi (WP-E), read here page by page. Feeds the sitemap and
 * `generateStaticParams`; nothing else needs every library at once.
 */

export const LIBRARY_SLUGS_PAGE_SIZE = 1000
const MAX_PAGES = 100

export type LibrarySlugRow = {
  slug: string
  locale?: string | null
  updatedAt?: string | null
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

type SlugsPage = {
  data?: LibrarySlugRow[]
  meta?: { pagination?: { page?: number; pageCount?: number } }
}

export async function fetchAllLibrarySlugs(
  locale: Locale
): Promise<{ data: LibrarySlugRow[] }> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const rows: LibrarySlugRow[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      locale,
      status: "published",
      page: String(page),
      pageSize: String(LIBRARY_SLUGS_PAGE_SIZE),
    })
    let json: SlugsPage
    try {
      const res = await fetch(`${strapiUrl}/api/libraries/slugs?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        next: { revalidate: 3600, tags: ["strapi", "library"] },
      })
      if (!res.ok) break
      json = (await res.json()) as SlugsPage
    } catch {
      break
    }
    const batch = json.data ?? []
    rows.push(...batch)
    const pageCount = json.meta?.pagination?.pageCount
    if (batch.length < LIBRARY_SLUGS_PAGE_SIZE) break
    if (pageCount !== undefined && page >= pageCount) break
  }

  return { data: rows }
}

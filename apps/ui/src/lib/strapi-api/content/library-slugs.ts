import "server-only"

import type { Locale } from "next-intl"

/**
 * Reads for the sitemap: `GET /api/libraries/slugs` (paths, walked by
 * keyset), `/slugs/count` and `/location-counts`. Each sitemap file reads
 * only its own slice, so no request ever loads the whole library index.
 * These throw when Strapi fails, so the sitemap route can answer 503 rather
 * than an empty or partial file.
 */

/** The most rows one `/libraries/slugs` request returns (Strapi's cap). */
export const LIBRARY_SLUGS_PAGE_SIZE = 1000

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
  meta?: { next?: number | null }
}

const CACHE = { revalidate: 3600, tags: ["strapi", "library"] }

async function strapiJson<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const res = await fetch(
    `${strapiUrl}/api${path}?${new URLSearchParams(params)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      next: CACHE,
    }
  )
  if (!res.ok) throw new Error(`GET ${path} answered ${res.status}`)

  return (await res.json()) as T
}

/** How many published libraries the locale has. */
export async function fetchLibrarySlugCount(locale: Locale): Promise<number> {
  const { count } = await strapiJson<{ count?: number }>(
    "/libraries/slugs/count",
    { locale, status: "published" }
  )

  return typeof count === "number" ? count : 0
}

/**
 * `size` library paths from row `offset` (in id order). Skips to `offset`
 * once, then follows the keyset cursor, `LIBRARY_SLUGS_PAGE_SIZE` at a time.
 */
export async function fetchLibrarySlugRange(
  locale: Locale,
  offset: number,
  size: number
): Promise<LibrarySlugRow[]> {
  const rows: LibrarySlugRow[] = []
  let after: number | null = 0

  while (after !== null && rows.length < size) {
    const limit = Math.min(LIBRARY_SLUGS_PAGE_SIZE, size - rows.length)
    const json: SlugsPage = await strapiJson<SlugsPage>("/libraries/slugs", {
      locale,
      status: "published",
      after: String(after),
      start: String(after === 0 ? offset : 0),
      limit: String(limit),
    })
    const batch = json.data ?? []
    rows.push(...batch)
    after = batch.length === limit ? (json.meta?.next ?? null) : null
  }

  return rows
}

/**
 * Published-library counts keyed by `continent`, `continent/country` and
 * `continent/country/region` slug path.
 */
export async function fetchLibraryLocationCounts(
  locale: Locale
): Promise<Map<string, number>> {
  const { data } = await strapiJson<{ data?: Record<string, number> }>(
    "/libraries/location-counts",
    { locale, status: "published" }
  )

  return new Map(Object.entries(data ?? {}))
}

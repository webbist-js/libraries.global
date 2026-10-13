import "server-only"

import type { SitemapSegment } from "./files"

export type Source = Exclude<SitemapSegment, "pages">
export type SitemapRow = {
  id: number
  slug?: string | null
  username?: string | null
  documentId?: string | null
  updatedAt?: string | null
  docsSections?: string[] | null
  section?: { slug?: string | null } | null
  continent?: { slug?: string | null } | null
  country?: {
    slug?: string | null
    continent?: { slug?: string | null } | null
  } | null
  region?: { slug?: string | null } | null
}

const BATCH_SIZE = 1000

/** Fail closed: a bad response must never masquerade as an empty sitemap. */
export async function sitemapJson<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const base = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const res = await fetch(`${base}/api${path}?${new URLSearchParams(params)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    next: { revalidate: 3600, tags: ["strapi"] },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Sitemap source ${path}: ${res.status}`)

  return res.json() as Promise<T>
}

export async function sourceCount(
  source: Source,
  locale: string
): Promise<number> {
  const { count } = await sitemapJson<{ count: number }>(
    `/sitemap/${source}/count`,
    { locale }
  )
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Invalid sitemap count")

  return count
}

/** Skip to this file once, then use a strictly advancing id cursor. */
export async function sourceRows(
  source: Source,
  locale: string,
  offset: number,
  size: number
): Promise<SitemapRow[]> {
  const rows: SitemapRow[] = []
  let after = 0
  while (rows.length < size) {
    const limit = Math.min(BATCH_SIZE, size - rows.length)
    const json = await sitemapJson<{
      data: SitemapRow[]
      meta: { next: number | null }
    }>(`/sitemap/${source}`, {
      locale,
      after: String(after),
      start: String(after === 0 ? offset : 0),
      limit: String(limit),
    })
    if (!Array.isArray(json.data) || json.data.length > limit || !json.meta)
      throw new Error("Invalid sitemap batch")
    let previous = after
    for (const row of json.data) {
      if (!Number.isSafeInteger(row.id) || row.id <= previous)
        throw new Error("Sitemap cursor did not advance")
      previous = row.id
    }
    rows.push(...json.data)
    const next = json.meta.next
    if (next === null) break
    if (json.data.length !== limit || next !== previous || next <= after)
      throw new Error("Invalid sitemap cursor")
    after = next
  }

  return rows
}

/** The complete, lightweight section taxonomy, for Knowledge's canonical home. */
export async function knowledgeSections(): Promise<{ slug: string }[]> {
  const sections: { slug: string }[] = []
  for (let page = 1; ; page++) {
    const json = await sitemapJson<{
      data: { slug: string }[]
      meta: { pagination: { page: number; pageCount: number } }
    }>("/wiki-sections", {
      "fields[0]": "slug",
      "fields[1]": "name",
      "sort[0]": "order:asc",
      "sort[1]": "name:asc",
      "sort[2]": "id:asc",
      "pagination[page]": String(page),
      "pagination[pageSize]": "100",
    })
    if (
      !Array.isArray(json.data) ||
      json.meta?.pagination?.page !== page ||
      !Number.isSafeInteger(json.meta.pagination.pageCount)
    )
      throw new Error("Invalid Knowledge section page")
    sections.push(...json.data.filter((s) => s.slug))
    if (page >= json.meta.pagination.pageCount) break
  }

  return sections
}

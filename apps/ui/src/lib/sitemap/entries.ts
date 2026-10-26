import "server-only"

import { docsArticlePath } from "@/components/docs/docs.config"
import { betaEnabled } from "@/lib/beta/access"
import { getEnvVar } from "@/lib/env-vars"
import { isDevelopment, isProduction } from "@/lib/general-helpers"
import { absoluteUrl, LIVE_LOCALES } from "@/lib/seo/metadata"

import {
  filesFor,
  SITEMAP_SEGMENTS,
  type SitemapFile,
  URLS_PER_FILE,
} from "./files"
import {
  knowledgeSections,
  sitemapJson,
  sourceCount,
  sourceRows,
  type SitemapRow,
  type Source,
} from "./source"
import type { SitemapEntry } from "./xml"

export function sitemapEnabled(): boolean {
  return (
    !betaEnabled() &&
    (isProduction() || isDevelopment()) &&
    Boolean(getEnvVar("APP_PUBLIC_URL"))
  )
}

/** Counts only: even a three-million-Library index never loads the records. */
export async function sitemapFiles(): Promise<SitemapFile[]> {
  const perLocale = await Promise.all(
    LIVE_LOCALES.map(async (locale) => {
      const counts = await Promise.all(
        SITEMAP_SEGMENTS.map(async (segment) => ({
          segment,
          total:
            segment === "pages"
              ? STATIC_ROUTES.length
              : await sourceCount(segment, locale),
        }))
      )

      return counts.flatMap(({ segment, total }) =>
        Array.from({ length: filesFor(total) }, (_, i) => ({
          segment,
          locale,
          page: i + 1,
        }))
      )
    })
  )

  return perLocale.flat()
}

/** Only this file's window is read; every growing content type is paginated. */
export async function sitemapEntries(
  file: SitemapFile
): Promise<SitemapEntry[] | null> {
  if (
    !LIVE_LOCALES.includes(file.locale) ||
    !Number.isSafeInteger(file.page) ||
    file.page < 1
  )
    return null
  if (file.segment === "pages") {
    if (file.page !== 1) return null

    const { data } = await sitemapJson<{ data: Record<string, boolean> }>(
      "/sitemap/pages",
      { locale: file.locale }
    )
    if (typeof data?.[""] !== "boolean" || typeof data?.journal !== "boolean")
      throw new Error("Invalid static-page visibility")

    return STATIC_ROUTES.filter((r) => data[r.path] !== false).map((r) => ({
      url: absoluteUrl(r.path, file.locale),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    }))
  }
  const [rows, sections] = await Promise.all([
    sourceRows(
      file.segment,
      file.locale,
      (file.page - 1) * URLS_PER_FILE,
      URLS_PER_FILE
    ),
    file.segment === "knowledge" ? knowledgeSections() : Promise.resolve([]),
  ])
  if (!rows.length) return null

  return rows.map((row) => {
    const path = pathFor(file.segment as Source, row, sections)
    if (!path) throw new Error(`Invalid ${file.segment} sitemap path`)

    return {
      url: absoluteUrl(path, file.locale),
      ...(row.updatedAt ? { lastModified: row.updatedAt } : {}),
    }
  })
}

/** Canonical paths match the public route builders, including unfiled Knowledge. */
export function pathFor(
  source: Source,
  row: SitemapRow,
  sections: { slug: string }[] = []
): string | null {
  const continent = row.continent?.slug ?? row.country?.continent?.slug
  const country = row.country?.slug
  switch (source) {
    case "networks":
      return row.slug ? `library-networks/${row.slug}` : null
    case "libraries":
      return continent && country && row.region?.slug && row.slug
        ? `${continent}/${country}/${row.region.slug}/${row.slug}`
        : null
    case "continents":
      return row.slug ?? null
    case "countries":
      return continent && row.slug ? `${continent}/${row.slug}` : null
    case "regions":
      return continent && country && row.slug
        ? `${continent}/${country}/${row.slug}`
        : null
    case "journal":
      return row.slug
        ? `journal/${row.section?.slug ?? "general"}/${row.slug}`
        : null
    case "knowledge":
      return row.slug && sections.length ? docsArticlePath(row, sections) : null
    case "legal":
      return row.slug ? `legal/${row.slug}` : null
    case "drives":
      return row.slug ? `community/drives/${row.slug}` : null
    case "events":
      return row.documentId ? `events/${row.documentId}` : null
    case "profiles":
      return row.username ? `profile/${encodeURIComponent(row.username)}` : null
  }
}

/** Public, indexable static routes (private/transactional ones are excluded). */
const STATIC_ROUTES: {
  path: string
  changeFrequency: SitemapEntry["changeFrequency"]
  priority: number
}[] = [
  { path: "library-networks", changeFrequency: "weekly", priority: 0.6 },
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "about", changeFrequency: "monthly", priority: 0.6 },
  { path: "libraries", changeFrequency: "daily", priority: 0.9 },
  { path: "map", changeFrequency: "weekly", priority: 0.7 },
  { path: "events", changeFrequency: "daily", priority: 0.7 },
  { path: "journal", changeFrequency: "weekly", priority: 0.6 },
  { path: "knowledge", changeFrequency: "weekly", priority: 0.6 },
  { path: "community", changeFrequency: "daily", priority: 0.6 },
  { path: "community/supporters", changeFrequency: "weekly", priority: 0.4 },
  {
    path: "community/leaderboard",
    changeFrequency: "daily",
    priority: 0.4,
  },
  {
    path: "community/suggestions",
    changeFrequency: "weekly",
    priority: 0.4,
  },
  { path: "contribute", changeFrequency: "monthly", priority: 0.5 },
  {
    path: "contribute/membership",
    changeFrequency: "monthly",
    priority: 0.5,
  },
]

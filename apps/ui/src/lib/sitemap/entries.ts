import "server-only"

import type { Locale } from "next-intl"

import { docsArticlePath } from "@/components/docs/docs.config"
import { getEnvVar } from "@/lib/env-vars"
import { isDevelopment, isProduction } from "@/lib/general-helpers"
import { isIndexableLocation } from "@/lib/seo/location"
import { absoluteUrl, LIVE_LOCALES } from "@/lib/seo/metadata"
import {
  fetchLibraryLocationCounts,
  fetchLibrarySlugCount,
  fetchLibrarySlugRange,
  type LibrarySlugRow,
} from "@/lib/strapi-api/content/library-slugs"
import {
  fetchAllBlogArticleSlugs,
  fetchAllContinents,
  fetchAllCountries,
  fetchAllRegions,
  fetchDocsWikiArticles,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"

import { filesFor, pageOf, type SitemapFile, URLS_PER_FILE } from "./files"
import type { SitemapEntry } from "./xml"

/** Sitemaps are served in production and local dev, once the site URL is set. */
export function sitemapEnabled(): boolean {
  if (!isProduction() && !isDevelopment()) return false

  return Boolean(getEnvVar("APP_PUBLIC_URL"))
}

/** Every file the index lists, per live locale. */
export async function sitemapFiles(): Promise<SitemapFile[]> {
  const perLocale = await Promise.all(
    LIVE_LOCALES.map(async (locale) => {
      const [locations, events, libraries] = await Promise.all([
        locationEntries(locale as Locale),
        fetchUpcomingEventTotal(),
        fetchLibrarySlugCount(locale as Locale),
      ])
      const files = (segment: SitemapFile["segment"], count: number) =>
        Array.from({ length: count }, (_, i) => ({
          segment,
          locale,
          page: i + 1,
        }))

      return [
        ...files("pages", 1),
        ...files("locations", filesFor(locations.length)),
        ...files("events", filesFor(events)),
        ...files("libraries", filesFor(libraries)),
      ]
    })
  )

  return perLocale.flat()
}

/** The URLs in one file, or null when the file doesn't exist. */
export async function sitemapEntries(
  file: SitemapFile
): Promise<SitemapEntry[] | null> {
  if (!LIVE_LOCALES.includes(file.locale)) return null
  const locale = file.locale as Locale

  let entries: SitemapEntry[]
  switch (file.segment) {
    case "pages":
      if (file.page !== 1) return null
      entries = await pageEntries(locale)
      break

    case "locations":
      entries = pageOf(await locationEntries(locale), file.page)
      break

    case "events":
      entries = await eventEntries(locale, file.page)
      break

    case "libraries":
      entries = await libraryEntries(locale, file.page)
      break
  }

  return entries.length > 0 || file.page === 1 ? entries : null
}

// ── Pages ───────────────────────────────────────────────────────────────────

/** Public, indexable static routes (private/transactional ones are excluded). */
const STATIC_ROUTES: {
  path: string
  changeFrequency: SitemapEntry["changeFrequency"]
  priority: number
}[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "libraries", changeFrequency: "daily", priority: 0.9 },
  { path: "map", changeFrequency: "weekly", priority: 0.7 },
  { path: "events", changeFrequency: "daily", priority: 0.7 },
  { path: "journal", changeFrequency: "weekly", priority: 0.6 },
  { path: "knowledge", changeFrequency: "weekly", priority: 0.6 },
  { path: "community", changeFrequency: "daily", priority: 0.6 },
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

async function settle<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

/** Static routes, Journal, Knowledge and legal pages. */
async function pageEntries(locale: Locale): Promise<SitemapEntry[]> {
  const url = (path: string) => absoluteUrl(path, locale)
  const [journal, knowledge, legal] = await Promise.all([
    settle(fetchAllBlogArticleSlugs(locale), { data: [] }),
    settle(fetchDocsWikiArticles(locale), undefined),
    settle(fetchLegalDocuments(locale), { data: [] }),
  ])

  const entries: SitemapEntry[] = STATIC_ROUTES.map((r) => ({
    url: url(r.path),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  for (const a of journal.data) {
    if (!a.slug) continue
    entries.push({
      url: url(`journal/${a.section?.slug ?? "general"}/${a.slug}`),
      changeFrequency: "monthly",
      priority: 0.6,
    })
  }

  for (const a of knowledge?.data ?? []) {
    if (!a.slug) continue
    entries.push({
      url: url(docsArticlePath(a)),
      ...(a.updatedAt ? { lastModified: a.updatedAt } : {}),
      changeFrequency: "monthly",
      priority: 0.5,
    })
  }

  for (const d of legal.data) {
    if (!d.slug) continue
    entries.push({
      url: url(`legal/${d.slug}`),
      changeFrequency: "yearly",
      priority: 0.3,
    })
  }

  return entries
}

// ── Locations ───────────────────────────────────────────────────────────────

/**
 * Continent, country and region pages. A location is listed only once it has
 * published records: empty templates are noindex (see lib/seo/location).
 */
async function locationEntries(locale: Locale): Promise<SitemapEntry[]> {
  const url = (path: string) => absoluteUrl(path, locale)
  const [counts, continents, countries, regions] = await Promise.all([
    fetchLibraryLocationCounts(locale),
    settle(fetchAllContinents(locale), { data: [] }),
    settle(fetchAllCountries(locale), { data: [] }),
    settle(fetchAllRegions(locale), { data: [] }),
  ])
  const indexable = (key: string) => isIndexableLocation(counts.get(key))
  const entries: SitemapEntry[] = []

  for (const c of continents.data) {
    if (!c.slug || !indexable(c.slug)) continue
    entries.push({
      url: url(c.slug),
      changeFrequency: "monthly",
      priority: 0.8,
    })
  }

  for (const c of countries.data) {
    if (!c.slug || !c.continent?.slug) continue
    const path = `${c.continent.slug}/${c.slug}`
    if (!indexable(path)) continue
    entries.push({ url: url(path), changeFrequency: "monthly", priority: 0.7 })
  }

  for (const r of regions.data) {
    if (!r.slug || !r.continent?.slug || !r.country?.slug) continue
    const path = `${r.continent.slug}/${r.country.slug}/${r.slug}`
    if (!indexable(path)) continue
    entries.push({ url: url(path), changeFrequency: "monthly", priority: 0.6 })
  }

  return entries
}

// ── Events ──────────────────────────────────────────────────────────────────

/** The events plugin's `limit` cap on `/events/global`. */
const EVENTS_PAGE_SIZE = 100

type EventsPage = { events?: { documentId?: string | null }[]; total?: number }

async function fetchEventsPage(page: number, limit: number) {
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const res = await fetch(
    `${strapi}/api/events/global?limit=${limit}&page=${page}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) throw new Error(`GET /events/global answered ${res.status}`)

  return (await res.json()) as EventsPage
}

async function fetchUpcomingEventTotal(): Promise<number> {
  return (await fetchEventsPage(1, 1)).total ?? 0
}

/** Upcoming and ongoing events for one file, read 100 at a time. */
async function eventEntries(
  locale: Locale,
  page: number
): Promise<SitemapEntry[]> {
  const perFile = URLS_PER_FILE / EVENTS_PAGE_SIZE
  const first = (page - 1) * perFile + 1
  const entries: SitemapEntry[] = []

  for (let p = first; p < first + perFile; p++) {
    const batch = (await fetchEventsPage(p, EVENTS_PAGE_SIZE)).events ?? []
    for (const e of batch) {
      if (!e.documentId) continue
      entries.push({
        url: absoluteUrl(`events/${e.documentId}`, locale),
        changeFrequency: "weekly",
        priority: 0.4,
      })
    }
    if (batch.length < EVENTS_PAGE_SIZE) break
  }

  return entries
}

// ── Libraries ───────────────────────────────────────────────────────────────

async function libraryEntries(
  locale: Locale,
  page: number
): Promise<SitemapEntry[]> {
  const rows = await fetchLibrarySlugRange(
    locale,
    (page - 1) * URLS_PER_FILE,
    URLS_PER_FILE
  )

  return rows.flatMap((row) => {
    const entry = libraryEntry(locale, row)

    return entry ? [entry] : []
  })
}

function libraryEntry(
  locale: Locale,
  row: LibrarySlugRow
): SitemapEntry | null {
  if (
    !row.slug ||
    !row.continent?.slug ||
    !row.country?.slug ||
    !row.region?.slug
  )
    return null

  return {
    url: absoluteUrl(
      `${row.continent.slug}/${row.country.slug}/${row.region.slug}/${row.slug}`,
      locale
    ),
    ...(row.updatedAt ? { lastModified: row.updatedAt } : {}),
    changeFrequency: "weekly",
    priority: 0.9,
  }
}

import type { MetadataRoute } from "next"
import type { Locale } from "next-intl"

import { docsArticlePath } from "@/components/docs/docs.config"
import { getEnvVar } from "@/lib/env-vars"
import { isDevelopment, isProduction } from "@/lib/general-helpers"
import { isIndexableLocation } from "@/lib/seo/location"
import { absoluteUrl, LIVE_LOCALES } from "@/lib/seo/metadata"
import {
  fetchAllBlogArticleSlugs,
  fetchAllContinents,
  fetchAllCountries,
  fetchAllLibraries,
  fetchAllRegions,
  fetchDocsWikiArticles,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-dynamic"

/** Public, indexable static routes (private/transactional ones are excluded). */
const STATIC_ROUTES: {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "libraries", changeFrequency: "daily", priority: 0.9 },
  { path: "map", changeFrequency: "weekly", priority: 0.7 },
  { path: "events", changeFrequency: "daily", priority: 0.7 },
  { path: "journal", changeFrequency: "weekly", priority: 0.6 },
  { path: "knowledge", changeFrequency: "weekly", priority: 0.6 },
  { path: "contribute", changeFrequency: "monthly", priority: 0.5 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isProduction() && !isDevelopment()) return []
  if (!getEnvVar("APP_PUBLIC_URL")) return []

  // Only locales with published content — see LIVE_LOCALES in lib/seo/metadata.
  const results = await Promise.allSettled(
    LIVE_LOCALES.map((locale) => generateLocalizedSitemap(locale as Locale))
  )

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<MetadataRoute.Sitemap>).value)
}

type Entry = MetadataRoute.Sitemap[number]

async function settle<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p
  } catch {
    return fallback
  }
}

async function generateLocalizedSitemap(
  locale: Locale
): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => absoluteUrl(path, locale)

  const [continents, countries, regions, libraries, blog, docs, events, legal] =
    await Promise.all([
      settle(fetchAllContinents(locale), { data: [] }),
      settle(fetchAllCountries(locale), { data: [] }),
      settle(fetchAllRegions(locale), { data: [] }),
      settle(fetchAllLibraries(locale), { data: [] }),
      settle(fetchAllBlogArticleSlugs(locale), { data: [] }),
      settle(fetchDocsWikiArticles(locale), undefined),
      settle(fetchUpcomingEventIds(), []),
      settle(fetchLegalDocuments(locale), { data: [] }),
    ])

  // Location pages are listed only once they have published records — empty
  // templates are noindex (see lib/seo/location), so keep them out of here too.
  const counts = countLibrariesByLocation(libraries.data)
  const indexable = (key: string) => isIndexableLocation(counts.get(key))

  const entries: Entry[] = STATIC_ROUTES.map((r) => ({
    url: url(r.path),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  // ── Continents ────────────────────────────────────────────────────────────
  for (const c of continents.data) {
    if (!c.slug || !indexable(c.slug)) continue
    entries.push({
      url: url(c.slug),
      changeFrequency: "monthly",
      priority: 0.8,
    })
  }

  // ── Countries ─────────────────────────────────────────────────────────────
  for (const c of countries.data) {
    if (!c.slug || !c.continent?.slug) continue
    if (!indexable(`${c.continent.slug}/${c.slug}`)) continue
    entries.push({
      url: url(`${c.continent.slug}/${c.slug}`),
      changeFrequency: "monthly",
      priority: 0.7,
    })
  }

  // ── Regions ───────────────────────────────────────────────────────────────
  for (const r of regions.data) {
    if (!r.slug || !r.continent?.slug || !r.country?.slug) continue
    if (!indexable(`${r.continent.slug}/${r.country.slug}/${r.slug}`)) continue
    entries.push({
      url: url(`${r.continent.slug}/${r.country.slug}/${r.slug}`),
      changeFrequency: "monthly",
      priority: 0.6,
    })
  }

  // ── Libraries ─────────────────────────────────────────────────────────────
  for (const lib of libraries.data) {
    if (
      !lib.slug ||
      !lib.continent?.slug ||
      !lib.country?.slug ||
      !lib.region?.slug
    ) {
      continue
    }
    const updatedAt = (lib as { updatedAt?: string | null }).updatedAt
    entries.push({
      url: url(
        `${lib.continent.slug}/${lib.country.slug}/${lib.region.slug}/${lib.slug}`
      ),
      ...(updatedAt ? { lastModified: updatedAt } : {}),
      changeFrequency: "weekly",
      priority: 0.9,
    })
  }

  // ── Blog articles ─────────────────────────────────────────────────────────
  for (const a of blog.data) {
    if (!a.slug) continue
    entries.push({
      url: url(`blog/${a.section?.slug ?? "general"}/${a.slug}`),
      changeFrequency: "monthly",
      priority: 0.6,
    })
  }

  // ── Docs articles (wiki content mapped into the docs taxonomy) ────────────
  for (const a of docs?.data ?? []) {
    if (!a.slug) continue
    entries.push({
      url: url(docsArticlePath(a)),
      ...(a.updatedAt ? { lastModified: a.updatedAt } : {}),
      changeFrequency: "monthly",
      priority: 0.5,
    })
  }

  // ── Legal documents ───────────────────────────────────────────────────────
  for (const d of legal.data) {
    if (!d.slug) continue
    entries.push({
      url: url(`legal/${d.slug}`),
      changeFrequency: "yearly",
      priority: 0.3,
    })
  }

  // ── Upcoming events ───────────────────────────────────────────────────────
  for (const id of events) {
    entries.push({
      url: url(`events/${id}`),
      changeFrequency: "weekly",
      priority: 0.4,
    })
  }

  return entries
}

/** Published-library counts keyed by continent, continent/country and full region path. */
function countLibrariesByLocation(
  libraries: {
    continent?: { slug?: string | null } | null
    country?: { slug?: string | null } | null
    region?: { slug?: string | null } | null
  }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)

  for (const lib of libraries) {
    const continent = lib.continent?.slug
    if (!continent) continue
    bump(continent)
    const country = lib.country?.slug
    if (!country) continue
    bump(`${continent}/${country}`)
    const region = lib.region?.slug
    if (region) bump(`${continent}/${country}/${region}`)
  }

  return counts
}

/** documentIds of upcoming/ongoing events from the events plugin. */
async function fetchUpcomingEventIds(): Promise<string[]> {
  const strapi = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const pageSize = 1000
  const maxPages = 10
  const ids: string[] = []

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `${strapi}/api/events/global?limit=${pageSize}&page=${page}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) break
    const json = (await res.json()) as {
      events?: { documentId?: string | null }[]
      total?: number
    }
    const batch = json.events ?? []
    for (const e of batch) if (e.documentId) ids.push(e.documentId)
    if (batch.length < pageSize || ids.length >= (json.total ?? 0)) break
  }

  return ids
}

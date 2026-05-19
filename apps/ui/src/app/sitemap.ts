import type { MetadataRoute } from "next"
import type { Locale } from "next-intl"

import { getEnvVar } from "@/lib/env-vars"
import { isDevelopment, isProduction } from "@/lib/general-helpers"
import { createPublicFullPath, routing } from "@/lib/navigation"
import {
  fetchAllBlogArticleSlugs,
  fetchAllContinents,
  fetchAllCountries,
  fetchAllLibraries,
  fetchAllPages,
  fetchAllRegions,
  fetchAllWikiArticleSlugs,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isProduction() && !isDevelopment()) return []
  if (!getEnvVar("APP_PUBLIC_URL")) return []

  const results = await Promise.allSettled(
    routing.locales.map((locale) => generateLocalizedSitemap(locale))
  )

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<MetadataRoute.Sitemap>).value)
}

async function generateLocalizedSitemap(
  locale: Locale
): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // ── CMS pages (about, contact, etc.) ──────────────────────────────────────
  const pages = await fetchAllPages("api::page.page", locale)
  for (const page of pages.data) {
    if (page.slug) {
      entries.push({
        url: createPublicFullPath(page.slug, String(page.locale)),
        lastModified: page.updatedAt ?? page.createdAt ?? undefined,
        changeFrequency: "monthly",
        priority: 0.5,
      })
    }
  }

  // ── Continents ────────────────────────────────────────────────────────────
  const continents = await fetchAllContinents(locale)
  for (const c of continents.data) {
    if (c.slug) {
      entries.push({
        url: createPublicFullPath(c.slug, locale),
        lastModified: (c as any).updatedAt ?? undefined,
        changeFrequency: "monthly",
        priority: 0.8,
      })
    }
  }

  // ── Countries ─────────────────────────────────────────────────────────────
  const countries = await fetchAllCountries(locale)
  for (const c of countries.data) {
    if (c.slug && c.continent?.slug) {
      entries.push({
        url: createPublicFullPath(`${c.continent.slug}/${c.slug}`, locale),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    }
  }

  // ── Regions ───────────────────────────────────────────────────────────────
  const regions = await fetchAllRegions(locale)
  for (const r of regions.data) {
    if (r.slug && r.continent?.slug && r.country?.slug) {
      entries.push({
        url: createPublicFullPath(
          `${r.continent.slug}/${r.country.slug}/${r.slug}`,
          locale
        ),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    }
  }

  // ── Libraries ─────────────────────────────────────────────────────────────
  const libraries = await fetchAllLibraries(locale)
  for (const lib of libraries.data) {
    if (
      lib.slug &&
      lib.continent?.slug &&
      lib.country?.slug &&
      lib.region?.slug
    ) {
      entries.push({
        url: createPublicFullPath(
          `${lib.continent.slug}/${lib.country.slug}/${lib.region.slug}/${lib.slug}`,
          locale
        ),
        lastModified: (lib as any).updatedAt ?? undefined,
        changeFrequency: "weekly",
        priority: 0.9,
      })
    }
  }

  // ── Blog articles ─────────────────────────────────────────────────────────
  const blogArticles = await fetchAllBlogArticleSlugs(locale)
  for (const a of blogArticles.data) {
    if (a.slug) {
      const section = a.section?.slug ?? "general"
      entries.push({
        url: createPublicFullPath(`blog/${section}/${a.slug}`, locale),
        changeFrequency: "weekly",
        priority: 0.6,
      })
    }
  }

  // ── Wiki articles ─────────────────────────────────────────────────────────
  const wikiArticles = await fetchAllWikiArticleSlugs(locale)
  for (const a of wikiArticles.data) {
    if (a.slug) {
      const section = a.section?.slug ?? "general"
      entries.push({
        url: createPublicFullPath(`wiki/${section}/${a.slug}`, locale),
        changeFrequency: "monthly",
        priority: 0.5,
      })
    }
  }

  return entries
}

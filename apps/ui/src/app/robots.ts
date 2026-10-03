import type { MetadataRoute } from "next"
import type { Locale } from "next-intl"

import { isProduction } from "@/lib/general-helpers"
import { routing } from "@/lib/navigation"
import { getSiteUrl, LIVE_LOCALES } from "@/lib/seo/metadata"
import { chunkIds } from "@/lib/sitemap-chunks"
import { fetchAllLibrarySlugs } from "@/lib/strapi-api/content/library-slugs"

/**
 * Private / transactional paths. Pages here also emit `noindex`, but blocking
 * crawl saves budget on auth-gated redirects and form flows.
 */
const PRIVATE_PATHS = [
  "/auth/",
  "/profile/settings",
  "/profile/onboarding",
  "/contribute/index",
  "/contribute/correct",
  "/contribute/claim",
  "/contribute/submissions",
  "/contribute/moderation",
  "/contribute/knowledge/",
  "/contribute/events",
  "/dev/",
  "/journal/search",
  "/knowledge/search",
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }

  // The sitemap is split into /sitemap/<id>.xml files (see app/sitemap.ts).
  const libraryCount = (
    await Promise.all(
      LIVE_LOCALES.map((locale) =>
        fetchAllLibrarySlugs(locale as Locale).catch(() => ({ data: [] }))
      )
    )
  ).reduce((total, { data }) => total + data.length, 0)
  const sitemaps = chunkIds(libraryCount).map(
    ({ id }) => `${getSiteUrl()}/sitemap/${id}.xml`
  )

  // localePrefix "as-needed": default locale is unprefixed, others are /{locale}/…
  const prefixes = [
    "",
    ...routing.locales
      .filter((l) => l !== routing.defaultLocale)
      .map((l) => `/${l}`),
  ]

  return {
    rules: [
      {
        userAgent: "*",
        // Strapi media is proxied through /api/asset — keep images crawlable.
        allow: ["/", "/api/asset/"],
        disallow: [
          "/api/",
          ...prefixes.flatMap((p) =>
            PRIVATE_PATHS.map((path) => `${p}${path}`)
          ),
        ],
      },
    ],
    sitemap: sitemaps,
  }
}

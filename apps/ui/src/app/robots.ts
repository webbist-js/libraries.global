import type { MetadataRoute } from "next"

import { betaEnabled } from "@/lib/beta/access"
import { isProduction } from "@/lib/general-helpers"
import { routing } from "@/lib/navigation"
import { getSiteUrl } from "@/lib/seo/metadata"

/**
 * Private / transactional paths. Pages here also emit `noindex`, but blocking
 * crawl saves budget on auth-gated redirects and form flows. `/contribute/`
 * (with the slash) blocks every Contribute sub-page but not the hub; the
 * membership page is allowed back in below. Staff pages remain crawlable
 * so crawlers can read their noindex metadata and X-Robots-Tag responses.
 * `/live` is the private live console.
 */
const PRIVATE_PATHS = [
  "/auth/",
  "/profile/settings",
  "/profile/onboarding",
  "/contribute/",
  "/live",
  "/community/drives/new",
  "/community/drives/*/edit",
  "/community/propose",
  "/dev/",
  "/journal/search",
  "/knowledge/search",
]

export default function robots(): MetadataRoute.Robots {
  if (betaEnabled() || !isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }

  // One sitemap index; it lists the per-category files (see lib/sitemap).
  const sitemap = `${getSiteUrl()}/sitemap.xml`

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
        // Strapi media is proxied through /api/asset — keep images crawlable;
        // the plans page is the one public Contribute sub-page.
        allow: [
          "/",
          "/api/asset/",
          ...prefixes.map((p) => `${p}/contribute/membership`),
        ],
        disallow: [
          "/api/",
          ...prefixes.flatMap((p) =>
            PRIVATE_PATHS.map((path) => `${p}${path}`)
          ),
        ],
      },
    ],
    sitemap,
  }
}

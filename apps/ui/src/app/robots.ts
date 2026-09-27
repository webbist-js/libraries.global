import type { MetadataRoute } from "next"

import { isProduction } from "@/lib/general-helpers"
import { routing } from "@/lib/navigation"
import { getSiteUrl } from "@/lib/seo/metadata"

/**
 * Private / transactional paths. Pages here also emit `noindex`, but blocking
 * crawl saves budget on auth-gated redirects and form flows.
 */
const PRIVATE_PATHS = [
  "/auth/",
  "/profile/settings",
  "/profile/onboarding",
  "/contribute/add",
  "/contribute/edit",
  "/contribute/correct",
  "/contribute/claim",
  "/contribute/submissions",
  "/contribute/knowledge/",
  "/contribute/events",
  "/dev/",
  "/journal/search",
  "/knowledge/search",
]

export default function robots(): MetadataRoute.Robots {
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }

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
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}

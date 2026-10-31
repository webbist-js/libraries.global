import { normalizePageFullPath } from "@repo/shared-data"

import { getEnvVar } from "@/lib/env-vars"

export { routing, usePathname, useRouter, getPathname } from "./navigation-core"
import { _redirect, routing } from "./navigation-core"

export { AccountAwareLink as Link } from "@/components/profile/AccountAwareLink"

// Help TypeScript detect unreachable code
// https://next-intl-docs.vercel.app/docs/routing/navigation#redirect
export const redirect: typeof _redirect = _redirect

/**
 * Function to check if a given link belongs to the same application - it is internal link.
 *
 * @param link
 * @returns true if the link is internal, false otherwise
 */
export const isAppLink = (link: string): boolean => {
  try {
    const baseUrl = getEnvVar("APP_PUBLIC_URL", true) as string
    const url = new URL(link, baseUrl)

    return url.hostname === new URL(baseUrl).hostname
  } catch {
    return false
  }
}

/**
 * Creates a full public URL for a given path and locale.
 * Omits the locale prefix for the default locale (as-needed strategy).
 */
export const createPublicFullPath = (slug: string, locale: string): string => {
  const baseUrl = getEnvVar("APP_PUBLIC_URL", true)!
  const isDefaultLocale = locale === routing.defaultLocale

  const path = normalizePageFullPath([slug], isDefaultLocale ? null : locale)

  // new URL("/", baseUrl) always adds a trailing slash for root paths — strip it
  return new URL(path, baseUrl).toString().replace(/\/$/, "")
}

export const formatHref = (href: string | undefined | null): string => {
  if (href?.startsWith("#")) return href

  if (!href) {
    // Empty path -> return hash to prevent unwanted issues
    return "#"
  }

  if (href.startsWith("http")) {
    // External or internal link that starts with http(s) -> return as is
    return href
  }

  if (!isAppLink(href)) {
    // External link -> return as is
    return href
  }

  if (!href.startsWith("/")) {
    // Ensure path starts with a slash
    href = `/${href}`
  }

  return href
}

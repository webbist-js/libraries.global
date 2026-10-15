import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@repo/shared-data"

import { getEnvVar } from "@/lib/env-vars"
import { safeRedirectPath } from "@/lib/safe-redirect"

export const MOBILE_SESSION_COOKIE = "libraries-shared.session_token"
export const MOBILE_BETA_COOKIE = "lg-mobile-beta-access"
const ID = /^[a-z0-9]{20,32}$/

/** Explicit opt-in: the mobile app must be a child of the account domain. */
export function mobileAppConfig() {
  const value =
    typeof window === "undefined"
      ? process.env.MOBILE_APP_URL
      : getEnvVar("MOBILE_APP_URL")
  if (!value) return null
  const site = new URL(
    (typeof window === "undefined"
      ? process.env.APP_PUBLIC_URL
      : getEnvVar("APP_PUBLIC_URL", true))!
  )
  const mobile = new URL(value)
  const local = site.hostname.endsWith(".localhost")
  if (
    mobile.hostname !== `mobile.${site.hostname}` ||
    mobile.protocol !== site.protocol ||
    (!local && site.protocol !== "https:") ||
    [site, mobile].some(
      (url) =>
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
    )
  )
    throw new Error(
      "MOBILE_APP_URL must be the mobile subdomain of APP_PUBLIC_URL"
    )

  return {
    site,
    mobile,
    cookieDomain: site.hostname,
    secure: site.protocol === "https:",
  }
}

export function splitMobileLocale(pathname: string) {
  const parts = pathname.split("/").filter(Boolean)
  const locale =
    SUPPORTED_LOCALES.find((value) => value === parts[0]) ?? DEFAULT_LOCALE
  if (parts[0] === locale) parts.shift()

  return { locale, parts }
}

/** Only console pages and their manifest can be mapped into the app. */
export function mobilePageTarget(pathname: string): string | null {
  // Dot-segment normalization can turn an otherwise relative path into //host.
  if (
    !pathname.startsWith("/") ||
    pathname.includes("//") ||
    pathname.includes("\\")
  )
    return null
  const { locale, parts } = splitMobileLocale(pathname)
  if (parts.length > 1) return null
  const leaf = parts[0]
  if (leaf && leaf !== "manifest.webmanifest" && !ID.test(leaf)) return null

  return `/${locale}/live${leaf ? `/${leaf}` : ""}`
}

export function mobilePath(id?: string, locale: string = DEFAULT_LOCALE) {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`

  return `${prefix}/${id ?? ""}`
}

/** Local development can use /live; configured deployments use the mobile origin. */
export function mobileConsoleHref(
  id?: string,
  locale: string = DEFAULT_LOCALE
) {
  const config = mobileAppConfig()

  return config
    ? new URL(mobilePath(id, locale), config.mobile).href
    : `${locale === DEFAULT_LOCALE ? "" : `/${locale}`}/live${id ? `/${id}` : ""}`
}

export function mobileSignInHref(pathname: string) {
  const config = mobileAppConfig()
  if (!config) return "/auth/signin"
  const path = safeRedirectPath(pathname)
  const { locale } = splitMobileLocale(path)
  const url = new URL(
    `${locale === DEFAULT_LOCALE ? "" : `/${locale}`}/auth/mobile`,
    config.site
  )
  url.searchParams.set("next", mobilePageTarget(path) ? path : "/")

  return url.href
}

/** Match the actual request host, never an Origin supplied by a caller. */
export function mobileRequestOrigin(req: Request): string | undefined {
  const config = mobileAppConfig()
  if (!config) return process.env.APP_PUBLIC_URL
  const host = req.headers.get("host")
  if (host === config.mobile.host) return config.mobile.origin

  return host === config.site.host ? config.site.origin : undefined
}

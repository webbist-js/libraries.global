import { SUPPORTED_LOCALES } from "@repo/shared-data"

import { isTeamApiPath } from "@/lib/team-api/paths"

const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`)

export const BETA_LEGAL_SLUG = "beta"

const MACHINE_PATHS = new Set([
  "/api/health",
  "/api/cron/retention",
  "/api/cron/billing",
  "/api/revalidate",
  "/api/preview",
  "/api/internal/session/invalidate",
  "/api/internal/notifications/recipients",
  "/api/email/preferences",
])
const AUTH_CALLBACKS = new Set([
  "/api/auth/verify-email",
  "/api/auth/magic-link/verify",
  "/api/auth/callback/google",
])
const ASSETS = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/apple-touch-icon.png",
])

export function betaPath(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX, "") || "/"
}

export function betaPublicShell(pathname: string): boolean {
  const path = betaPath(pathname)

  return (
    path === "/beta" ||
    path === "/beta/" ||
    path === `/legal/${BETA_LEGAL_SLUG}` ||
    path === "/legal/privacy" ||
    path === "/privacy" ||
    path === "/legal/terms" ||
    path === "/legal/membership" ||
    path === "/legal/cancellation-refunds" ||
    path === "/legal/cookies" ||
    path === "/email/preferences"
  )
}

export function betaPublicRequest(pathname: string, method: string): boolean {
  if (isTeamApiPath(pathname))
    return pathname === "/api/v1/search/libraries"
      ? method === "POST"
      : method === "GET"
  if (pathname === "/api/billing/webhook") return method === "POST"
  // The handler authenticates the CMS bridge independently of a browser beta pass.
  if (pathname === "/api/internal/articles/invalidate") return method === "POST"
  const path = betaPath(pathname)
  if (pathname.startsWith("/_next/static/") || ASSETS.has(pathname))
    return method === "GET" || method === "HEAD"
  if (betaPublicShell(pathname) || pathname === "/robots.txt")
    return method === "GET" || method === "HEAD"
  if (
    pathname === "/api/beta/access" ||
    pathname === "/api/beta/waitlist" ||
    pathname === "/api/contact"
  )
    return method === "POST"
  if (MACHINE_PATHS.has(pathname)) return true // Each handler retains its own service authentication.

  return method === "GET" && AUTH_CALLBACKS.has(path)
}

const MACHINE_PATHS = new Set([
  "/api/health",
  "/api/cron/retention",
  "/api/revalidate",
  "/api/preview",
  "/api/internal/session/invalidate",
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
  return pathname.replace(/^\/(?:cs|en)(?=\/|$)/, "") || "/"
}

export function betaPublicShell(pathname: string): boolean {
  const path = betaPath(pathname)

  return (
    path === "/beta" ||
    path === "/beta/" ||
    path === "/legal/privacy" ||
    path === "/legal/cookies"
  )
}

export function betaPublicRequest(pathname: string, method: string): boolean {
  const path = betaPath(pathname)
  if (pathname.startsWith("/_next/static/") || ASSETS.has(pathname))
    return method === "GET" || method === "HEAD"
  if (betaPublicShell(pathname) || pathname === "/robots.txt")
    return method === "GET" || method === "HEAD"
  if (pathname === "/api/beta/access" || pathname === "/api/beta/waitlist")
    return method === "POST"
  if (MACHINE_PATHS.has(pathname)) return true // Each handler retains its own service authentication.

  return method === "GET" && AUTH_CALLBACKS.has(path)
}

/**
 * Which paths the staging Basic Auth gate covers. Route handlers are covered
 * too (they'd otherwise expose data and forms on a password-protected site),
 * except the ones a machine calls with its own secret.
 */
const EXEMPT_PREFIXES = [
  "/api/cron", // Vercel Cron, bearer CRON_SECRET
  "/api/preview", // Strapi preview button, STRAPI_PREVIEW_SECRET
  "/api/auth", // Better Auth's own endpoints and rate limits
  "/api/revalidate", // Strapi webhook, REVALIDATE_SECRET
  "/api/health", // uptime monitors; exposes nothing but liveness
  "/api/internal", // Strapi callbacks, bridge secret
]

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export const isApiPath = (pathname: string): boolean =>
  startsWithSegment(pathname, "/api")

export const needsBasicAuth = (pathname: string): boolean =>
  !EXEMPT_PREFIXES.some((prefix) => startsWithSegment(pathname, prefix))

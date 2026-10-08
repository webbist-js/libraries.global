import { NextRequest, type NextResponse } from "next/server"

import { routing } from "@/lib/navigation"

const LOCALE_PREFIX = new RegExp(`^/(?:${routing.locales.join("|")})(?=/|$)`)

/**
 * The locale-stripped path of a staff page (`/en/staff/{slug}/notices` →
 * `/staff/{slug}/notices`), or null for any other path.
 */
export function staffPath(pathname: string): string | null {
  const stripped = pathname.replace(LOCALE_PREFIX, "") || "/"

  return stripped === "/staff" || stripped.startsWith("/staff/")
    ? stripped
    : null
}

/**
 * Forwards a staff page's own path to its server components as the
 * `x-pathname` request header (read by `app/[locale]/staff/_lib/
 * staff-pathname.ts`), so a signed-out deep link comes back to the same
 * tab. The header is always dropped from the incoming request first: only
 * the proxy sets it. Every response goes through `liveSecurityResponse`,
 * which propagates the request headers into server rendering.
 */
export function staffPathnameRequest(req: NextRequest): NextRequest {
  const path = staffPath(req.nextUrl.pathname)
  if (!path && !req.headers.has("x-pathname")) return req
  const headers = new Headers(req.headers)
  headers.delete("x-pathname")
  if (path) headers.set("x-pathname", `${path}${req.nextUrl.search}`)

  return new NextRequest(req, { headers })
}

/** Also covers sign-in redirects and error responses, before a layout renders. */
export function staffIndexingResponse(
  req: NextRequest,
  response: NextResponse
): NextResponse {
  if (staffPath(req.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    response.headers.set("Cache-Control", "private, no-store")
  }

  return response
}

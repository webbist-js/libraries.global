import { type NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"

import {
  liveSecurityRequest,
  liveSecurityResponse,
} from "@/lib/mobile-live/security"
import { routing } from "@/lib/navigation"
import { authGuard } from "@/lib/proxies/authGuard"
import { isApiPath, needsBasicAuth } from "@/lib/proxies/basic-auth-scope"
import { basicAuth } from "@/lib/proxies/basicAuth"
import { httpsRedirect } from "@/lib/proxies/httpsRedirect"
import {
  staffIndexingResponse,
  staffPathnameRequest,
} from "@/lib/proxies/staffPathname"

// https://next-intl-docs.vercel.app/docs/getting-started/app-router
const intlProxy = createMiddleware(routing)

export default async function proxy(originalReq: NextRequest) {
  // Staff pages get their own locale-stripped path as `x-pathname`, for the
  // sign-in callback; `liveSecurityResponse` forwards the request headers.
  const req = staffPathnameRequest(liveSecurityRequest(originalReq))
  const { pathname } = req.nextUrl
  const respond = (response: NextResponse) =>
    staffIndexingResponse(req, liveSecurityResponse(req, response))

  if (needsBasicAuth(pathname)) {
    const basicAuthResponse = basicAuth(req)
    if (basicAuthResponse) return respond(basicAuthResponse)
  }

  const httpsResponse = httpsRedirect(req)
  if (httpsResponse) return respond(httpsResponse)

  // Route handlers aren't localised: they only pass through the gates above.
  if (isApiPath(pathname)) return respond(NextResponse.next())

  const authResponse = await authGuard(req, intlProxy)
  if (authResponse) return respond(authResponse)

  return respond(intlProxy(req))
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    "/",
    // Set a cookie to remember the previous locale for
    // all requests that have a locale prefix
    `/(cs|en)/:path*`,
    // Route handlers, so staging Basic Auth covers them too (see
    // lib/proxies/basic-auth-scope for the exemptions)
    "/api/:path*",
    // A UID slug can contain dots; staff routes must still get noindex headers.
    "/staff/:path*",

    // Skip all paths that should not be internationalized
    // eslint-disable-next-line unicorn/prefer-string-raw
    "/((?!_next|_vercel|api|robots.txt|favicon.ico|sitemap|.*\\..*).*)",
  ],
}

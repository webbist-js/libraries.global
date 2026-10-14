import { type NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"

import { BETA_COOKIE, betaEnabled } from "@/lib/beta/access"
import { hasBetaAccess } from "@/lib/beta/invitations"
import {
  liveSecurityRequest,
  liveSecurityResponse,
} from "@/lib/mobile-live/security"
import { routing } from "@/lib/navigation"
import {
  atlasCohortRequest,
  atlasCohortResponse,
} from "@/lib/proxies/atlasCohort"
import { authGuard } from "@/lib/proxies/authGuard"
import { isApiPath, needsBasicAuth } from "@/lib/proxies/basic-auth-scope"
import { basicAuth } from "@/lib/proxies/basicAuth"
import {
  betaGate,
  betaResponse,
  betaShellRequest,
} from "@/lib/proxies/betaGate"
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
  const cohort = atlasCohortRequest(originalReq)
  const hasAccess =
    betaEnabled() &&
    (await hasBetaAccess(originalReq.cookies.get(BETA_COOKIE)?.value))
  const req = betaShellRequest(
    staffPathnameRequest(liveSecurityRequest(cohort.request)),
    hasAccess
  )
  const { pathname } = req.nextUrl
  const respond = (response: NextResponse) =>
    betaResponse(
      atlasCohortResponse(
        staffIndexingResponse(req, liveSecurityResponse(req, response)),
        cohort.created
      )
    )

  if (needsBasicAuth(pathname)) {
    const basicAuthResponse = basicAuth(req)
    if (basicAuthResponse) return respond(basicAuthResponse)
  }

  const httpsResponse = httpsRedirect(req)
  if (httpsResponse) return respond(httpsResponse)

  const gateResponse = betaGate(req, hasAccess)
  if (gateResponse) return respond(gateResponse)

  // Metadata and public files must retain their original, non-localised path.
  if (
    pathname === "/robots.txt" ||
    pathname.startsWith("/sitemap") ||
    /^\/(?:atlas|images)(?:\/|$)/.test(pathname) ||
    /^\/(?:favicon\.(?:ico|svg)|apple-touch-icon\.png|live-icon\.svg|live-offline\.html|live-sw\.js)$/.test(
      pathname
    )
  ) {
    return respond(NextResponse.next())
  }

  // Route handlers aren't localised: they only pass through the gates above.
  if (isApiPath(pathname)) return respond(NextResponse.next())

  const authResponse = await authGuard(req, intlProxy)
  if (authResponse) return respond(authResponse)

  return respond(intlProxy(req))
}

export const config = {
  // Dotted slugs, feeds, exports and sitemaps also pass through the beta gate.
  matcher: ["/((?!_next/|_vercel/).*)"],
}

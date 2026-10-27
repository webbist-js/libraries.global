import { type NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"

import { BETA_COOKIE, betaEnabled, readBetaPass } from "@/lib/beta/access"
import { hasBetaAccess } from "@/lib/beta/invitations"
import {
  MOBILE_BETA_COOKIE,
  mobileAppConfig,
  mobilePageTarget,
  mobileSignInHref,
  splitMobileLocale,
} from "@/lib/mobile-app"
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
import { knowledgeMarkdownRewrite } from "@/lib/proxies/knowledgeMarkdown"
import {
  isMobileHost,
  mobileAppRoute,
  mobileAppRequest,
} from "@/lib/proxies/mobileApp"
import {
  staffIndexingResponse,
  staffPathnameRequest,
} from "@/lib/proxies/staffPathname"
import { widgetResponse } from "@/lib/proxies/widgets"

// https://next-intl-docs.vercel.app/docs/getting-started/app-router
const intlProxy = createMiddleware(routing)

async function independentPublicResponse(req: NextRequest) {
  const { pathname } = req.nextUrl
  const widget = await widgetResponse(req)
  if (widget) return widget

  // Text exports bypass HTML routing; metadata and public files keep root paths.
  const markdown = knowledgeMarkdownRewrite(req)
  if (
    markdown ||
    ["/robots.txt", "/openapi.json", "/llms.txt", "/embed/resize.js"].includes(
      pathname
    ) ||
    pathname.startsWith("/sitemap") ||
    /^\/(?:atlas|images)(?:\/|$)/.test(pathname) ||
    /^\/(?:favicon\.(?:ico|svg)|apple-touch-icon\.png|live-icon\.svg|live-offline\.html|live-sw\.js)$/.test(
      pathname
    )
  ) {
    return markdown ?? NextResponse.next()
  }

  return null
}

function mobilePageResponse(req: NextRequest) {
  const pathname = req.nextUrl.pathname,
    target = mobilePageTarget(pathname)
  if (!target) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = target
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-next-intl-locale", splitMobileLocale(pathname).locale)

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
}

function makeResponder(
  req: NextRequest,
  created: string | undefined,
  mobile: boolean,
  hasAccess: boolean,
  pass: string | undefined
) {
  return (response: NextResponse) => {
    const config = mobileAppConfig()
    const grant = hasAccess ? readBetaPass(pass) : null
    if (config && !mobile && grant)
      response.cookies.set(MOBILE_BETA_COOKIE, pass!, {
        httpOnly: true,
        secure: config.secure,
        sameSite: "lax",
        path: "/",
        domain: config.cookieDomain,
        maxAge: Math.max(0, Math.floor((grant.expiresAt - Date.now()) / 1000)),
      })

    return betaResponse(
      atlasCohortResponse(
        staffIndexingResponse(req, liveSecurityResponse(req, response)),
        created
      )
    )
  }
}

export default async function proxy(originalReq: NextRequest) {
  // Staff pages get their own locale-stripped path as `x-pathname`, for the
  // sign-in callback; `liveSecurityResponse` forwards the request headers.
  const cohort = atlasCohortRequest(mobileAppRequest(originalReq))
  const mobile = isMobileHost(cohort.request)
  const pass = originalReq.cookies.get(
    mobile ? MOBILE_BETA_COOKIE : BETA_COOKIE
  )?.value
  const hasAccess = betaEnabled() && (await hasBetaAccess(pass))
  const req = betaShellRequest(
    staffPathnameRequest(liveSecurityRequest(cohort.request)),
    hasAccess
  )
  const { pathname } = req.nextUrl
  const respond = makeResponder(req, cohort.created, mobile, hasAccess, pass)

  const mobileRoute = mobileAppRoute(req)
  if (mobileRoute) return respond(mobileRoute)

  if (needsBasicAuth(pathname)) {
    const basicAuthResponse = basicAuth(req)
    if (basicAuthResponse) return respond(basicAuthResponse)
  }

  const httpsResponse = httpsRedirect(req)
  if (httpsResponse) return respond(httpsResponse)

  const gateResponse = betaGate(req, hasAccess)
  if (gateResponse) {
    if (mobile && !isApiPath(pathname))
      return respond(NextResponse.redirect(mobileSignInHref(pathname)))

    return respond(gateResponse)
  }

  if (mobile) return respond(mobilePageResponse(req))

  const independent = await independentPublicResponse(req)
  if (independent) return respond(independent)

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

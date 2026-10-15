import { NextRequest, NextResponse } from "next/server"

import { isLivePagePath } from "@/lib/live-path"
import { mobileAppConfig, mobilePageTarget } from "@/lib/mobile-app"

const STATIC = new Set([
  "/live-sw.js",
  "/live-icon.svg",
  "/live-offline.html",
  "/favicon.ico",
  "/favicon.svg",
  "/apple-touch-icon.png",
])
const AUTH = new Set([
  "/api/auth/get-session",
  "/api/auth/sign-out",
  "/api/auth/passkey/generate-authenticate-options",
  "/api/auth/passkey/verify-authentication",
])
const notFound = () =>
  new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })

export function isMobileHost(req: NextRequest) {
  const config = mobileAppConfig()

  return !!config && req.headers.get("host") === config.mobile.host
}

/** Restrict the new origin to the console; main-site pages stay on the main site. */
export function mobileAppRoute(req: NextRequest): NextResponse | null {
  if (!isMobileHost(req))
    return mobileAppConfig() && isLivePagePath(req.nextUrl.pathname)
      ? notFound()
      : null
  const { pathname } = req.nextUrl
  if (pathname === "/robots.txt")
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain",
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  if (
    STATIC.has(pathname) ||
    AUTH.has(pathname) ||
    /^\/api\/mobile\/live(?:\/|$)/.test(pathname)
  )
    return null

  return mobilePageTarget(pathname) ? null : notFound()
}

export function mobileAppRequest(original: NextRequest) {
  const headers = new Headers(original.headers)
  headers.delete("x-mobile-app")
  if (isMobileHost(original)) headers.set("x-mobile-app", "true")

  return new NextRequest(original, { headers })
}

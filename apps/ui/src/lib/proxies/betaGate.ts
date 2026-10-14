import { NextRequest, NextResponse } from "next/server"

import { betaDestination, betaEnabled } from "@/lib/beta/access"
import { betaPath, betaPublicRequest, betaPublicShell } from "@/lib/beta/scope"

export function betaShellRequest(
  req: NextRequest,
  hasAccess = false
): NextRequest {
  const headers = new Headers(req.headers)
  headers.delete("x-beta-public-shell")
  const path = betaPath(req.nextUrl.pathname)
  const entrance = path === "/beta" || path === "/beta/"
  // Legal URLs stay readable before entry. A verified pass restores the site
  // providers, header and footer. The entrance itself remains independent.
  if (
    betaEnabled() &&
    betaPublicShell(req.nextUrl.pathname) &&
    (entrance || !hasAccess)
  )
    headers.set("x-beta-public-shell", "true")

  return new NextRequest(req, { headers })
}

export function betaGate(
  req: NextRequest,
  hasAccess = false
): NextResponse | null {
  if (
    !betaEnabled() ||
    betaPublicRequest(req.nextUrl.pathname, req.method) ||
    hasAccess
  )
    return null
  const path = req.nextUrl.pathname
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  }
  if (
    path.startsWith("/api/") ||
    req.headers.has("rsc") ||
    req.headers.has("next-router-prefetch") ||
    /\.(?:xml|json|ics|csv|pmtiles|pbf|geojson)$/.test(path)
  ) {
    return NextResponse.json(
      { error: "Beta access required" },
      { status: 401, headers }
    )
  }
  const entry = new URL(
    /^\/(cs|fr)(?:\/|$)/.test(path) ? `/${path.split("/")[1]}/beta` : "/beta",
    req.url
  )
  const destination = betaDestination(`${path}${req.nextUrl.search}`)
  if (betaPath(destination) !== "/") entry.searchParams.set("next", destination)
  const redirect = NextResponse.redirect(entry)
  for (const [key, value] of Object.entries(headers))
    redirect.headers.set(key, value)

  return redirect
}

export function betaResponse(response: NextResponse): NextResponse {
  if (betaEnabled()) {
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  return response
}

import { NextRequest, NextResponse } from "next/server"

import { isLivePath } from "@/lib/live-path"

export { isLivePath }
export function liveSecurityRequest(req: NextRequest): NextRequest {
  const requestHeaders = new Headers(req.headers)
  requestHeaders.delete("x-live-console")
  requestHeaders.delete("x-nonce")
  requestHeaders.delete("Content-Security-Policy")
  if (!isLivePath(req.nextUrl.pathname))
    return new NextRequest(req, { headers: requestHeaders })
  const nonce = btoa(
    String.fromCodePoint(...crypto.getRandomValues(new Uint8Array(18)))
  )
  requestHeaders.set("x-live-console", "true")
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", liveCsp(nonce))

  return new NextRequest(req, { headers: requestHeaders })
}
function liveCsp(nonce: string) {
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
}

export function liveSecurityResponse(
  req: NextRequest,
  response: NextResponse
): NextResponse {
  const nonce = req.headers.get("x-nonce") ?? ""
  const requestHeaders = new Headers(req.headers)
  const propagated = NextResponse.next({ request: { headers: requestHeaders } })
  // Preserve next-intl's rewrite while passing the CSP nonce into server rendering.
  for (const [key, value] of propagated.headers)
    if (key.startsWith("x-middleware-request-"))
      response.headers.set(key, value)
  const names = new Set([
    ...(response.headers.get("x-middleware-override-headers")?.split(",") ??
      []),
    ...(propagated.headers.get("x-middleware-override-headers")?.split(",") ??
      []),
  ])
  response.headers.set(
    "x-middleware-override-headers",
    [...names].filter(Boolean).join(",")
  )
  if (!isLivePath(req.nextUrl.pathname)) return response
  response.headers.set("Content-Security-Policy", liveCsp(nonce))
  response.headers.set("Referrer-Policy", "no-referrer")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Permissions-Policy", "geolocation=(self)")
  response.headers.set("Cache-Control", "no-store")

  return response
}

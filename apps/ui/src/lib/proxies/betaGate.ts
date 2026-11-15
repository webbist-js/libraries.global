import { NextRequest, type NextResponse } from "next/server"

/** Compatibility boundary: untrusted clients cannot request the retired shell. */
export function betaShellRequest(
  req: NextRequest,
  _hasAccess = false
): NextRequest {
  const headers = new Headers(req.headers)
  headers.delete("x-beta-public-shell")

  return new NextRequest(req, { headers })
}

/** @deprecated Public access no longer requires a beta invitation. */
export function betaGate(
  _req: NextRequest,
  _hasAccess = false
): NextResponse | null {
  return null
}

/** @deprecated Beta-wide noindex and cache restrictions have been retired. */
export function betaResponse(response: NextResponse): NextResponse {
  return response
}

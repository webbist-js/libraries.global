import { parseWidgetOrigins } from "@repo/shared-data"
import { type NextRequest, NextResponse } from "next/server"

/** Only standalone widget pages receive an external framing policy. Gates run first. */
export async function widgetResponse(
  req: NextRequest
): Promise<NextResponse | null> {
  const match = /^\/embed\/w\/([A-Za-z0-9_-]{24})\/?$/.exec(
    req.nextUrl.pathname
  )
  if (!match) return null
  const id = match[1]!
  let ancestors = "'none'"
  try {
    const secret = process.env.STRAPI_BRIDGE_SECRET
    if (secret) {
      const r = await fetch(
        `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/widgets/public/${id}/policy`,
        {
          headers: { "x-service-secret": secret },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }
      )
      if (r.ok) {
        const p = await r.json()
        const origins = parseWidgetOrigins(
          p.origins,
          process.env.NODE_ENV !== "production"
        )
        ancestors = ["'self'", ...origins].join(" ")
      }
    }
  } catch {
    /* Closed policy on failures. The page can still explain unavailable data. */
  }
  const response = NextResponse.next()
  response.headers.set(
    "Content-Security-Policy",
    `frame-ancestors ${ancestors}; report-uri /api/widgets/${id}/reports`
  )
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}

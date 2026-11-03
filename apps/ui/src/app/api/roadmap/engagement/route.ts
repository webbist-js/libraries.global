import { isSupportedLocale } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { strapiServiceHeaders, userHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// GET /api/roadmap/engagement — vote and discussion counts, published
// dataset suggestions and the viewer's own votes.
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const locale = new URL(req.url).searchParams.get("locale")
  const query =
    locale && isSupportedLocale(locale)
      ? `?locale=${encodeURIComponent(locale)}`
      : ""
  const res = await fetch(`${STRAPI}/api/roadmap/engagement${query}`, {
    headers: session?.user ? userHeaders(session.user) : strapiServiceHeaders(),
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))

  return NextResponse.json(json, {
    status: res.ok ? 200 : res.status,
    headers: { "Cache-Control": "private, no-store" },
  })
}

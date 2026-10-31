import { NextResponse } from "next/server"
import type { Locale } from "next-intl"

import { BETA_COOKIE, betaEnabled } from "@/lib/beta/access"
import { hasBetaAccess } from "@/lib/beta/invitations"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"
import { routing } from "@/lib/routing"
import { searchSite } from "@/lib/site-search-server"

const limiter = createRateLimiter({
  name: "site-search",
  max: 120,
  windowMs: 60_000,
})
const headers = { "Cache-Control": "private, no-store" }

export async function GET(req: Request) {
  const pass = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${BETA_COOKIE}=`))
    ?.slice(BETA_COOKIE.length + 1)
  if (betaEnabled() && !(await hasBetaAccess(pass)))
    return NextResponse.json(
      { error: "Beta access required" },
      { status: 401, headers }
    )
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) return rateLimitResponse(limit)
  const params = new URL(req.url).searchParams
  const q = (params.get("q") ?? "").trim()
  const locale = params.get("locale") ?? routing.defaultLocale
  if (
    q.length > 120 ||
    !(routing.locales as readonly string[]).includes(locale)
  )
    return NextResponse.json(
      { error: "Invalid search" },
      { status: 400, headers }
    )
  try {
    return NextResponse.json(await searchSite(q, locale as Locale), { headers })
  } catch {
    return NextResponse.json(
      { error: "Search unavailable" },
      { status: 503, headers }
    )
  }
}

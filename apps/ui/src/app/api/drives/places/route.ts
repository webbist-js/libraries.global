import { NextResponse } from "next/server"

import { searchPlaces } from "@/lib/drives/place-search"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

/** Typing is debounced, but follows the keyboard: 120 a minute per address. */
const limiter = createRateLimiter({
  name: "drive-places",
  max: 120,
  windowMs: 60_000,
})

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
}

/**
 * GET /api/drives/places?q=&locale= — the drive builder's place search:
 * up to 8 `{ level, slug, name, context }` (plus `kind`, what the country
 * calls a region) whose name matches `q`, from the library index. Public:
 * place names are public, and only places with libraries come back. An
 * empty `q` is an empty list; a Meilisearch failure is a 502.
 */
export async function GET(req: Request) {
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) return rateLimitResponse(limit)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (!q) return NextResponse.json({ data: [] }, { headers: CACHE_HEADERS })

  try {
    const data = await searchPlaces(q, searchParams.get("locale") ?? undefined)

    return NextResponse.json({ data }, { headers: CACHE_HEADERS })
  } catch {
    return NextResponse.json(
      { error: "Places are unavailable right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    )
  }
}

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { searchPlaces } from "@/lib/geocode/photon"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

// Search-as-you-type sends one request per pause: generous, but capped.
const limiter = createRateLimiter({
  name: "geocode-search",
  max: 60,
  windowMs: 60_000,
})

/** Places matching `q`, for the Index editor's location search. */
export async function GET(req: Request) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 3 || q.length > 200)
    return NextResponse.json(
      { error: "Search for 3 to 200 characters." },
      { status: 400 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  try {
    return NextResponse.json({ data: await searchPlaces(q) })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 })
  }
}

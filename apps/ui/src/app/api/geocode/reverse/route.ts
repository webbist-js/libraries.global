import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { isLatitude, isLongitude, readCoord } from "@/lib/geocode/coordinates"
import { reversePlace } from "@/lib/geocode/photon"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

// One lookup per dropped pin or "Use my location".
const limiter = createRateLimiter({
  name: "geocode-reverse",
  max: 20,
  windowMs: 60_000,
})

/** The place nearest `lat`/`lng`, for the Index editor's map pin. */
export async function GET(req: Request) {
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const lat = readCoord(params.get("lat") ?? "")
  const lng = readCoord(params.get("lng") ?? "")
  if (!isLatitude(lat) || !isLongitude(lng))
    return NextResponse.json(
      { error: "lat and lng must be coordinates." },
      { status: 400 }
    )

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  try {
    return NextResponse.json({ data: await reversePlace(lat, lng) })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 })
  }
}
